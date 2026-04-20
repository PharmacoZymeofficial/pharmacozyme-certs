import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://certs.pharmacozyme.com";
const VERIFY_URL = process.env.NEXT_PUBLIC_VERIFY_URL || `${BASE_URL}/verify`;
const CLAIM_URL = `${BASE_URL}/claim`;
const LOGO_URL = `${BASE_URL}/pharmacozyme-logo.png`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipients, subject, message } = body;

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ error: "No recipients provided" }, { status: 400 });
    }

    // Check if Resend API key is configured
    const apiKey = process.env.RESEND_API_KEY;
    let resend = null;
    if (apiKey && apiKey !== "your_resend_api_key_here" && apiKey.startsWith("re_")) {
      const { Resend } = await import("resend");
      resend = new Resend(apiKey);
    }
    if (!apiKey || apiKey === "your_resend_api_key_here") {
      console.log("Simulating email send (no API key configured)");
      
      const simulatedResults = (recipients as any[]).map(r => ({
        email: r.email,
        success: true,
        simulated: true,
      }));
      
      return NextResponse.json({
        success: true,
        sent: recipients.length,
        failed: 0,
        simulated: true,
        results: simulatedResults,
        message: "Emails simulated (Resend API key not configured)",
      });
    }

    if (!apiKey.startsWith("re_")) {
      return NextResponse.json({
        error: "Invalid API key format",
        details: "RESEND_API_KEY appears to be invalid"
      }, { status: 500 });
    }

    if (!resend) {
      return NextResponse.json({
        error: "Email service not initialized",
        details: "Resend API key is invalid"
      }, { status: 500 });
    }

    const results = [];
    const errors = [];

    // Send emails one by one with attachments
    for (const recipient of recipients) {
      try {
        const { email, name, certificateId, pdfBase64, driveLink } = recipient;

        // Replace placeholders in message
        let emailMessage = message
          .replace(/\[Name\]/g, name || "")
          .replace(/\[CertificateID\]/g, certificateId || "")
          .replace(/\[VerificationLink\]/g, VERIFY_URL + "?id=" + certificateId);

        const verificationLink = CLAIM_URL + "?id=" + certificateId;

        // Build attachments if PDF provided
        const attachments = pdfBase64 ? [{
          filename: `Certificate_${certificateId}.pdf`,
          content: pdfBase64,
        }] : [];

        const data = await resend!.emails.send({
          from: "PharmacoZyme Certificates <noreply@certs.pharmacozyme.com>",
          to: email,
          subject: subject || "Your Certificate from PharmacoZyme",
          attachments,
          html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* Reset styles */
    body { margin: 0 !important; padding: 0 !important; }
    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      .email-container { background-color: #1a1a1a !important; }
      .email-card { background-color: #2d2d2d !important; }
      .email-text { color: #e5e5e5 !important; }
      .email-text-muted { color: #a0a0a0 !important; }
      .email-box { background-color: #363636 !important; border-color: #4a4a4a !important; }
      .email-footer { background-color: #1b4332 !important; }
    }
    /* Mobile styles */
    @media only screen and (max-width: 620px) {
      .email-content { padding: 20px !important; }
      .email-header { padding: 30px 20px !important; }
      .email-footer { padding: 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8faf9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table class="email-container" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8faf9; padding: 20px;">
    <tr>
      <td align="center">
        <table class="email-card" width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
          <!-- Header with Logo -->
          <tr>
            <td class="email-header" style="background: linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%); padding: 35px 40px 25px; border-radius: 16px 16px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <img src="${LOGO_URL}" alt="PharmacoZyme" width="120" style="width: 120px; height: auto; margin-bottom: 10px; display: block;">
                    <p style="margin: 0; color: #95d5b2; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">
                      Certificate of Achievement
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td class="email-content" style="padding: 35px;">
              <p style="margin: 0 0 20px; color: #1b4332; font-size: 16px; line-height: 1.5;" class="email-text">
                Dear <strong style="color: #2d6a4f;">${name || "Participant"},</strong>
              </p>
              
              <p style="margin: 0 0 25px; color: #4a5568; font-size: 14px; line-height: 1.6;" class="email-text-muted">
                Congratulations! Your certificate has been generated. Claim it now to access your official certificate.
              </p>
              
              <!-- Certificate ID Box with Claim Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border: 2px solid #95d5b2; border-radius: 12px; margin: 25px 0;" class="email-box">
                <tr>
                  <td style="padding: 25px;">
                    <p style="margin: 0; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;" class="email-text-muted">Certificate ID</p>
                    <p style="margin: 8px 0 15px; color: #1b4332; font-size: 20px; font-weight: 700; font-family: monospace;" class="email-text">${certificateId || "N/A"}</p>
                    
                    <!-- Claim Certificate Button -->
                    <a href="${verificationLink}" style="display: inline-block; width: 100%; box-sizing: border-box; background: linear-gradient(135deg, #1b4332 0%, #52b788 100%); color: #ffffff; text-decoration: none; padding: 16px 24px; border-radius: 10px; font-size: 15px; font-weight: 700; text-align: center; letter-spacing: 0.5px;">
                      🎓 Claim Your Certificate
                    </a>
                    <p style="margin: 10px 0 0; color: #6b7280; font-size: 11px; text-align: center;">
                      Or verify at: ${VERIFY_URL}?certId=${certificateId}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Custom Message -->
              ${emailMessage ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin: 20px 0;">
                <tr>
                  <td style="padding: 18px;">
                    <p style="margin: 0; color: #4a5568; font-size: 13px; line-height: 1.5;" class="email-text-muted">
                      ${emailMessage.replace(/\n/g, "<br>")}
                    </p>
                  </td>
                </tr>
              </table>
              ` : ""}
              
              <!-- Download from Drive if no PDF attachment -->
              ${driveLink && !pdfBase64 ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                <tr>
                  <td align="center">
                    <a href="${driveLink}" style="display: inline-block; background: #f0fdf4; color: #1b4332; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; border: 1px solid #95d5b2;">
                      📥 Download Certificate PDF
                    </a>
                  </td>
                </tr>
              </table>
              ` : ""}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td class="email-footer" style="background-color: #1b4332; padding: 25px 35px; border-radius: 0 0 16px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0; color: #95d5b2; font-size: 12px;">
                      PharmacoZyme Certificate System
                    </p>
                    <p style="margin: 8px 0 0; color: #6b7280; font-size: 10px;">
                      Sent to: ${email}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; margin-top: 15px;">
          <tr>
            <td align="center">
              <p style="margin: 0; color: #9ca3af; font-size: 11px;">
                If you didn't expect this email, please ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`,
        });

        if (data.error) throw new Error(data.error.message || "Resend API error");
        results.push({ email, success: true, id: data.data?.id });
      } catch (err: any) {
        console.error(`Failed to send to ${recipient.email}:`, err);
        // Retry once after 1s
        try {
          await new Promise(r => setTimeout(r, 1000));
          const { email, name, certificateId, pdfBase64, driveLink } = recipient;
          const verificationLink = CLAIM_URL + "?id=" + certificateId;
          const attachments = pdfBase64 ? [{ filename: `Certificate_${certificateId}.pdf`, content: pdfBase64 }] : [];
          const retry = await resend!.emails.send({
            from: "PharmacoZyme Certificates <noreply@certs.pharmacozyme.com>",
            to: email,
            subject: subject || "Your Certificate from PharmacoZyme",
            attachments,
            html: `<p>Dear ${name || "Participant"},</p><p>Your certificate is ready. <a href="${verificationLink}">Claim your certificate</a>.</p><p>Certificate ID: ${certificateId}</p>${driveLink ? `<p><a href="${driveLink}">Download PDF</a></p>` : ""}`,
          });
          if (retry.error) throw new Error(retry.error.message);
          results.push({ email, success: true, id: retry.data?.id, retried: true });
        } catch (retryErr: any) {
          errors.push({ email: recipient.email, error: err.message });
        }
      }
    }

    return NextResponse.json({
      success: results.length > 0,
      sent: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Email send error:", error);
    return NextResponse.json(
      { error: "Failed to send emails", details: error?.message },
      { status: 500 }
    );
  }
}