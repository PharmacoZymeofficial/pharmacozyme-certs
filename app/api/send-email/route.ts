import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc, increment, collection, addDoc } from "firebase/firestore";
import { getAdminFromCookieHeader, logActivity } from "@/lib/activity";
// Brevo REST API — separate API keys per Brevo account
const BREVO_SENDERS: Record<string, { name: string; apiKey: string | undefined; statsKey: string }> = {
  "info@pharmacozyme.com": {
    name: "PharmacoZyme Official",
    apiKey: process.env.BREVO_API_KEY_PHARMACOZYME,
    statsKey: "brevo_pharmacozyme",
  },
  "info@pzacademy.pharmacozyme.com": {
    name: "PZ Academy",
    apiKey: process.env.BREVO_API_KEY_ACADEMY,
    statsKey: "brevo_pzacademy",
  },
};

async function sendViaBrevoApi({
  apiKey, senderName, senderEmail, toEmail, toName, subject, html, attachmentBase64, attachmentName,
}: {
  apiKey: string; senderName: string; senderEmail: string;
  toEmail: string; toName?: string; subject: string; html: string;
  attachmentBase64?: string; attachmentName?: string;
}) {
  const body: Record<string, unknown> = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: toEmail, ...(toName ? { name: toName } : {}) }],
    subject,
    htmlContent: html,
    headers: {
      "List-Unsubscribe": "<mailto:pharmacozymeofficial@gmail.com?subject=Unsubscribe>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      "Precedence": "bulk",
      "X-Auto-Response-Suppress": "OOF, DR, RN, NRN, AutoReply",
    },
  };
  if (attachmentBase64 && attachmentName) {
    body.attachment = [{ content: attachmentBase64, name: attachmentName }];
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", "accept": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`Brevo API ${res.status}: ${(err as any).message || JSON.stringify(err)}`);
  }
  return res.json();
}

