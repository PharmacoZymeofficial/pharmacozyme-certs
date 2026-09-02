// Google Apps Script for PZ Certificate System
// Deploy as Web App: Execute as "Me" and access "Anyone"

// ===== CONFIGURATION =====
const SHEET_ID = "YOUR_SHEET_ID"; // Will be set dynamically
const DRIVE_FOLDER_NAME = "PZ Certificates";
const DRIVE_FOLDER_ID = "1Bqi4XvZ3d3S0bcrSQhDazUGGGwjArqQW"; // Specific folder
const TEMPLATES_FOLDER_ID = "1jgT-ANk6lrp1gE_OkYx2WY8tBB-arTWl"; // Certificate templates folder

// ===== AUTHORIZATION =====
// Run this ONE function manually from the Apps Script editor (select "grantPermissions"
// in the function dropdown, click ▶ Run) any time you see "Access denied: DriveApp" or
// similar from the deployed web app. Deploying a web app does NOT grant it permissions —
// only running a function yourself, once, and approving the OAuth consent screen does.
// This touches every service the script uses (Drive, Sheets) so one approval covers all
// of them; it's read-only / self-cleaning and safe to run repeatedly.
function grantPermissions() {
  // Drive: read access + the specific folders this script writes into.
  DriveApp.getRootFolder();
  DriveApp.getFolderById(DRIVE_FOLDER_ID);
  DriveApp.getFolderById(TEMPLATES_FOLDER_ID);

  // Drive write: create + immediately trash a throwaway file (no lasting trace).
  const probe = DriveApp.createFile("permission-check.tmp", "ok");
  probe.setTrashed(true);

  // Sheets: create + immediately trash a throwaway spreadsheet.
  const sheetProbe = SpreadsheetApp.create("permission-check.tmp");
  DriveApp.getFileById(sheetProbe.getId()).setTrashed(true);

  Logger.log("All permissions granted successfully.");
}

// ===== WEB APP HANDLERS =====

// The web app is deployed with access "Anyone" (required for the Next.js app to reach
// it from serverless functions with no Google identity). That also means anyone who
// learns the deployment URL can call it. APPS_SCRIPT_SECRET is the actual authentication
// layer: set it once via Project Settings, Script Properties (key: APPS_SCRIPT_SECRET),
// and set the same value as the Next.js APPS_SCRIPT_SECRET env var.
function isAuthorized(payload) {
  const expected = PropertiesService.getScriptProperties().getProperty("APPS_SCRIPT_SECRET");
  // No secret configured yet: allow through so an existing deployment is not bricked by
  // this change alone, but log loudly so it does not stay this way.
  if (!expected) {
    console.warn("APPS_SCRIPT_SECRET is not set in Script Properties -- requests are not authenticated.");
    return true;
  }
  return payload && payload.secret === expected;
}

