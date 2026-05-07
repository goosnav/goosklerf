#!/usr/bin/env python3
"""
Fast GUI Card OCR + Analysis + Visual Stats

- GUI to pick a folder with card images
- Parallel OpenAI vision calls (gpt-4o-mini) with image downscaling
- Reuses existing card_data.csv to avoid re-processing identical files
- Outputs card_data.csv with full stats in BOTH:
    * the selected folder
    * the current working directory (card_data_<foldername>.csv)
- Opens a second GUI window with statistical plots after processing:
    * Histogram + fitted normal curve per stat (hp, fortress_hp, attack, attack_buff, hp_buff)
    * Summary numbers (N, mean, std, SEM)
    * Card-type counts

Requirements:
    pip install openai pandas pillow matplotlib numpy
    export OPENAI_API_KEY="your-key-here"
"""

import os
import json
import math
import base64
import io
import threading
import time
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from openai import OpenAI
from PIL import Image

import tkinter as tk
from tkinter import ttk, filedialog, messagebox

from matplotlib.figure import Figure
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg

# ---------- CONFIG ----------

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

# Numeric stats for analysis
NUMERIC_FIELDS = ["hp", "fortress_hp", "attack", "attack_buff", "hp_buff"]

VISION_MODEL = "gpt-4o-mini"

# Run sequentially to avoid spiky TPM usage
MAX_WORKERS = 1

MAX_IMAGE_SIZE = 1024  # max side length sent to API

# Rate-limit handling
RATE_LIMIT_MAX_RETRIES = 8

from openai import OpenAI

client = OpenAI()

# ---------- CORE HELPERS ----------

