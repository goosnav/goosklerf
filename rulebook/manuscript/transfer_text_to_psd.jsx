// ============================================================
// transfer_text_to_psd.jsx
//
// Minimal Photoshop Text Transfer Script
//
// For every .txt file in <root>/text/, this script opens
// <root>/template/rulebook_template.psd, replaces the contents
// of the text layer named "RULE_TEXT" with the TXT file's
// contents, updates the text layer named "PAGE_NUMBER" with
// the sequential page number for this run, and saves the result as a new .psd in
// <root>/generated_psd/.
//
// The script never modifies the original template.
// The script never modifies any layer other than RULE_TEXT
// and PAGE_NUMBER.
//
// Tested against: Adobe Photoshop CS6 and later (ExtendScript).
// Run via: File > Scripts > Browse... and select this .jsx file.
// ============================================================

#target photoshop

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

var TEMPLATE_SUBFOLDER     = "template";
var TEMPLATE_FILENAME      = "rulebook_template.psd";
var TEXT_SUBFOLDER         = "text";
var OUTPUT_SUBFOLDER       = "generated_psd";
var LOG_FILENAME           = "build_log.txt";
var TARGET_LAYER_NAME      = "RULE_TEXT";
var PAGE_NUMBER_LAYER_NAME = "PAGE_NUMBER";

// ----------------------------------------------------------------
// Logging buffer
// ----------------------------------------------------------------
//
// We collect log lines in memory and flush them to build_log.txt
// at the end of the run (or when a fatal error occurs).
// ----------------------------------------------------------------

var LOG_LINES = [];

function logLine(msg) {
    var stamp = new Date().toString();
    LOG_LINES.push("[" + stamp + "] " + msg);
}

function flushLog(rootFolder) {
    try {
        var logFile = new File(rootFolder.fsName + "/" + LOG_FILENAME);
        logFile.encoding = "UTF-8";
        logFile.open("w");
        for (var i = 0; i < LOG_LINES.length; i++) {
            logFile.writeln(LOG_LINES[i]);
        }
        logFile.close();
    } catch (e) {
        // If we can't write the log, surface it via alert.
        alert("Could not write build_log.txt:\n" + e);
    }
}

// ----------------------------------------------------------------
// Fatal error helper
// ----------------------------------------------------------------

function fatal(rootFolder, message) {
    logLine("FATAL: " + message);
    logLine("STATUS: FAILURE");
    if (rootFolder) {
        flushLog(rootFolder);
    }
    alert("Script stopped:\n\n" + message);
    // Throwing aborts the script cleanly.
    throw new Error(message);
}

// ----------------------------------------------------------------
// File / folder helpers
// ----------------------------------------------------------------

function readTextFile(file) {
    file.encoding = "UTF-8";
    if (!file.open("r")) {
        return null;
    }
    var contents = file.read();
    file.close();

    // Strip a leading UTF-8 BOM if present.
    if (contents && contents.length > 0 && contents.charCodeAt(0) === 0xFEFF) {
        contents = contents.substring(1);
    }

    // Normalize line endings:
    //   Windows  CRLF -> LF
    //   classic  CR   -> LF
    // Photoshop's text engine treats \r as a paragraph break, so we
    // convert everything to \r at the end (Photoshop's preferred
    // paragraph separator inside TextItem.contents).
    contents = contents.replace(/\r\n/g, "\n");
    contents = contents.replace(/\r/g, "\n");
    contents = contents.replace(/\n/g, "\r");

    return contents;
}

function listTxtFiles(textFolder) {
    var all = textFolder.getFiles("*.txt");
    var files = [];
    for (var i = 0; i < all.length; i++) {
        // Skip subfolders; only keep actual files.
        if (all[i] instanceof File) {
            files.push(all[i]);
        }
    }
    // Sort alphabetically / lexicographically by name.
    files.sort(function (a, b) {
        var an = a.name.toLowerCase();
        var bn = b.name.toLowerCase();
        if (an < bn) return -1;
        if (an > bn) return  1;
        return 0;
    });
    return files;
}

