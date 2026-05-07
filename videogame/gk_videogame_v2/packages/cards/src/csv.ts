/**
 * Minimal CSV reader for the card data file.
 *
 * Hand-rolled because we want zero dependencies in this hot path and the CSV
 * is well-formed (no embedded newlines in fields). If the source CSV ever
 * gains complex edge cases, replace this with a real library — but the
 * current approach has been validated against card_data-003.csv.
 */

import { readFileSync } from "node:fs";

export type CsvRow = Record<string, string>;

/** Parse a CSV file into an array of header-keyed rows. */
export function parseCsvFile(filePath: string): CsvRow[] {
  const text = readFileSync(filePath, "utf-8");
  return parseCsvText(text);
}

export function parseCsvText(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]!).map((h) => h.replace(/^"|"$/g, "").trim());
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i]!);
    const row: CsvRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = (fields[j] ?? "").replace(/^"|"$/g, "");
    }
    rows.push(row);
  }
  return rows;
}

/** Split one CSV line, respecting double-quoted fields containing commas. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') inQuote = !inQuote;
    else if (ch === "," && !inQuote) {
      fields.push(current.trim());
      current = "";
    } else current += ch;
  }
  fields.push(current.trim());
  return fields;
}