def encode_resized_image_to_base64(path: str, max_size: int = MAX_IMAGE_SIZE) -> str:
    """Resize image to max_size and return JPEG as base64 string."""
    img = Image.open(path).convert("RGB")
    w, h = img.size
    scale = min(1.0, max_size / max(w, h))
    if scale < 1.0:
        new_w = int(w * scale)
        new_h = int(h * scale)
        img = img.resize((new_w, new_h), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def build_prompt() -> str:
    """
    Prompt for vision model.

    Schema matches the CSV columns you care about:
      hp, fortress_hp, hp_buff, attack_buff, attack, misc_stat, description,
      has_special, card_type.
    """
    return (
        "You are analyzing a single card from a custom card game. "
        "Read all text and graphics, including the small icon in the top-right corner, "
        "the colored outer border, the dice icons, and the rules text.\n\n"
        "Your task is to output a single JSON object with normalized stats for THIS card only, "
        "with exactly these keys:\n\n"
        "{\n"
        '  \"card_name\": string,\n'
        '  \"card_type\": \"entity\" | \"fortress\" | \"item_regular\" | \"item_consumable\",\n'
        "  \"hp\": integer or null,\n"
        "  \"fortress_hp\": integer or null,\n"
        "  \"attack\": integer or null,\n"
        "  \"attack_buff\": integer or null,\n"
        "  \"hp_buff\": integer or null,\n"
        "  \"misc_stat\": string or null,\n"
        "  \"description\": string,\n"
        "  \"has_special\": boolean,\n"
        "  \"notes\": string\n"
        "}\n\n"
        "Interpretation rules:\n"
        "- Determine card_type using the top-right icon AND the border color:\n"
        "  * fortress: castle/fortress icon; outer border typically blue or orange.\n"
        "  * entity: character icon; outer border typically red or purple.\n"
        "  * item: tool/weapon/bomb/etc icon; outer border typically green or yellow.\n"
        "- Among items, if the rules text clearly says something like "
        "\"CONSUMABLE (DISCARD AFTER USE)\", treat as \"item_consumable\"; otherwise \"item_regular\".\n\n"
        "HP / attack dice rules:\n"
        "- Dice show pips (dots). Sum all pips in the relevant box.\n"
        "- For ENTITY cards:\n"
        "  * hp = sum of pips in the HP box (HP for that entity).\n"
        "  * attack = sum of pips in the ATTACK box.\n"
        "  * fortress_hp, attack_buff, hp_buff = null.\n"
        "- For FORTRESS cards:\n"
        "  * fortress_hp = sum of pips in the main HP area.\n"
        "  * attack_buff = sum of pips in the ATTACK BUFF dice box (if present, else null).\n"
        "  * hp_buff = sum of pips in the HP BUFF dice box (if present, else null).\n"
        "  * hp and attack = null.\n"
        "- For ITEM cards (both item_regular and item_consumable):\n"
        "  * Typically they DO NOT have their own base hp or fortress_hp.\n"
        "  * If the item provides an HP buff to whoever equips it, set hp_buff to the total pips in that buff dice box.\n"
        "  * If it provides an attack buff, set attack_buff accordingly.\n"
        "  * hp, fortress_hp, attack should usually be null unless the card clearly defines its own HP or attack.\n\n"
        "SPECIAL flag:\n"
        "- If the card has a yellow header box explicitly labeled \"SPECIAL\", set has_special = true.\n"
        "- For consumable items, has_special is usually false unless there is explicitly a SPECIAL header.\n"
        "- Otherwise set has_special = false.\n\n"
        "misc_stat:\n"
        "- If the card has some extra numeric or status-like stat that isn't HP/attack/buff (e.g., STATUS: MEDICATED, "
        "a roll threshold, or similar), summarize it in a short string (e.g. \"status: MEDICATED\", "
        "\"roll <=3\", etc.). If nothing extra is relevant, set misc_stat = null.\n\n"
        "description:\n"
        "- Provide a concise plain-English summary of the rules/effect text of the card.\n\n"
        "General:\n"
        "- Always provide ALL keys above.\n"
        "- Use integers for numeric fields; use null for missing numbers.\n"
        "- If unsure about a numeric value, give your best estimate and explain uncertainty in notes.\n"
        "- Respond with ONLY the JSON object, no backticks, no extra commentary."
    )


def extract_text_from_chat_completion(response) -> str:
    """Extract plain text from a chat.completions response."""
    try:
        choice = response.choices[0]
    except Exception:
        return str(response)

    content = getattr(choice.message, "content", "")
    if isinstance(content, str):
        return content.strip()

    text_parts: List[str] = []
    if isinstance(content, list):
        for part in content:
            if hasattr(part, "text"):
                text_parts.append(part.text)
            elif isinstance(part, dict) and "text" in part:
                text_parts.append(str(part["text"]))
            elif isinstance(part, str):
                text_parts.append(part)
    else:
        text_parts.append(str(content))
    return "".join(text_parts).strip()


def call_openai_vision(image_path: str) -> Optional[Dict[str, Any]]:
    """Analyze a single card image via gpt-4o-mini vision.
    Handles rate limits via retry + backoff. Returns parsed JSON dict or None on final failure.
    """
    prompt = build_prompt()
    try:
        b64_image = encode_resized_image_to_base64(image_path)
    except Exception as e:
        print(f"[ERROR] Failed to read/resize image '{image_path}': {e}")
        return None

    last_error = None
    for attempt in range(1, RATE_LIMIT_MAX_RETRIES + 1):
        try:
            response = client.chat.completions.create(
                model=VISION_MODEL,
                temperature=0.1,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{b64_image}"
                                },
                            },
                        ],
                    }
                ],
            )
            # If we got here, call succeeded – break out of retry loop
            break

        except Exception as e:
            msg = str(e)
            last_error = e
            lower = msg.lower()

            # Detect rate limit / 429-ish errors
            if (
                "rate limit" in lower
                or "rate_limit_exceeded" in lower
                or "429" in msg
            ):
                # Try to respect "try again in XXXms" if present
                delay = 2.0 * attempt  # fallback exponential-ish backoff
                m = re.search(r"try again in (\d+)ms", msg)
                if m:
                    delay = int(m.group(1)) / 1000.0 + 0.5

                print(
                    f"[WARN] Rate limit for '{image_path}' "
                    f"(attempt {attempt}/{RATE_LIMIT_MAX_RETRIES}); "
                    f"sleeping {delay:.2f}s then retrying."
                )
                time.sleep(delay)
                continue  # retry

            # Any other kind of error = bail for this card
            print(f"[ERROR] OpenAI API call failed for '{image_path}': {e}")
            return None

    else:
        # We exhausted all retries
        print(
            f"[ERROR] Giving up on '{image_path}' after "
            f"{RATE_LIMIT_MAX_RETRIES} rate-limit retries. Last error: {last_error}"
        )
        return None

    # ----- Normal parsing below here -----

    raw_text = extract_text_from_chat_completion(response)
    if not raw_text:
        print(f"[ERROR] Empty model output for '{image_path}'")
        return None

    # Extract JSON
    if raw_text.startswith("{") and raw_text.endswith("}"):
        json_str = raw_text
    else:
        try:
            start = raw_text.index("{")
            end = raw_text.rindex("}") + 1
            json_str = raw_text[start:end]
        except ValueError:
            print(f"[ERROR] No JSON object found for '{image_path}':\n{raw_text}\n")
            return None

    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"[ERROR] Failed to parse JSON for '{image_path}': {e}\nRaw JSON:\n{json_str}\n")
        return None

    if not isinstance(data, dict):
        print(f"[ERROR] Parsed JSON is not an object for '{image_path}': {data}")
        return None

    # Defaults / normalization
    data.setdefault("card_name", os.path.basename(image_path))
    data.setdefault("card_type", "unknown")
    data.setdefault("hp", None)
    data.setdefault("fortress_hp", None)
    data.setdefault("attack", None)
    data.setdefault("attack_buff", None)
    data.setdefault("hp_buff", None)
    data.setdefault("misc_stat", None)
    data.setdefault("description", "")
    data.setdefault("has_special", False)
    data.setdefault("notes", "")

    for field in ["hp", "fortress_hp", "attack", "attack_buff", "hp_buff"]:
        val = data.get(field, None)
        if val in ("", None, "null"):
            data[field] = None
        else:
            try:
                data[field] = int(val)
            except (TypeError, ValueError):
                data["notes"] = (data.get("notes") or "") + f" | could not cast {field}='{val}' to int"
                data[field] = None

    ct = str(data.get("card_type", "")).lower()
    if "consumable" in ct:
        data["card_type"] = "item_consumable"
    elif "entity" in ct:
        data["card_type"] = "entity"
    elif "fortress" in ct or "fort" in ct:
        data["card_type"] = "fortress"
    elif "item" in ct:
        data["card_type"] = "item_regular"
    else:
        data["card_type"] = ct or "unknown"

    hs = data.get("has_special", False)
    if isinstance(hs, str):
        hs_l = hs.strip().lower()
        data["has_special"] = hs_l in ("true", "yes", "y", "1")
    else:
        data["has_special"] = bool(hs)

    data["filename"] = os.path.basename(image_path)
    return data


