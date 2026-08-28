export interface RecipientOutcome {
  email: string;
  ok: boolean;
  queued?: boolean;
  error?: string;
}

/** Roll per-recipient email results into a display tally. queued wins over failed. */
export function tallyEmailOutcomes(
  outcomes: RecipientOutcome[]
): { sent: number; failed: number; queued: number } {
  let sent = 0;
  let failed = 0;
  let queued = 0;
  for (const o of outcomes) {
    if (o.ok) sent++;
    else if (o.queued) queued++;
    else failed++;
  }
  return { sent, failed, queued };
}
