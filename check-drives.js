const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

async function checkDrives() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(
      fs.readFileSync(path.join(__dirname, "drive-service-account.json"), "utf8")
    ),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  const authClient = await auth.getClient();
  const drive = google.drive({ version: "v3", auth: authClient });

  try {
    // Check for Shared Drives
    const response = await drive.drives.list({
      pageSize: 10,
    });
    console.log("Shared Drives found:", JSON.stringify(response.data.drives, null, 2));
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkDrives();