def find_images(root_dir: str) -> List[str]:
    paths: List[str] = []
    for entry in os.listdir(root_dir):
        path = os.path.join(root_dir, entry)
        if os.path.isfile(path):
            ext = os.path.splitext(entry)[1].lower()
            if ext in ALLOWED_EXTENSIONS:
                paths.append(path)
    paths.sort()
    return paths


def summarize_dataframe(df: pd.DataFrame) -> str:
    if df.empty:
        return "No card data to summarize."

    lines: List[str] = []
    lines.append("=== Card counts by type ===")
    counts = df["card_type"].value_counts(dropna=False)
    lines.append(counts.to_string())
    lines.append("")

    for field in NUMERIC_FIELDS:
        df[field] = pd.to_numeric(df[field], errors="coerce")

    summary_rows: List[Dict[str, Any]] = []

    for card_type, group in df.groupby("card_type"):
        for field in NUMERIC_FIELDS:
            s = group[field].dropna()
            n = int(s.count())
            if n == 0:
                continue
            mean = float(s.mean())
            std = float(s.std(ddof=1)) if n > 1 else 0.0
            sem = float(std / math.sqrt(n)) if n > 0 else 0.0
            summary_rows.append(
                {
                    "card_type": card_type,
                    "attribute": field,
                    "n": n,
                    "mean": mean,
                    "std": std,
                    "sem": sem,
                }
            )

    for field in NUMERIC_FIELDS:
        s = df[field].dropna()
        n = int(s.count())
        if n == 0:
            continue
        mean = float(s.mean())
        std = float(s.std(ddof=1)) if n > 1 else 0.0
        sem = float(std / math.sqrt(n)) if n > 0 else 0.0
        summary_rows.append(
            {
                "card_type": "ALL",
                "attribute": field,
                "n": n,
                "mean": mean,
                "std": std,
                "sem": sem,
            }
        )

    if not summary_rows:
        lines.append("No numeric attributes found.")
        return "\n".join(lines)

    summary_df = pd.DataFrame(summary_rows)
    summary_df = summary_df[["card_type", "attribute", "n", "mean", "std", "sem"]]

    lines.append("=== Attribute statistics (per card_type and overall) ===")
    lines.append(summary_df.to_string(index=False))
    return "\n".join(lines)


