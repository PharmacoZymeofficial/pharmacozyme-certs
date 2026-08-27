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
      case "ensurePublic":
        result = ensurePublic(payload);
        break;
      case "getTabs":
        result = getSheetTabs(payload);
        break;
      case "deleteRowsByCertIds":
        result = deleteRowsByCertIds(payload);
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
      case "deleteRowsByEmail":
        result = deleteRowsByEmail(payload);
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
    // Read data from Sheet
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return { success: true, data: [] };
    }

    // Columns beyond the fixed 9 (J, K, ...) are admin-added custom fields
    // (e.g. "Designation", "Start Date") — read by their header text so
    // certificate templates can bind a placeholder to that column name.
    const lastCol = sheet.getLastColumn();
    const customHeaders = lastCol > 9 ? sheet.getRange(1, 10, 1, lastCol - 9).getValues()[0] : [];

    const range = sheet.getRange(2, 1, lastRow - 1, lastCol);
    const values = range.getValues();

    const data = values.map(row => {
      const rec = {
        certificateId: row[0],
        name: row[1],
        email: row[2],
        certificateUrl: row[3],
        status: row[4],
        issueDate: row[5],
        emailSent: row[6] === "Yes",
        driveLink: row[7],
        createdAt: row[8]
      };
      customHeaders.forEach(function (header, i) {
        const key = String(header || "").trim();
        if (!key) return;
        const cell = row[9 + i];
        // Google Sheets returns date-formatted cells as JS Date objects — format
        // them plainly instead of letting JSON.stringify dump a raw ISO timestamp.
        rec[key] = Object.prototype.toString.call(cell) === "[object Date]"
          ? Utilities.formatDate(cell, Session.getScriptTimeZone(), "MMM d, yyyy")
          : cell;
      });
      return rec;
    });

    return { success: true, data };
  }
  
  return { success: false, error: "Invalid mode" };
}

function deleteRowsByCertIds(payload) {
  const { spreadsheetId, tabName, certIds } = payload;
  if (!certIds || certIds.length === 0) return { success: true, deletedRows: 0 };

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet) throw new Error("Sheet tab not found: " + tabName);

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, deletedRows: 0 };

  const certIdSet = new Set(certIds.map(String));
  const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  // Collect row indices to delete (bottom-up to preserve indices)
  const rowsToDelete = [];
  for (let i = data.length - 1; i >= 0; i--) {
    if (certIdSet.has(String(data[i][0]))) {
      rowsToDelete.push(i + 2); // +2: 1-indexed + skip header
    }
  }

  for (const rowIndex of rowsToDelete) {
    sheet.deleteRow(rowIndex);
  }

  return { success: true, deletedRows: rowsToDelete.length };
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
  const { spreadsheetId, pdfData, fileName, databaseName } = payload;
  
  // Get or create folder for this database
  const folder = getOrCreateFolder(databaseName);
  
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

// Delete rows whose col-C email matches any email in the provided list.
function deleteRowsByEmail(payload) {
  const { spreadsheetId, tabName, emails } = payload;
  if (!emails || emails.length === 0) return { success: true, deletedRows: 0 };

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet) throw new Error("Sheet tab not found: " + tabName);

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, deletedRows: 0 };

  const emailSet = new Set(emails.map(function(e) { return (e || "").toLowerCase().trim(); }).filter(Boolean));
  const sheetEmails = sheet.getRange(2, 3, lastRow - 1, 1).getValues();

  // Collect bottom-up so row indices stay valid after each deletion
  const rowsToDelete = [];
  for (var i = sheetEmails.length - 1; i >= 0; i--) {
    if (emailSet.has((sheetEmails[i][0] || "").toLowerCase().trim())) {
      rowsToDelete.push(i + 2);
    }
  }

  for (var j = 0; j < rowsToDelete.length; j++) {
    sheet.deleteRow(rowsToDelete[j]);
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
