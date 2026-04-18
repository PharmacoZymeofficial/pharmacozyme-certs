const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");

async function testUpload() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(
      fs.readFileSync(path.join(__dirname, "drive-service-account.json"), "utf8")
    ),
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  const authClient = await auth.getClient();
  const drive = google.drive({ version: "v3", auth: authClient });

  const folderId = "1CGdm1nU-7Tf1_UcX-hUWQRvMOYnDXhi7";

  const pdfBuffer = Buffer.from("Test PDF content");

  try {
    const response = await drive.files.create({
      requestBody: {
        name: "test-certificate.pdf",
        parents: [folderId],
      },
      media: {
        mimeType: "application/pdf",
        body: Readable.from(pdfBuffer),
      },
    }, {
      supportsAllDrives: true,
    });

    console.log("Upload success! File ID:", response.data.id);
  } catch (error) {
    console.error("Upload error:", error.message);
    if (error.response?.data) {
      console.error("Details:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

testUpload();