# ---------- ANALYSIS WINDOW ----------

class AnalysisWindow:
    def __init__(self, parent: tk.Tk, df: pd.DataFrame):
        self.parent = parent
        self.df = df.copy()
        for field in NUMERIC_FIELDS:
            self.df[field] = pd.to_numeric(self.df[field], errors="coerce")

        self.window = tk.Toplevel(parent)
        self.window.title("Card Stat Analysis")

        self._build_widgets()

    def _build_widgets(self):
        main = ttk.Frame(self.window, padding=10)
        main.grid(row=0, column=0, sticky="nsew")

        self.window.columnconfigure(0, weight=1)
        self.window.rowconfigure(0, weight=1)
        main.columnconfigure(1, weight=1)
        main.rowconfigure(1, weight=1)

        ttk.Label(main, text="Select stat:").grid(row=0, column=0, sticky="w")
        self.stat_var = tk.StringVar(value=NUMERIC_FIELDS[0])
        self.stat_combo = ttk.Combobox(main, textvariable=self.stat_var, values=NUMERIC_FIELDS, state="readonly")
        self.stat_combo.grid(row=0, column=1, sticky="w")
        self.stat_combo.bind("<<ComboboxSelected>>", lambda e: self.update_plot())

        # Matplotlib Figure
        self.fig = Figure(figsize=(6, 4), dpi=100)
        self.ax = self.fig.add_subplot(111)

        self.canvas = FigureCanvasTkAgg(self.fig, master=main)
        self.canvas_widget = self.canvas.get_tk_widget()
        self.canvas_widget.grid(row=1, column=0, columnspan=2, sticky="nsew", pady=(10, 0))

        # Stats text + card-type counts
        stats_frame = ttk.Frame(main)
        stats_frame.grid(row=2, column=0, columnspan=2, sticky="nsew", pady=(10, 0))
        stats_frame.columnconfigure(0, weight=1)
        stats_frame.columnconfigure(1, weight=1)

        ttk.Label(stats_frame, text="Summary stats:").grid(row=0, column=0, sticky="w")
        self.txt_stats = tk.Text(stats_frame, width=50, height=6, wrap="word")
        self.txt_stats.grid(row=1, column=0, sticky="nsew")
        stats_scroll = ttk.Scrollbar(stats_frame, orient="vertical", command=self.txt_stats.yview)
        stats_scroll.grid(row=1, column=0, sticky="nse")
        self.txt_stats["yscrollcommand"] = stats_scroll.set

        ttk.Label(stats_frame, text="Card type counts:").grid(row=0, column=1, sticky="w")
        self.txt_counts = tk.Text(stats_frame, width=30, height=6, wrap="word")
        self.txt_counts.grid(row=1, column=1, sticky="nsew")
        counts_scroll = ttk.Scrollbar(stats_frame, orient="vertical", command=self.txt_counts.yview)
        counts_scroll.grid(row=1, column=1, sticky="nse")
        self.txt_counts["yscrollcommand"] = counts_scroll.set

        self.update_counts_text()
        self.update_plot()

    def update_counts_text(self):
        self.txt_counts.delete("1.0", "end")
        counts = self.df["card_type"].value_counts(dropna=False)
        self.txt_counts.insert("end", counts.to_string())

    def update_plot(self):
        stat = self.stat_var.get()
        s = self.df[stat].dropna()

        self.ax.clear()
        if s.empty:
            self.ax.set_title(f"No data for {stat}")
            self.canvas.draw()
            self.txt_stats.delete("1.0", "end")
            self.txt_stats.insert("end", f"No data for {stat}\n")
            return

        # Histogram
        self.ax.hist(s.values, bins="auto", alpha=0.7, edgecolor="black", density=True, label="Data")

        # Fit normal
        mean = float(s.mean())
        std = float(s.std(ddof=1)) if len(s) > 1 else 0.0
        if std > 0:
            x = np.linspace(s.min(), s.max(), 200)
            norm_pdf = 1.0 / (std * math.sqrt(2 * math.pi)) * np.exp(-0.5 * ((x - mean) / std) ** 2)
            self.ax.plot(x, norm_pdf, linestyle="--", label="Fitted normal")

        self.ax.axvline(mean, linestyle=":", label=f"mean={mean:.2f}")
        self.ax.set_xlabel(stat)
        self.ax.set_ylabel("Density")
        self.ax.set_title(f"Distribution of {stat}")
        self.ax.legend()
        self.canvas.draw()

        # Stats text
        n = int(s.count())
        sem = float(std / math.sqrt(n)) if (n > 0 and std > 0) else 0.0
        self.txt_stats.delete("1.0", "end")
        self.txt_stats.insert(
            "end",
            f"Stat: {stat}\nN = {n}\nMean = {mean:.3f}\nStd = {std:.3f}\nSEM = {sem:.3f}\n"
        )


