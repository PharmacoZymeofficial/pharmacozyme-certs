# Google Sheets + Drive Integration Setup

## Overview
This integration allows you to:
- Link Google Sheets to your databases
- Automatically upload generated certificates to Google Drive
- Bidirectional sync between Firebase and Google Sheets
- Delete PDFs from Drive when removed from the system

## Setup Steps

### 1. Create Google Apps Script

1. Go to [script.google.com](https://script.google.com)
2. Click "New Project"
3. Copy the content from `apps-script.js` and paste it into the editor
4. Save the project

### 2. Deploy as Web App

1. Click "Deploy" → "New deployment"
2. Select type: "Web app"
3. Configure:
   - **Description**: PZ Certificate System
   - **Execute as**: Me
   - **Who has access**: Anyone (or Anyone with Google Account)
4. Click "Deploy"
5. Copy the **Web app URL**

### 3. Configure Environment Variable

1. Open your `.env.local` file
2. Add:
   ```
   GOOGLE_APPS_SCRIPT_URL=YOUR_WEB_APP_URL_HERE
   ```

### 4. Restart the Development Server

```bash
npm run dev
```

## Usage

### Creating a Database with Sheets
1. Click "Create New Database"
2. Enable "Link Google Sheet"
3. Choose:
   - **Create New Sheet** - Enter sub-database names (tabs) separated by commas
   - **Link Existing** - Paste Sheet ID and select a tab

### Generating Certificates
When generating certificates, if a Sheet is linked:
- PDFs are automatically uploaded to Drive (folder: "PZ Certificates")
- Drive links are stored in both Firebase and Google Sheets

### Syncing Data
- **Firebase → Sheets**: Updates Sheet with all participant data
- **Sheets → Firebase**: Imports/updates participants from Sheet

### Deleting Certificates
When deleting participants/certificates, the PDF is automatically removed from Drive.

## Sheet Column Format
| Column | Description |
|--------|-------------|
| Certificate ID | Unique certificate ID |
| Name | Participant name |
| Email | Email address |
| Certificate URL | Verification URL |
| Status | generated/pending |
| Issue Date | Certificate issue date |
| Emailed | Yes/No |
| Drive Link | PDF download link |
| Created At | Creation timestamp |