function isQuotaError(err: any): boolean {
  const msg = (err?.message || "").toLowerCase();
  return msg.includes("quota") || msg.includes("daily") || msg.includes("rate_limit") || msg.includes("too_many") || msg.includes("429");
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://cert.pharmacozyme.com";
const VERIFY_URL = process.env.NEXT_PUBLIC_VERIFY_URL || `${BASE_URL}/verify`;
const CLAIM_URL = `${BASE_URL}/claim`;
const LOGO_URL = `${BASE_URL}/pharmacozyme-logo.png`;

function buildEmailHtml({ name, certificateId, verificationLink, emailMessage, driveLink, pdfBase64, email }: {
  name: string; certificateId: string; verificationLink: string; emailMessage: string;
  driveLink?: string; pdfBase64?: string; email: string;
}) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f7f5; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7f5; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 8px; border: 1px solid #d1e7d8;">
          <!-- Header -->
          <tr>
            <td style="background-color: #1b4332; padding: 24px 32px; border-radius: 8px 8px 0 0; text-align: center;">
              <p style="margin: 0; color: #ffffff; font-size: 18px; font-weight: bold; letter-spacing: 0.5px;">PharmacoZyme</p>
              <p style="margin: 6px 0 0; color: #95d5b2; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase;">Certificate of Achievement</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #1b4332; font-size: 15px;">Dear <strong>${name || "Participant"}</strong>,</p>
              <p style="margin: 0 0 24px; color: #555555; font-size: 14px; line-height: 1.6;">
                Congratulations! Your certificate has been generated. Click the button below to claim and download your official certificate.
              </p>
              <!-- Cert ID box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border: 1px solid #95d5b2; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Certificate ID</p>
                    <p style="margin: 6px 0 0; color: #1b4332; font-size: 18px; font-weight: bold; font-family: monospace;">${certificateId || "N/A"}</p>
                  </td>
                </tr>
              </table>
              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                <tr>
                  <td align="center">
                    <a href="${verificationLink}" style="display: inline-block; background-color: #1b4332; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 15px; font-weight: bold;">
                      Claim Your Certificate
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Verify link -->
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-align: center;">
                Or verify your certificate at:<br>
                <a href="${VERIFY_URL}?certId=${certificateId}" style="color: #2d6a4f; font-size: 12px;">${VERIFY_URL}?certId=${certificateId}</a>
              </p>
              ${driveLink && !pdfBase64 ? `
              <!-- Download link -->
              <p style="margin: 16px 0 0; text-align: center;">
                <a href="${driveLink}" style="color: #2d6a4f; font-size: 13px; text-decoration: underline;">Download Certificate PDF</a>
              </p>
              ` : ""}
              ${emailMessage ? `
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
              <p style="margin: 0; color: #555555; font-size: 13px; line-height: 1.6;">${emailMessage.replace(/\n/g, "<br>")}</p>
              ` : ""}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f0fdf4; padding: 16px 32px; border-radius: 0 0 8px 8px; text-align: center; border-top: 1px solid #d1e7d8;">
              <p style="margin: 0; color: #6b7280; font-size: 11px;">PharmacoZyme Certificate System &bull; Sent to: ${email}</p>
              <p style="margin: 6px 0 0; color: #9ca3af; font-size: 10px;">If you did not expect this email, please ignore it.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipients, subject, message, replyTo, senderName, gmailEmail } = body;

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ error: "No recipients provided" }, { status: 400 });
    }

    const validRecipients = (recipients as any[]).filter(r => r.email && r.email.includes("@"));
    if (validRecipients.length === 0) {
      return NextResponse.json({ error: "No valid recipient emails found" }, { status: 400 });
    }

    // ── Brevo API path ───────────────────────────────────────────────────────
    if (gmailEmail && BREVO_SENDERS[gmailEmail]) {
      const sender = BREVO_SENDERS[gmailEmail];
      if (!sender.apiKey) {
        return NextResponse.json({
          error: "Brevo not configured",
          details: `BREVO_API_KEY for ${gmailEmail} not set in environment variables`,
        }, { status: 500 });
      }

      const results = [];
      const errors = [];

      for (const recipient of validRecipients) {
        const { email, name, certificateId, pdfBase64, driveLink } = recipient;
        let emailMessage = (message || "")
          .replace(/\[Name\]/g, name || "")
          .replace(/\[CertificateID\]/g, certificateId || "")
          .replace(/\[VerificationLink\]/g, VERIFY_URL + "?id=" + certificateId);
        const verificationLink = `${CLAIM_URL}?id=${encodeURIComponent(certificateId)}`;

        try {
          await sendViaBrevoApi({
            apiKey: sender.apiKey,
            senderName: sender.name,
            senderEmail: gmailEmail,
            toEmail: email,
            toName: name,
            subject: subject || "Your Certificate from PharmacoZyme",
            html: buildEmailHtml({ name, certificateId, verificationLink, emailMessage, driveLink, pdfBase64, email }),
            ...(pdfBase64 ? { attachmentBase64: pdfBase64, attachmentName: `Certificate_${certificateId}.pdf` } : {}),
          });
          results.push({ email, success: true });
        } catch (err: any) {
          console.error(`Brevo API failed for ${email}:`, err);
          errors.push({ email, error: err.message });
        }
      }

      if (results.length > 0) {
        try {
          const today = new Date().toISOString().split("T")[0];
          await setDoc(doc(db, "email_stats", today), { sent: increment(results.length), [sender.statsKey]: increment(results.length) }, { merge: true });
        } catch { /* non-fatal */ }

        const { adminName, adminEmail: adminEmailVal } = getAdminFromCookieHeader(request.headers.get("cookie") || "");
        await logActivity({ type: "email_sent", adminName, adminEmail: adminEmailVal, count: results.length, details: `Sent ${results.length} email(s) via Brevo (${gmailEmail})` });
      }

      return NextResponse.json({
        success: results.length > 0,
        sent: results.length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // ── Resend path ──────────────────────────────────────────────────────────
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
    const quotaFailed: any[] = [];
    let quotaHit = false;

    // Send emails one by one with attachments
    for (const recipient of validRecipients) {
      if (quotaHit) { quotaFailed.push(recipient); continue; }

      try {
        const { email, name, certificateId, pdfBase64, driveLink } = recipient;

        // Replace placeholders in message
        let emailMessage = message
          .replace(/\[Name\]/g, name || "")
          .replace(/\[CertificateID\]/g, certificateId || "")
          .replace(/\[VerificationLink\]/g, VERIFY_URL + "?id=" + certificateId);

        const verificationLink = `${CLAIM_URL}?id=${encodeURIComponent(certificateId)}`;

        // Build attachments if PDF provided
        const attachments = pdfBase64 ? [{
          filename: `Certificate_${certificateId}.pdf`,
          content: pdfBase64,
        }] : [];

        const data = await resend!.emails.send({
          from: `${senderName || "PharmacoZyme Certificates"} <noreply@certs.pharmacozyme.com>`,
          ...(replyTo ? { reply_to: replyTo } : {}),
          to: email,
          subject: subject || "Your Certificate from PharmacoZyme",
          attachments,
          html: buildEmailHtml({ name, certificateId, verificationLink, emailMessage, driveLink, pdfBase64, email }),
          headers: {
            "List-Unsubscribe": "<mailto:pharmacozymeofficial@gmail.com?subject=Unsubscribe>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            "Precedence": "bulk",
          },
        });

        if (data.error) throw new Error(data.error.message || "Resend API error");
        results.push({ email, success: true, id: data.data?.id });
      } catch (err: any) {
        console.error(`Failed to send to ${recipient.email}:`, err);
        if (isQuotaError(err)) {
          quotaHit = true;
          quotaFailed.push(recipient);
          continue;
        }
        // Retry once after 1.5s for non-quota errors
        try {
          await new Promise(r => setTimeout(r, 1500));
          const retry = await resend!.emails.send({
            from: `${senderName || "PharmacoZyme Certificates"} <noreply@certs.pharmacozyme.com>`,
            ...(replyTo ? { reply_to: replyTo } : {}),
            to: recipient.email,
            subject: subject || "Your Certificate from PharmacoZyme",
            attachments: recipient.pdfBase64 ? [{ filename: `Certificate_${recipient.certificateId}.pdf`, content: recipient.pdfBase64 }] : [],
            html: `<p>Dear <strong>${recipient.name || "Participant"}</strong>,</p><p>Your PharmacoZyme certificate is ready.</p><p><a href="${CLAIM_URL}/${encodeURIComponent(recipient.certificateId)}" style="background:#1b4332;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin:10px 0">🎓 Claim Certificate</a></p><p>Certificate ID: <strong>${recipient.certificateId}</strong></p>${recipient.driveLink ? `<p><a href="${recipient.driveLink}">Download PDF</a></p>` : ""}`,
          });
          if (retry.error) throw new Error(retry.error.message);
          results.push({ email: recipient.email, success: true, id: retry.data?.id, retried: true });
        } catch (retryErr: any) {
          if (isQuotaError(retryErr)) { quotaHit = true; quotaFailed.push(recipient); continue; }
          console.error(`Retry also failed for ${recipient.email}:`, retryErr);
          errors.push({ email: recipient.email, error: err.message });
        }
      }
    }

    if (results.length > 0) {
      try {
        const today = new Date().toISOString().split("T")[0];
        await setDoc(doc(db, "email_stats", today), { sent: increment(results.length) }, { merge: true });
      } catch { /* non-fatal */ }

      const { adminName, adminEmail: adminEmailVal } = getAdminFromCookieHeader(request.headers.get("cookie") || "");
      await logActivity({ type: "email_sent", adminName, adminEmail: adminEmailVal, count: results.length, details: `Sent ${results.length} email(s) via Resend` });
    }

    // Auto-queue quota-failed recipients for next day 12:01 AM
    let autoQueued = 0;
    if (quotaFailed.length > 0) {
      try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 1, 0, 0);
        await addDoc(collection(db, "scheduled_emails"), {
          recipients: quotaFailed,
          subject: subject || "Your Certificate from PharmacoZyme",
          message: message || "",
          scheduledAt: tomorrow.toISOString(),
          status: "pending",
          autoQueued: true,
          createdAt: new Date().toISOString(),
        });
        autoQueued = quotaFailed.length;
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({
      success: results.length > 0,
      sent: results.length,
      failed: errors.length,
      autoQueued,
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