# ---------- MAIN GUI ----------

class CardAnalyzerGUI:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Card OCR Analyzer (Fast)")

        self.folder_path: Optional[str] = None
        self.image_paths: List[str] = []

        self._build_widgets()

    def _build_widgets(self):
        main = ttk.Frame(self.root, padding=10)
        main.grid(row=0, column=0, sticky="nsew")

        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main.columnconfigure(1, weight=1)
        main.rowconfigure(3, weight=1)

        btn_select = ttk.Button(main, text="Select Image Folder", command=self.select_folder)
        btn_select.grid(row=0, column=0, sticky="w")

        self.lbl_folder = ttk.Label(main, text="No folder selected", width=60)
        self.lbl_folder.grid(row=0, column=1, sticky="w", padx=(10, 0))

        self.btn_start = ttk.Button(main, text="Run Analysis", command=self.start_analysis, state="disabled")
        self.btn_start.grid(row=1, column=0, pady=(10, 5), sticky="w")

        self.progress = ttk.Progressbar(main, orient="horizontal", mode="determinate", length=300)
        self.progress.grid(row=1, column=1, sticky="w", padx=(10, 0))

        self.lbl_status = ttk.Label(main, text="Idle")
        self.lbl_status.grid(row=2, column=0, columnspan=2, sticky="w", pady=(5, 5))

        self.txt_log = tk.Text(main, width=100, height=25, wrap="word")
        self.txt_log.grid(row=3, column=0, columnspan=2, sticky="nsew", pady=(10, 0))

        scroll = ttk.Scrollbar(main, orient="vertical", command=self.txt_log.yview)
        scroll.grid(row=3, column=2, sticky="ns", pady=(10, 0))
        self.txt_log["yscrollcommand"] = scroll.set

    def log(self, message: str):
        self.txt_log.insert("end", message + "\n")
        self.txt_log.see("end")
        self.root.update_idletasks()

    def select_folder(self):
        path = filedialog.askdirectory(title="Select folder with card images")
        if not path:
            return
        self.folder_path = path
        self.lbl_folder.config(text=path)
        self.image_paths = find_images(path)
        if not self.image_paths:
            messagebox.showwarning("No images found", "No image files found in that folder.")
            self.btn_start.config(state="disabled")
        else:
            self.btn_start.config(state="normal")
            self.log(f"Selected folder: {path}")
            self.log(f"Found {len(self.image_paths)} image(s).")

    def start_analysis(self):
        if not self.folder_path:
            messagebox.showerror("No folder selected", "Please select an image folder first.")
            return
        if not self.image_paths:
            messagebox.showerror("No images", "No image files found in the selected folder.")
            return

        self.btn_start.config(state="disabled")
        self.lbl_status.config(text="Starting analysis...")
        self.progress["value"] = 0
        self.progress["maximum"] = len(self.image_paths)
        self.log("Starting analysis...")

        thread = threading.Thread(target=self._run_analysis_thread, daemon=True)
        thread.start()

    def _run_analysis_thread(self):
        folder = self.folder_path
        assert folder is not None

        existing_records: Dict[str, Dict[str, Any]] = {}
        csv_path_folder = os.path.join(folder, "card_data.csv")
        if os.path.exists(csv_path_folder):
            try:
                existing_df = pd.read_csv(csv_path_folder)
                if "filename" in existing_df.columns:
                    for _, row in existing_df.iterrows():
                        existing_records[str(row["filename"])] = row.to_dict()
                    self.root.after(0, lambda: self.log(
                        f"Loaded {len(existing_records)} existing records from card_data.csv"))
            except Exception as e:
                self.root.after(0, lambda: self.log(f"[WARN] Failed to load existing CSV: {e}"))

        new_paths: List[str] = []
        reused_count = 0
        for p in self.image_paths:
            fname = os.path.basename(p)
            if fname in existing_records:
                reused_count += 1
            else:
                new_paths.append(p)

        if reused_count:
            self.root.after(0, lambda: self.log(f"Reusing data for {reused_count} card(s) from existing CSV."))

        records: List[Dict[str, Any]] = list(existing_records.values())
        total = len(self.image_paths)
        processed = 0

        self.root.after(0, lambda: self.progress.config(maximum=total, value=processed))

        def update_status_local():
            self.lbl_status.config(text=f"Processed {processed}/{total} cards")

        # Parallel processing
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            future_to_path = {executor.submit(call_openai_vision, path): path for path in new_paths}

            for future in as_completed(future_to_path):
                path = future_to_path[future]
                fname = os.path.basename(path)
                try:
                    data = future.result()
                except Exception as e:
                    data = None
                    msg = f"[ERROR] Exception while processing '{fname}': {e}"
                    self.root.after(0, lambda m=msg: self.log(m))

                if data is None:
                    msg = f"[WARN] Skipping '{fname}' due to errors."
                    self.root.after(0, lambda m=msg: self.log(m))
                else:
                    records.append(data)
                    msg = f"[OK] Parsed '{fname}' as {data.get('card_type')}."
                    self.root.after(0, lambda m=msg: self.log(m))

                processed += 1
                self.root.after(0, self.progress.step, 1)
                self.root.after(0, update_status_local)

        processed = total
        self.root.after(0, self.progress.config, {"value": total})
        self.root.after(0, self.lbl_status.config, {"text": f"Processed {processed}/{total} cards"})

        def finalize():
            if not records:
                self.lbl_status.config(text="Finished (no records).")
                self.btn_start.config(state="normal")
                self.log("No records were successfully parsed.")
                return

            df = pd.DataFrame(records)

            # Normalize has_special to Y/N
            if "has_special" in df.columns:
                df["has_special"] = df["has_special"].apply(lambda x: "Y" if bool(x) else "N")

            preferred_cols = [
                "filename",
                "card_name",
                "card_type",
                "hp",
                "fortress_hp",
                "attack",
                "attack_buff",
                "hp_buff",
                "misc_stat",
                "description",
                "has_special",
                "notes",
            ]
            cols = [c for c in preferred_cols if c in df.columns] + [c for c in df.columns if c not in preferred_cols]
            df = df[cols]

            # Write CSV to selected folder
            try:
                df.to_csv(csv_path_folder, index=False)
                self.log("")
                self.log(f"Wrote card data for {len(df)} cards to: {csv_path_folder}")
            except Exception as e:
                self.log(f"[ERROR] Failed to write CSV to folder: {e}")

            # Also write CSV to current working directory
            try:
                folder_name = os.path.basename(os.path.abspath(folder))
                csv_path_cwd = os.path.join(os.getcwd(), f"card_data_{folder_name}.csv")
                df.to_csv(csv_path_cwd, index=False)
                self.log(f"Also wrote card data to: {csv_path_cwd}")
            except Exception as e:
                self.log(f"[ERROR] Failed to write CSV to cwd: {e}")

            summary = summarize_dataframe(df.copy())
            self.log("")
            self.log(summary)

            # Open analysis window with plots
            AnalysisWindow(self.root, df)

            self.lbl_status.config(text="Analysis complete.")
            self.btn_start.config(state="normal")
            messagebox.showinfo("Done", f"Analysis complete.\nCSV written to:\n{csv_path_folder}")

        self.root.after(0, finalize)


def main():
    root = tk.Tk()
    app = CardAnalyzerGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
