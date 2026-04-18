const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

async function checkFolder() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(
      fs.readFileSync(path.join(__dirname, "drive-service-account.json"), "utf8")
    ),
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  const authClient = await auth.getClient();
  const drive = google.drive({ version: "v3", auth: authClient });

  const PARENT_FOLDER_ID = "1Bqi4XvZ3d3S0bcrSQhDazUGGGwjArqQW";

  try {
    const response = await drive.files.get({ fileId: PARENT_FOLDER_ID, fields: "id,name,mimeType" });
    console.log("Folder exists:", response.data);
  } catch (error) {
    console.error("Error accessing folder:", error.message);
    if (error.response?.data) {
      console.error("Details:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkFolder();
