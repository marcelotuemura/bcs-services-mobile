/**
 * Email sender utility for estimate customer approvals.
 * Uses standard fetch to interface with Resend without introducing extra dependencies.
 */
export async function sendEstimateEmail(params: {
  estimateNumber: string;
  customerEmail: string;
  total: number;
  approvalUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.ESTIMATE_FROM_EMAIL || 'estimates@bestcoatingssolution.com';

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY is not configured. Falling back to manual link sharing.');
    return { ok: false, error: 'email_missing_config' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [params.customerEmail],
        subject: `Estimate #${params.estimateNumber} from Best Coatings Solution`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
            <h2 style="color: #0070f3;">Estimate #${params.estimateNumber}</h2>
            <p>Hello,</p>
            <p>An estimate has been prepared for your review by Best Coatings Solution.</p>
            <div style="background-color: #f5f5f7; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Customer:</strong> ${params.customerEmail}</p>
              <p style="margin: 0;"><strong>Total Amount:</strong> $${params.total.toFixed(2)}</p>
            </div>
            <p>Please click the button below to view the detailed estimate, line items, and submit your approval or feedback:</p>
            <p style="margin: 30px 0;">
              <a href="${params.approvalUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Review and Approve Estimate
              </a>
            </p>
            <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />
            <p style="font-size: 12px; color: #888; text-align: center;">
              This is an automated message from Best Coatings Solution. If you have any questions, please reply to this email.
            </p>
          </div>
        `
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[email] Resend API error:', errText);
      return { ok: false, error: `Resend API failed: ${res.statusText}` };
    }

    console.log(`[email] Estimate approval link successfully sent to ${params.customerEmail}`);
    return { ok: true };
  } catch (err) {
    console.error('[email] Failed to send estimate email:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown network error' };
  }
}