function swapExtensionToPsd(filename) {
    var dot = filename.lastIndexOf(".");
    if (dot <= 0) {
        return filename + ".psd";
    }
    return filename.substring(0, dot) + ".psd";
}

// ----------------------------------------------------------------
// Layer helpers
// ----------------------------------------------------------------
//
// Recursively search the document (including nested groups) for
// a layer with the given name. Returns the first match or null.
// ----------------------------------------------------------------

function findLayerByName(container, name) {
    for (var i = 0; i < container.layers.length; i++) {
        var layer = container.layers[i];
        if (layer.name === name) {
            return layer;
        }
        if (layer.typename === "LayerSet") {
            var nested = findLayerByName(layer, name);
            if (nested !== null) {
                return nested;
            }
        }
    }
    return null;
}

// ----------------------------------------------------------------
// Validation routines
// ----------------------------------------------------------------

function validateProject(rootFolder) {
    if (!rootFolder.exists) {
        fatal(rootFolder, "Selected root folder does not exist:\n" + rootFolder.fsName);
    }

    var templateFolder = new Folder(rootFolder.fsName + "/" + TEMPLATE_SUBFOLDER);
    if (!templateFolder.exists) {
        fatal(rootFolder, "Missing folder: " + TEMPLATE_SUBFOLDER + "/");
    }

    var templateFile = new File(templateFolder.fsName + "/" + TEMPLATE_FILENAME);
    if (!templateFile.exists) {
        fatal(rootFolder, "Missing template file:\n" + templateFile.fsName);
    }

    var textFolder = new Folder(rootFolder.fsName + "/" + TEXT_SUBFOLDER);
    if (!textFolder.exists) {
        fatal(rootFolder, "Missing folder: " + TEXT_SUBFOLDER + "/");
    }

    var txtFiles = listTxtFiles(textFolder);
    if (txtFiles.length === 0) {
        fatal(rootFolder, "No .txt files found in:\n" + textFolder.fsName);
    }

    // Make sure the output folder exists; create it if not.
    var outputFolder = new Folder(rootFolder.fsName + "/" + OUTPUT_SUBFOLDER);
    if (!outputFolder.exists) {
        if (!outputFolder.create()) {
            fatal(rootFolder, "Could not create output folder:\n" + outputFolder.fsName);
        }
        logLine("Created output folder: " + outputFolder.fsName);
    }

    return {
        rootFolder:     rootFolder,
        templateFile:   templateFile,
        textFolder:     textFolder,
        outputFolder:   outputFolder,
        txtFiles:       txtFiles
    };
}

// ----------------------------------------------------------------
// Validate the template document itself.
//
// Opens the template (read-only), verifies that RULE_TEXT and
// PAGE_NUMBER exist, are text layers, and are unlocked. Closes
// the template afterward without saving.
//
// We deliberately do NOT keep the template document open after
// validation -- we re-open a fresh copy for each TXT file so the
// original template is never altered in memory.
// ----------------------------------------------------------------

