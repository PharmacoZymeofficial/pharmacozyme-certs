import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { FieldValue } from "firebase-admin/firestore";
import { logActivity } from "@/lib/activity";
import { sessionFromCookieHeader } from "@/lib/session";
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
    trackClicks: false,
    trackOpens: false,
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

function buildEmailHtml({ name, certificateId, emailMessage, driveLink, pdfBase64, email, orgName }: {
  name: string; certificateId: string; emailMessage: string;
  driveLink?: string; pdfBase64?: string; email: string; orgName: string;
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
              <p style="margin: 0; color: #ffffff; font-size: 18px; font-weight: bold; letter-spacing: 0.5px;">${orgName}</p>
              <p style="margin: 6px 0 0; color: #95d5b2; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase;">Certificate of Achievement</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #1b4332; font-size: 15px;">Dear <strong>${name || "Participant"}</strong>,</p>
              <p style="margin: 0 0 20px; color: #555555; font-size: 14px; line-height: 1.6;">
                Congratulations! Your certificate has been issued. Please find the details below.
              </p>
              <!-- Cert ID box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border: 1px solid #95d5b2; border-radius: 6px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Certificate ID</p>
                    <p style="margin: 6px 0 0; color: #1b4332; font-size: 18px; font-weight: bold; font-family: monospace;">${certificateId || "N/A"}</p>
                  </td>
                </tr>
              </table>
              ${driveLink && !pdfBase64 ? `
              <!-- Primary: Download PDF -->
              <p style="margin: 0 0 8px; color: #1b4332; font-size: 14px; font-weight: bold;">Download your certificate:</p>
              <p style="margin: 0 0 20px; font-size: 14px;">
                <a href="${driveLink}" style="color: #1b4332; font-weight: bold; text-decoration: underline;">Download Certificate PDF</a>
              </p>
              ` : pdfBase64 ? `
              <p style="margin: 0 0 20px; color: #555555; font-size: 14px;">Your certificate PDF is attached to this email.</p>
              ` : ""}
              <!-- Verify link -->
              <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px;">Verify your certificate online:</p>
              <p style="margin: 0; font-size: 12px;">
                <a href="${VERIFY_URL}?certId=${certificateId}" style="color: #2d6a4f;">${VERIFY_URL}?certId=${certificateId}</a>
              </p>
              ${emailMessage ? `
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
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
  // Was completely unauthenticated — anyone could send arbitrary mail from the
  // organisation's verified sender. Accepts either an admin session or the internal
  // secret used by the scheduled-email runner.
  const session = await sessionFromCookieHeader(request.headers.get("cookie"));
  const internalSecret = process.env.CRON_SECRET;
  const isInternal =
    Boolean(internalSecret) && request.headers.get("x-internal-secret") === internalSecret;

  if (!session && !isInternal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actorName = session?.displayName ?? "Scheduled job";
  const actorEmail = session?.email ?? "system@pharmacozyme.com";

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
        const emailMessage = (message || "")
          .replace(/\[Name\]/g, name || "")
          .replace(/\[CertificateID\]/g, certificateId || "")
          .replace(/\[VerificationLink\]/g, VERIFY_URL + "?certId=" + certificateId);

        try {
          await sendViaBrevoApi({
            apiKey: sender.apiKey,
            senderName: sender.name,
            senderEmail: gmailEmail,
            toEmail: email,
            toName: name,
            subject: subject || "Your Certificate from PharmacoZyme",
            html: buildEmailHtml({ name, certificateId, emailMessage, driveLink, pdfBase64, email, orgName: sender.name }),
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
          await getAdminDb().collection("email_stats").doc(today).set(
            { sent: FieldValue.increment(results.length), [sender.statsKey]: FieldValue.increment(results.length) },
            { merge: true }
          );
        } catch { /* non-fatal */ }

        await logActivity({ type: "email_sent", adminName: actorName, adminEmail: actorEmail, count: results.length, details: `Sent ${results.length} email(s) via Brevo (${gmailEmail})` });
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
      // Previously this returned success:true with sent:N for mail that was never sent,
      // which is how scheduled jobs ended up marked "sent" having delivered nothing.
      // Simulation is now opt-in and never reports success.
      if (process.env.ALLOW_SIMULATED_EMAIL !== "true") {
        return NextResponse.json(
          {
            error: "Email provider not configured",
            details:
              "RESEND_API_KEY is not set and no Brevo sender was selected, so nothing was sent. " +
              "Set ALLOW_SIMULATED_EMAIL=true in development to bypass this.",
            sent: 0,
            failed: validRecipients.length,
          },
          { status: 503 }
        );
      }

      console.log("Simulating email send (no API key configured)");
      return NextResponse.json({
        success: false,
        sent: 0,
        failed: 0,
        simulated: true,
        results: validRecipients.map((r: any) => ({ email: r.email, success: true, simulated: true })),
        message: "Emails simulated (Resend API key not configured) — nothing was delivered",
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
        const emailMessage = message
          .replace(/\[Name\]/g, name || "")
          .replace(/\[CertificateID\]/g, certificateId || "")
          .replace(/\[VerificationLink\]/g, VERIFY_URL + "?certId=" + certificateId);

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
          html: buildEmailHtml({ name, certificateId, emailMessage, driveLink, pdfBase64, email, orgName: senderName || "PharmacoZyme" }),
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
            html: `<p>Dear <strong>${recipient.name || "Participant"}</strong>,</p><p>Your PharmacoZyme certificate is ready.</p><p>Certificate ID: <strong>${recipient.certificateId}</strong></p>${recipient.driveLink ? `<p><a href="${recipient.driveLink}">Download Certificate PDF</a></p>` : ""}<p><a href="${VERIFY_URL}?certId=${encodeURIComponent(recipient.certificateId)}">Verify Certificate</a></p>`,
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
        await getAdminDb().collection("email_stats").doc(today).set(
          { sent: FieldValue.increment(results.length) },
          { merge: true }
        );
      } catch { /* non-fatal */ }

      await logActivity({ type: "email_sent", adminName: actorName, adminEmail: actorEmail, count: results.length, details: `Sent ${results.length} email(s) via Resend` });
    }

    // Auto-queue quota-failed recipients for next day 12:01 AM
    let autoQueued = 0;
    let autoQueueError: string | undefined;
    if (quotaFailed.length > 0) {
      try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 1, 0, 0);

        // pdfBase64 must NOT be persisted: a Firestore document is capped at 1 MiB and
        // a couple of certificate PDFs blow past it. The whole write used to throw into
        // a silent catch, so the queued recipients simply vanished while the response
        // still claimed they were queued. Store the reference instead and re-attach at
        // send time from driveLink.
        const slim = quotaFailed.map(({ pdfBase64: _pdfBase64, ...rest }: any) => rest);

        // Chunk so a large batch cannot approach the document limit either.
        const QUEUE_CHUNK = 200;
        const scheduledRef = getAdminDb().collection("scheduled_emails");
        for (let i = 0; i < slim.length; i += QUEUE_CHUNK) {
          await scheduledRef.add({
            recipients: slim.slice(i, i + QUEUE_CHUNK),
            subject: subject || "Your Certificate from PharmacoZyme",
            message: message || "",
            gmailEmail: gmailEmail || null,
            senderName: senderName || null,
            replyTo: replyTo || null,
            scheduledAt: tomorrow.toISOString(),
            status: "pending",
            autoQueued: true,
            createdAt: new Date().toISOString(),
          });
        }
        autoQueued = slim.length;
      } catch (err) {
        // Surfaced rather than swallowed — losing recipients silently is worse than a warning.
        autoQueueError = err instanceof Error ? err.message : "Failed to queue quota-failed recipients";
        console.error("Failed to auto-queue quota-failed recipients:", err);
      }
    }

    return NextResponse.json({
      success: results.length > 0,
      sent: results.length,
      failed: errors.length,
      autoQueued,
      autoQueueError,
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