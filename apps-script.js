// Google Apps Script for PZ Certificate System
// Deploy as Web App: Execute as "Me" and access "Anyone"

// ===== CONFIGURATION =====
const SHEET_ID = "YOUR_SHEET_ID"; // Will be set dynamically
const DRIVE_FOLDER_NAME = "PZ Certificates";
const DRIVE_FOLDER_ID = "1Bqi4XvZ3d3S0bcrSQhDazUGGGwjArqQW"; // Specific folder

// ===== WEB APP HANDLERS =====

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
      case "getTabs":
        result = getSheetTabs(payload);
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
    
    const range = sheet.getRange(2, 1, lastRow - 1, 9);
    const values = range.getValues();
    
    const data = values.map(row => ({
      certificateId: row[0],
      name: row[1],
      email: row[2],
      certificateUrl: row[3],
      status: row[4],
      issueDate: row[5],
      emailSent: row[6] === "Yes",
      driveLink: row[7],
      createdAt: row[8]
    }));
    
    return { success: true, data };
  }
  
  return { success: false, error: "Invalid mode" };
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
  
  // Make it publicly accessible
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  return {
    success: true,
    fileId: file.getId(),
    fileName: file.getName(),
    webViewLink: file.getUrl(),
    webContentLink: file.getUrl()
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
    }
  }
  
  // Find or create sub-folder for database name
  const subFolders = parentFolder.getFoldersByName(folderName);
  let subFolder;
  
  if (subFolders.hasNext()) {
    subFolder = subFolders.next();
  } else {
    subFolder = parentFolder.createFolder(folderName);
  }
  
  return subFolder;
}

function deletePDF(payload) {
  const { fileId } = payload;
  
  if (!fileId) {
    throw new Error("File ID is required");
  }
  
  try {
    const file = DriveApp.getFileById(fileId);
    DriveApp.removeFile(file);
    return { success: true, message: "File deleted" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