function doPost(e) {
  try {
    let action, payload;
    
    if (e.postData && e.postData.contents) {
      try {
        const json = JSON.parse(e.postData.contents);
        action = json.action;
        payload = json;
      } catch {
        action = e.parameter.action;
        payload = e.parameter;
      }
    } else {
      action = e.parameter.action;
      payload = e.parameter;
    }

    if (!isAuthorized(payload)) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: "Unauthorized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    console.log("Received action:", action);
    
    let result;
    
    switch (action) {
      case "createSheet":
        result = createNewSheet(payload);
        break;
      case "linkSheet":
        result = linkSheet(payload);
        break;
      case "syncData":
        result = syncData(payload);
        break;
      case "uploadPDF":
        result = uploadPDF(payload);
        break;
      case "deletePDF":
        result = deletePDF(payload);
        break;
      case "deleteFolder":
        result = deleteFolder(payload);
        break;
      case "consolidateFolders":
        result = consolidateFolders(payload);
        break;
      case "pruneFolderDuplicates":
        result = pruneFolderDuplicates(payload);
        break;
      case "ensurePublic":
        result = ensurePublic(payload);
        break;
      case "getTabs":
        result = getSheetTabs(payload);
        break;
      case "deleteRows":
        result = deleteRows(payload);
        break;
      case "uploadTemplate":
        result = uploadTemplate(payload);
        break;
      case "deleteTemplate":
        result = deleteTemplate(payload);
        break;
      case "getFolder":
        result = getFolder(payload);
        break;
      case "updateCertIds":
        result = updateCertIds(payload);
        break;
      case "upsertRow":
        result = upsertRow(payload);
        break;
      case "clearCertIdsByEmail":
        result = clearCertIdsByEmail(payload);
        break;
      default:
        throw new Error("Unknown action: " + action);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    const payload = e.parameter;

    if (!isAuthorized(payload)) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: "Unauthorized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "getTabs") {
      return getSheetTabs(payload);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({ message: "Use POST method" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== SHEET OPERATIONS =====

function createNewSheet(payload) {
  const { databaseName, subDatabases } = payload;
  
  // Create new spreadsheet
  const spreadsheet = SpreadsheetApp.create(databaseName + " - Certificates");
  // Best-effort: a domain sharing policy can reject "anyone with the link" even
  // though the spreadsheet itself was created fine — don't let that undo the create.
  try {
    DriveApp.getFileById(spreadsheet.getId()).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
  } catch (sharingErr) {
    console.error("Sheet created but sharing failed:", sharingErr.message);
  }
  const ssId = spreadsheet.getId();
  
  // Create tabs for each sub-database
  if (subDatabases && subDatabases.length > 0) {
    subDatabases.forEach((tabName, index) => {
      if (index === 0) {
        // Rename first sheet
        spreadsheet.getSheets()[0].setName(tabName);
      } else {
        spreadsheet.insertSheet(tabName);
      }
    });
  } else {
    // Default tab
    spreadsheet.getSheets()[0].setName("Participants");
  }
  
  // Add headers to first sheet
  const sheet = spreadsheet.getSheets()[0];
  addHeaders(sheet);
  
  return {
    success: true,
    spreadsheetId: ssId,
    spreadsheetUrl: spreadsheet.getUrl(),
    tabs: subDatabases || ["Participants"]
  };
}

function linkSheet(payload) {
  const { spreadsheetId, tabName } = payload;
  
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(tabName);
  
  if (!sheet) {
    // Create the tab if it doesn't exist
    spreadsheet.insertSheet(tabName);
    addHeaders(spreadsheet.getSheetByName(tabName));
  }
  
  return {
    success: true,
    spreadsheetId: spreadsheetId,
    spreadsheetUrl: spreadsheet.getUrl(),
    tabName: tabName
  };
}

function addHeaders(sheet) {
  const headers = [
    "Certificate ID",
    "Name",
    "Email", 
    "Certificate URL",
    "Status",
    "Issue Date",
    "Emailed",
    "Drive Link",
    "Created At"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sheet.autoResizeColumns(1, headers.length);
}

function getSheetTabs(payload) {
  const { spreadsheetId } = payload;
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheets = spreadsheet.getSheets();
  
  return {
    success: true,
    tabs: sheets.map(s => s.getName())
  };
}

// ===== DATA SYNC =====

// Hand-kept port of lib/sheetSchema.ts — keep the alias table identical.
var MANAGED_ALIASES_ = {
  "name": "name", "recipient name": "name", "recipient": "name", "full name": "name",
  "email": "email", "email address": "email", "e-mail": "email",
  "certificate id": "certificateId", "cert id": "certificateId",
  "certificate no": "certificateId", "certificate number": "certificateId",
  "certificate url": "certificateUrl", "certificate link": "certificateUrl",
  "verification url": "certificateUrl", "verify url": "certificateUrl",
  "status": "status",
  "issue date": "issueDate", "issued": "issueDate", "date issued": "issueDate", "issued on": "issueDate",
  "emailed": "emailSent", "email sent": "emailSent", "email status": "emailSent",
  "drive link": "driveLink", "drive url": "driveLink", "pdf link": "driveLink", "certificate pdf": "driveLink",
  "created at": "createdAt", "created": "createdAt", "date created": "createdAt"
};
var MANAGED_LABELS_ = {
  name: "Name", email: "Email", certificateId: "Certificate ID", certificateUrl: "Certificate URL",
  status: "Status", issueDate: "Issue Date", emailSent: "Emailed", driveLink: "Drive Link", createdAt: "Created At"
};
function normalizeHeader_(h) {
  return String(h == null ? "" : h).replace(/\*+$/, "").replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ").toLowerCase();
}
function resolveManagedField_(h) {
  var n = normalizeHeader_(h);
  if (!n) return null;
  return MANAGED_ALIASES_[n] || null;
}
function formatCell_(cell) {
  return Object.prototype.toString.call(cell) === "[object Date]"
    ? Utilities.formatDate(cell, Session.getScriptTimeZone(), "MMM d, yyyy")
    : cell;
}

function syncData(payload) {
  const { spreadsheetId, tabName, data, mode, writeHeaders, headers } = payload;

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(tabName);

  if (!sheet) {
    throw new Error("Sheet tab not found: " + tabName);
  }

  if (mode === "write") {
    // Write headers if explicitly provided
    if (writeHeaders && headers && headers.length > 0) {
      const headerLabels = [
        "Certificate ID",
        "Name",
        "Email",
        "Certificate URL",
        "Status",
        "Issue Date",
        "Emailed",
        "Drive Link",
        "Created At"
      ];
      sheet.getRange(1, 1, 1, headerLabels.length).setValues([headerLabels]);
      sheet.getRange(1, 1, 1, headerLabels.length).setFontWeight("bold");
      sheet.autoResizeColumns(1, headerLabels.length);
    }

    // Write data to Sheet
    const rows = data.map(p => [
      p.certificateId || "",
      p.name || "",
      p.email || "",
      p.certificateUrl || "",
      p.status || "pending",
      p.issueDate || "",
      p.emailSent ? "Yes" : "No",
      p.driveLink || "",
      p.createdAt || ""
    ]);

    // Clear existing data (keep headers)
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 9).clearContent();
    }

    // Write new data
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }

    return { success: true, rowsWritten: rows.length };
    
  } else if (mode === "read") {
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow <= 1 || lastCol < 1) {
      return { success: true, data: [] };
    }

    var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var managed = {};   // field -> col index (0-based)
    var customCols = []; // { header, index }
    for (var c = 0; c < headerRow.length; c++) {
      var header = String(headerRow[c] == null ? "" : headerRow[c]).replace(/^\s+|\s+$/g, "");
      if (!header) continue;
      var mf = resolveManagedField_(header);
      if (mf) { if (managed[mf] === undefined) managed[mf] = c; }
      else {
        var already = false;
        for (var k = 0; k < customCols.length; k++) if (customCols[k].header === header) already = true;
        if (!already) customCols.push({ header: header, index: c });
      }
    }

    var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    // `let` (block-scoped) avoids colliding with the function-scoped `data`
    // destructured from payload at the top of syncData.
    let data = values.map(function (row) {
      function m(field) { return managed[field] === undefined ? "" : formatCell_(row[managed[field]]); }
      var rec = {
        name: m("name"),
        email: m("email"),
        certificateId: m("certificateId"),
        certificateUrl: m("certificateUrl"),
        status: m("status"),
        issueDate: m("issueDate"),
        emailSent: m("emailSent") === "Yes" || m("emailSent") === true,
        driveLink: m("driveLink"),
        createdAt: m("createdAt"),
        custom: {}
      };
      for (var j = 0; j < customCols.length; j++) {
        var v = formatCell_(row[customCols[j].index]);
        if (v !== "" && v !== null && v !== undefined) rec.custom[customCols[j].header] = String(v);
      }
      return rec;
    });

    return { success: true, data: data };
  }

  return { success: false, error: "Invalid mode" };
}

// ===== TEMPLATE OPERATIONS =====

function uploadTemplate(payload) {
  const { fileName, base64Data } = payload;
  if (!fileName || !base64Data) throw new Error("fileName and base64Data are required");

  const blob   = Utilities.newBlob(Utilities.base64Decode(base64Data), "application/pdf", fileName);
  const folder = DriveApp.getFolderById(TEMPLATES_FOLDER_ID);
  const file   = folder.createFile(blob);

  // Only the file is shared per-upload. TEMPLATES_FOLDER_ID is operator-supplied,
  // not app-created — it must never be auto-flipped to anyone-with-link (§10.2).
  const fileShared = shareBestEffort(file);

  return {
    success    : true,
    fileId     : file.getId(),
    viewUrl    : "https://drive.google.com/file/d/" + file.getId() + "/view",
    previewUrl : "https://drive.google.com/file/d/" + file.getId() + "/preview",
    shared     : fileShared,
  };
}

function deleteTemplate(payload) {
  const { fileId } = payload;
  if (!fileId) throw new Error("fileId is required");
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ===== DRIVE OPERATIONS =====

function uploadPDF(payload) {
  var pdfData = payload.pdfData;
  var fileName = payload.fileName;
  var databaseName = payload.databaseName;
  var folderId = payload.folderId;

  // folderId (resolved once per run by the caller) avoids the check-then-act
  // race in getOrCreateFolder under 5 concurrent uploads. Fall back to a
  // name lookup only when the caller couldn't supply an id (first upload).
  var folder;
  if (folderId) {
    try {
      folder = DriveApp.getFolderById(folderId);
      // A trashed folder still resolves by id, and createFile() on it drops the
      // file into the bin. Treat trashed the same as a stale id -- self-heal.
      if (folder.isTrashed()) folder = getOrCreateFolder(databaseName);
    } catch (e) {
      // Stale/deleted folder id -- self-heal by name lookup instead of bricking the run.
      folder = getOrCreateFolder(databaseName);
    }
  } else {
    folder = getOrCreateFolder(databaseName);
  }

  // Decode base64 PDF data
  const pdfBlob = Utilities.newBlob(
    Utilities.base64Decode(pdfData),
    "application/pdf",
    fileName
  );
  
  // Upload to Drive
  const file = folder.createFile(pdfBlob);

  // Only the file is shared per-upload; the per-DB subfolder is shared once at
  // creation in getOrCreateFolder (§10.2). Re-sharing the folder on every upload
  // is redundant and burns setSharing quota on the concurrent-upload path.
  const fileShared = shareBestEffort(file);

  return {
    success: true,
    fileId: file.getId(),
    fileName: file.getName(),
    webViewLink: file.getUrl(),
    webContentLink: file.getUrl(),
    folderId: folder.getId(),
    folderUrl: "https://drive.google.com/drive/folders/" + folder.getId(),
    shared: fileShared,
  };
}

function getOrCreateFolder(folderName) {
  // Use the specific folder ID for main certificates folder
  let parentFolder;
  
  if (DRIVE_FOLDER_ID) {
    try {
      parentFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      // If the hard-coded parent was trashed, fall back to name lookup / recreate
      // rather than nesting new subfolders inside the bin.
      if (parentFolder && parentFolder.isTrashed()) parentFolder = null;
    } catch (e) {
      console.log("Could not get folder by ID, trying by name");
      parentFolder = null;
    }
  }
  
  if (!parentFolder) {
    // Fallback: find or create by name
    const parentFolders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
    if (parentFolders.hasNext()) {
      parentFolder = parentFolders.next();
    } else {
      parentFolder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
      shareBestEffort(parentFolder);
    }
  }
  
  // Find or create sub-folder for database name
  const subFolders = parentFolder.getFoldersByName(folderName);
  let subFolder;
  
  if (subFolders.hasNext()) {
    subFolder = subFolders.next();
  } else {
    subFolder = parentFolder.createFolder(folderName);
    shareBestEffort(subFolder);
  }
  
  return subFolder;
}

/**
 * Merge duplicate per-database folders into one canonical folder.
 *
 * Finds every folder named `folderName` directly under the parent
 * (DRIVE_FOLDER_ID if resolvable, else the folder named DRIVE_FOLDER_NAME).
 * For each such folder whose id !== canonicalFolderId: move all its files into
 * the canonical folder, then trash the now-empty duplicate. The canonical
 * folder itself and any folder with a different name are never touched.
 */
function consolidateFolders(payload) {
  var folderName = payload.folderName;
  var canonicalFolderId = payload.canonicalFolderId;
  if (!folderName || !canonicalFolderId) throw new Error("folderName and canonicalFolderId are required");

  var parent;
  if (DRIVE_FOLDER_ID) {
    try { parent = DriveApp.getFolderById(DRIVE_FOLDER_ID); } catch (e) { parent = null; }
  }
  if (!parent) {
    var byName = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
    if (!byName.hasNext()) throw new Error("Parent folder not found");
    parent = byName.next();
  }

  var canonical = DriveApp.getFolderById(canonicalFolderId);
  if (canonical.isTrashed()) {
    throw new Error("Canonical folder (" + canonicalFolderId + ") is in the trash -- restore it or relink the database's Drive folder first");
  }
  if (canonical.getName() !== folderName) {
    throw new Error("Canonical folder name (" + canonical.getName() + ") does not match folderName (" + folderName + ")");
  }
  var movedFiles = 0;
  var trashedFolders = 0;

  var dupes = parent.getFoldersByName(folderName);
  while (dupes.hasNext()) {
    var dupe = dupes.next();
    if (dupe.isTrashed()) continue;
    if (dupe.getId() === canonicalFolderId) continue;

    var files = dupe.getFiles();
    while (files.hasNext()) {
      var f = files.next();
      f.moveTo(canonical); // Drive v3 move; keeps the same file id
      movedFiles++;
    }
    dupe.setTrashed(true);
    trashedFolders++;
  }

  return { success: true, movedFiles: movedFiles, trashedFolders: trashedFolders };
}

/**
 * Trash every PDF directly inside `folderId` whose id is NOT in `keepFileIds`.
 *
 * keepFileIds = the Drive file id of each participant's current certificate PDF
 * (built from Firestore by the caller). Everything else loose in the folder is a
 * stale re-generated copy, an orphan, or a same-name duplicate -> trash it
 * (recoverable for 30 days). Subfolders and non-PDF files are never touched.
 *
 * dryRun: true -> return the candidate list, trash nothing.
 * Refuses when keepFileIds is empty (that means the database's links are broken
 * and pruning would wipe the whole folder).
 */
function pruneFolderDuplicates(payload) {
  var folderId = payload.folderId;
  var keepFileIds = payload.keepFileIds || [];
  var dryRun = payload.dryRun === true || payload.dryRun === "true";

  if (!folderId) throw new Error("folderId is required");
  if (!keepFileIds.length) {
    throw new Error("keepFileIds is empty -- refusing to prune (the database has no linked certificate files)");
  }

  var folder = DriveApp.getFolderById(folderId);
  if (folder.isTrashed()) {
    throw new Error("Folder (" + folderId + ") is in the trash");
  }

  var keep = {};
  for (var i = 0; i < keepFileIds.length; i++) keep[keepFileIds[i]] = true;

  var candidates = [];
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (f.isTrashed()) continue;
    if (keep[f.getId()]) continue;
    if (f.getMimeType() !== "application/pdf") continue;
    candidates.push({ id: f.getId(), name: f.getName() });
  }

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      keptCount: keepFileIds.length,
      candidateCount: candidates.length,
      candidates: candidates.slice(0, 50),
    };
  }

  var trashed = 0;
  for (var j = 0; j < candidates.length; j++) {
    try {
      DriveApp.getFileById(candidates[j].id).setTrashed(true);
      trashed++;
    } catch (e) { /* already gone -- ignore */ }
  }
  return { success: true, dryRun: false, keptCount: keepFileIds.length, trashedCount: trashed };
}