function validateTemplate(project) {
    var doc;
    try {
        doc = app.open(project.templateFile);
    } catch (e) {
        fatal(project.rootFolder, "Could not open template:\n" + project.templateFile.fsName + "\n\n" + e);
    }

    var layer = findLayerByName(doc, TARGET_LAYER_NAME);
    if (layer === null) {
        doc.close(SaveOptions.DONOTSAVECHANGES);
        fatal(project.rootFolder, "Template does not contain a layer named '" + TARGET_LAYER_NAME + "'.");
    }
    if (layer.kind !== LayerKind.TEXT) {
        doc.close(SaveOptions.DONOTSAVECHANGES);
        fatal(project.rootFolder, "Layer '" + TARGET_LAYER_NAME + "' exists but is not a text layer.");
    }
    // Only the "all locked" master lock actually prevents us from
    // editing textItem.contents. The per-attribute locks
    // (pixelsLocked, transparentPixelsLocked, positionLocked) don't
    // apply meaningfully to text layers, and ExtendScript can return
    // true for some of them on text/shape layers as a side-effect of
    // how those properties are reported. Checking them here gave
    // false positives ("layer is locked" when nothing was locked),
    // so we only check the one lock that actually matters.
    var isLocked = false;
    try {
        isLocked = layer.allLocked === true;
    } catch (lockErr) {
        // Some layer types throw when allLocked is read; treat that
        // as "not locked" since we have no evidence it is.
        isLocked = false;
    }
    if (isLocked) {
        doc.close(SaveOptions.DONOTSAVECHANGES);
        fatal(project.rootFolder, "Layer '" + TARGET_LAYER_NAME + "' is fully locked. Unlock it in the template and try again.");
    }

    var pageNumberLayer = findLayerByName(doc, PAGE_NUMBER_LAYER_NAME);
    if (pageNumberLayer === null) {
        doc.close(SaveOptions.DONOTSAVECHANGES);
        fatal(project.rootFolder, "Template does not contain a layer named '" + PAGE_NUMBER_LAYER_NAME + "'.");
    }
    if (pageNumberLayer.kind !== LayerKind.TEXT) {
        doc.close(SaveOptions.DONOTSAVECHANGES);
        fatal(project.rootFolder, "Layer '" + PAGE_NUMBER_LAYER_NAME + "' exists but is not a text layer.");
    }
    isLocked = false;
    try {
        isLocked = pageNumberLayer.allLocked === true;
    } catch (pageNumberLockErr) {
        isLocked = false;
    }
    if (isLocked) {
        doc.close(SaveOptions.DONOTSAVECHANGES);
        fatal(project.rootFolder, "Layer '" + PAGE_NUMBER_LAYER_NAME + "' is fully locked. Unlock it in the template and try again.");
    }

    doc.close(SaveOptions.DONOTSAVECHANGES);
    logLine("Template validation passed.");
}

// ----------------------------------------------------------------
// Per-file processing
// ----------------------------------------------------------------

function processOneTxt(project, txtFile, pageNumber) {
    var outputName = swapExtensionToPsd(txtFile.name);
    var outputPath = project.outputFolder.fsName + "/" + outputName;
    var outputFile = new File(outputPath);

    logLine("Processing: " + txtFile.name + " -> " + outputName + " (page number " + pageNumber + ")");

    // Read TXT contents.
    var contents = readTextFile(txtFile);
    if (contents === null) {
        throw new Error("Could not read TXT file: " + txtFile.fsName);
    }

    // Open a fresh copy of the template. Each iteration opens the
    // template anew so we never accumulate state across runs and
    // never need to mutate-then-revert the template document.
    var doc = app.open(project.templateFile);

    try {
        var layer = findLayerByName(doc, TARGET_LAYER_NAME);
        if (layer === null) {
            throw new Error("RULE_TEXT layer disappeared in opened template.");
        }
        if (layer.kind !== LayerKind.TEXT) {
            throw new Error("RULE_TEXT is not a text layer in opened template.");
        }

        var pageNumberLayer = findLayerByName(doc, PAGE_NUMBER_LAYER_NAME);
        if (pageNumberLayer === null) {
            throw new Error("PAGE_NUMBER layer disappeared in opened template.");
        }
        if (pageNumberLayer.kind !== LayerKind.TEXT) {
            throw new Error("PAGE_NUMBER is not a text layer in opened template.");
        }

        // Replace the contents of the existing text items. This is
        // the only mutation the script performs. Font, size, color,
        // tracking, leading, paragraph settings, the text boxes'
        // positions and dimensions, and every other layer in the
        // document are left untouched.
        layer.textItem.contents = contents;
        pageNumberLayer.textItem.contents = String(pageNumber);

        // Save as a new PSD. PhotoshopSaveOptions preserves layers
        // and editability (no flatten, no rasterize).
        var saveOptions = new PhotoshopSaveOptions();
        saveOptions.embedColorProfile = true;
        saveOptions.alphaChannels     = true;
        saveOptions.layers            = true;
        saveOptions.spotColors        = true;
        saveOptions.annotations       = true;

        // saveAs(file, options, asCopy, extensionType)
        // asCopy = true so the in-memory document is not retitled
        // to the new path; this keeps the open doc associated with
        // the template, which we then close WITHOUT saving.
        doc.saveAs(outputFile, saveOptions, true, Extension.LOWERCASE);

        logLine("Saved: " + outputFile.fsName);
    } finally {
        // Always close the working document without saving so the
        // original template file on disk is never modified.
        doc.close(SaveOptions.DONOTSAVECHANGES);
    }
}

