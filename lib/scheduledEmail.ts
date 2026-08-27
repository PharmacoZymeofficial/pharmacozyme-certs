import { getAdminDb } from "@/lib/firebase.admin";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://cert.pharmacozyme.com";

export interface ScheduledJobResult {
  ok: boolean;
  sent: number;
  failed: number;
  error?: string;
}

/**
 * Runs one queued send and records the true outcome on the job document.
 *
 * The previous implementations (in the cron and in the send-now route) both:
 *   - forwarded only {recipients, subject, message}, dropping gmailEmail, so the
 *     Brevo sender the operator chose was silently ignored and every scheduled send
 *     fell through to Resend;
 *   - wrote status "sent" without inspecting the response, so a simulated send
 *     (no RESEND_API_KEY) or a total failure was still recorded as delivered.
 */
export async function runScheduledJob(
  jobId: string,
  job: FirebaseFirestore.DocumentData
): Promise<ScheduledJobResult> {
  const jobRef = getAdminDb().collection("scheduled_emails").doc(jobId);

  try {
    const response = await fetch(`${BASE_URL}/api/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Lets send-email accept this server-to-server call now that it requires auth.
        ...(process.env.CRON_SECRET ? { "x-internal-secret": process.env.CRON_SECRET } : {}),
      },
      body: JSON.stringify({
        recipients: job.recipients,
        subject: job.subject,
        message: job.message,
        // Sender context — without these the job silently changed provider.
        gmailEmail: job.gmailEmail,
        senderName: job.senderName,
        replyTo: job.replyTo,
      }),
    });

    const result = await response.json().catch(() => ({}));
    const sent = Number(result.sent ?? 0);
    const failed = Number(result.failed ?? 0);

    // A simulated send is not a send.
    const genuinelySent = response.ok && sent > 0 && !result.simulated;

    if (!genuinelySent) {
      const error = result.simulated
        ? "Email provider not configured — the send was simulated, not delivered."
        : result.error || `send-email returned HTTP ${response.status} with ${sent} sent`;

      await jobRef.update({
        status: "failed",
        failedAt: new Date().toISOString(),
        error,
        result: { sent, failed },
      });
      return { ok: false, sent, failed, error };
    }

    await jobRef.update({
      status: failed > 0 ? "partial" : "sent",
      sentAt: new Date().toISOString(),
      result: { sent, failed, errors: result.errors ?? null },
    });
    return { ok: true, sent, failed };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    await jobRef
      .update({ status: "failed", failedAt: new Date().toISOString(), error })
      .catch(() => {});
    return { ok: false, sent: 0, failed: (job.recipients || []).length, error };
  }
}