function getFolder(payload) {
  const { databaseName } = payload;
  if (!databaseName) throw new Error("databaseName is required");
  const folder = getOrCreateFolder(databaseName);
  return {
    success: true,
    folderId: folder.getId(),
    folderUrl: "https://drive.google.com/drive/folders/" + folder.getId(),
  };
}

function deletePDF(payload) {
  const { fileId } = payload;

  if (!fileId) {
    throw new Error("File ID is required");
  }

  try {
    DriveApp.getFileById(fileId).setTrashed(true);
    return { success: true, message: "File deleted" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function deleteFolder(payload) {
  const { folderId } = payload;
  if (!folderId) throw new Error("folderId is required");
  try {
    DriveApp.getFolderById(folderId).setTrashed(true);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

function ensurePublic(payload) {
  const { fileId, folderId } = payload;
  if (!fileId && !folderId) throw new Error("fileId or folderId is required");
  try {
    const target = fileId
      ? DriveApp.getFileById(fileId)
      : DriveApp.getFolderById(folderId);
    target.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { success: true, shared: true };
  } catch (err) {
    return { success: false, shared: false, error: String(err) };
  }
}

/** Best-effort ANYONE_WITH_LINK share; returns whether it stuck. */
function shareBestEffort(fileOrFolder) {
  try {
    fileOrFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return true;
  } catch (err) {
    console.error("setSharing failed:", err && err.message);
    return false;
  }
}

// Fast targeted update: only writes column A (Certificate ID) matched by email.
// 3 batch API calls regardless of row count — no full-sheet rewrite needed.
function updateCertIds(payload) {
  const { spreadsheetId, tabName, updates } = payload;
  if (!updates || updates.length === 0) return { success: true, updated: 0 };

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet) throw new Error("Sheet tab not found: " + tabName);

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, updated: 0 };

  const rowCount = lastRow - 1;

  // Batch read: column A (cert IDs) and column C (emails)
  const certIdCol = sheet.getRange(2, 1, rowCount, 1).getValues();
  const emailCol  = sheet.getRange(2, 3, rowCount, 1).getValues();

  // Build email → certId map from the incoming updates
  const emailToCertId = {};
  updates.forEach(function(upd) {
    const email = (upd.email || "").toLowerCase().trim();
    if (email) emailToCertId[email] = upd.certificateId;
  });

  // Apply updates to the certId column array
  var updated = 0;
  for (var i = 0; i < rowCount; i++) {
    const email = (emailCol[i][0] || "").toLowerCase().trim();
    if (emailToCertId[email] !== undefined) {
      certIdCol[i][0] = emailToCertId[email];
      updated++;
    }
  }

  // Batch write: one call for the whole column
  sheet.getRange(2, 1, rowCount, 1).setValues(certIdCol);

  return { success: true, updated: updated };
}

// Find row by email (col C) and update all fields; append if not found.
function upsertRow(payload) {
  const { spreadsheetId, tabName, row } = payload;

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet) throw new Error("Sheet tab not found: " + tabName);

  const email = (row.email || "").toLowerCase().trim();
  const lastRow = sheet.getLastRow();

  // Scan col C for matching email
  var targetRow = -1;
  if (email && lastRow > 1) {
    const emails = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
    for (var i = 0; i < emails.length; i++) {
      if ((emails[i][0] || "").toLowerCase().trim() === email) {
        targetRow = i + 2;
        break;
      }
    }
  }

  const rowData = [
    row.certificateId || "",
    row.name || "",
    row.email || "",
    row.certificateUrl || "",
    row.status || "pending",
    row.issueDate || "",
    row.emailSent ? "Yes" : "No",
    row.driveLink || "",
    row.createdAt || ""
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    return { success: true, action: "updated", row: targetRow };
  } else {
    sheet.appendRow(rowData);
    return { success: true, action: "appended" };
  }
}

/**
 * Delete Sheet rows matching a list of participant identifiers.
 *
 * matches: [{ certificateId?, name?, email? }, ...]
 *   - certificateId present -> delete the row whose col A === certificateId exactly
 *   - else                  -> delete the row whose Name (col B) AND Email (col C)
 *                              both match, case-insensitive and trimmed
 * Header row (row 1) is never touched. A match with no hit is a silent no-op.
 * All target rows are collected first, then deleted bottom-up in one pass.
 */
function deleteRows(payload) {
  var spreadsheetId = payload.spreadsheetId;
  var tabName = payload.tabName;
  var matches = payload.matches || [];
  if (!spreadsheetId || !tabName) throw new Error("spreadsheetId and tabName are required");
  if (matches.length === 0) return { success: true, deletedRows: 0 };

  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(tabName);
  if (!sheet) throw new Error("Sheet tab not found: " + tabName);

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, deletedRows: 0 };

  var values = sheet.getRange(2, 1, lastRow - 1, 3).getValues(); // cols A,B,C for data rows

  var norm = function (v) { return String(v == null ? "" : v).trim().toLowerCase(); };
  var certIds = {};
  var nameEmail = {};
  for (var m = 0; m < matches.length; m++) {
    var match = matches[m];
    if (match.certificateId) {
      certIds[String(match.certificateId)] = true;
    } else if (match.name || match.email) {
      nameEmail[norm(match.name) + "\u0000" + norm(match.email)] = true;
    }
  }

  var rowsToDelete = [];
  for (var i = values.length - 1; i >= 0; i--) {
    var rowCertId = String(values[i][0]);
    var key = norm(values[i][1]) + "\u0000" + norm(values[i][2]);
    if (certIds[rowCertId] === true || nameEmail[key] === true) {
      rowsToDelete.push(i + 2); // +2: 1-indexed + skip header
    }
  }

  // rowsToDelete is descending; collapse consecutive rows into one deleteRows call
  // so a 500-row purge doesn't fire 500 sequential API calls against the 6-min GAS limit.
  var i2 = 0;
  while (i2 < rowsToDelete.length) {
    var end = rowsToDelete[i2];      // highest row of this run
    var j = i2;
    while (j + 1 < rowsToDelete.length && rowsToDelete[j + 1] === rowsToDelete[j] - 1) j++;
    var start = rowsToDelete[j];     // lowest row of this run
    sheet.deleteRows(start, end - start + 1);
    i2 = j + 1;
  }
  return { success: true, deletedRows: rowsToDelete.length };
}

// Clear col A (cert ID) for rows matched by email in col C -- never deletes rows.
// Preserves all other columns (original form data, names, emails, etc.).
// 3 batch API calls total regardless of row count.
function clearCertIdsByEmail(payload) {
  const { spreadsheetId, tabName, emails } = payload;
  if (!emails || emails.length === 0) return { success: true, cleared: 0 };

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet) throw new Error("Sheet tab not found: " + tabName);

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, cleared: 0 };

  const rowCount = lastRow - 1;
  const emailSet = new Set(emails.map(function(e) { return (e || "").toLowerCase().trim(); }).filter(Boolean));

  // Batch read col A and col C
  const certIdCol = sheet.getRange(2, 1, rowCount, 1).getValues();
  const emailCol  = sheet.getRange(2, 3, rowCount, 1).getValues();

  var cleared = 0;
  for (var i = 0; i < rowCount; i++) {
    if (emailSet.has((emailCol[i][0] || "").toLowerCase().trim())) {
      certIdCol[i][0] = "";
      cleared++;
    }
  }

  // Batch write col A only
  sheet.getRange(2, 1, rowCount, 1).setValues(certIdCol);

  return { success: true, cleared: cleared };
}