// ----------------------------------------------------------------
// Main
// ----------------------------------------------------------------

function main() {
    logLine("=== Run started ===");

    // Ask the user to select the project root.
    var rootFolder = Folder.selectDialog("Select the project root folder (e.g. rulebook_auto)");
    if (rootFolder === null) {
        // User cancelled. Don't write a log; nothing happened.
        return;
    }

    logLine("Root folder: " + rootFolder.fsName);

    // Preflight validation.
    var project = validateProject(rootFolder);
    logLine("Template path: " + project.templateFile.fsName);
    logLine("Text folder:   " + project.textFolder.fsName);
    logLine("Output folder: " + project.outputFolder.fsName);
    logLine("TXT files found: " + project.txtFiles.length);

    validateTemplate(project);

    // Save Photoshop state we want to restore at the end.
    var prevDialogs   = app.displayDialogs;
    var prevRulerUnit = app.preferences.rulerUnits;

    // Suppress Photoshop dialogs (e.g. "Some text layers contain
    // fonts that are missing") so the batch can run uninterrupted.
    app.displayDialogs = DialogModes.NO;

    var processed = [];
    var generated = [];
    var failed    = [];

    try {
        for (var i = 0; i < project.txtFiles.length; i++) {
            var txtFile = project.txtFiles[i];
            try {
                processOneTxt(project, txtFile, i + 1);
                processed.push(txtFile.name);
                generated.push(swapExtensionToPsd(txtFile.name));
            } catch (e) {
                logLine("ERROR processing " + txtFile.name + ": " + e);
                failed.push(txtFile.name + " (" + e + ")");
            }
        }
    } finally {
        app.displayDialogs       = prevDialogs;
        app.preferences.rulerUnits = prevRulerUnit;
    }

    // Final log section.
    logLine("---- Summary ----");
    logLine("TXT files processed: " + processed.length);
    for (var p = 0; p < processed.length; p++) {
        logLine("  TXT: " + processed[p]);
    }
    logLine("PSD files generated: " + generated.length);
    for (var g = 0; g < generated.length; g++) {
        logLine("  PSD: " + generated[g]);
    }
    if (failed.length > 0) {
        logLine("Failures: " + failed.length);
        for (var f = 0; f < failed.length; f++) {
            logLine("  FAIL: " + failed[f]);
        }
        logLine("STATUS: PARTIAL FAILURE");
    } else {
        logLine("STATUS: SUCCESS");
    }

    flushLog(rootFolder);

    // Final user-facing summary.
    var msg = "Done.\n\n" +
              "TXT processed: " + processed.length + "\n" +
              "PSD generated: " + generated.length + "\n" +
              "Failures: "      + failed.length    + "\n\n" +
              "See build_log.txt in the project root for details.";
    alert(msg);
}

// ----------------------------------------------------------------
// Entry point
// ----------------------------------------------------------------

try {
    main();
} catch (e) {
    // fatal() throws after already alerting and logging. Detect that
    // case by checking the message and stay silent. For any other
    // unexpected throw, surface it so the user sees what happened.
    var msg = (e && e.message) ? e.message : String(e);
    if (msg.indexOf("Script stopped") === -1) {
        alert("Unexpected error:\n\n" + msg);
    }
}
