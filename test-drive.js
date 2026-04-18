const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

async function testDrive() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(
      fs.readFileSync(path.join(__dirname, "drive-service-account.json"), "utf8")
    ),
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  const authClient = await auth.getClient();
  const drive = google.drive({ version: "v3", auth: authClient });

  try {
    // Try to list root files
    const response = await drive.files.list({
      pageSize: 10,
      fields: "files(id,name,mimeType)",
    });
    console.log("Files in root:", JSON.stringify(response.data.files, null, 2));
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testDrive();
