import { Resend } from "resend";

function getCredentials(): { apiKey: string; fromEmail: string } {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured. Add it to environment variables.",
    );
  }

  return { apiKey, fromEmail };
}

export function getResendClient(): { client: Resend; fromEmail: string } {
  const { apiKey, fromEmail } = getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail,
  };
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetCode: string,
): Promise<void> {
  const { client, fromEmail } = getResendClient();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Reset your Beat Haven password</title>
</head>
<body style="margin:0;padding:0;background:#0A0E1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0A0E1A;padding:48px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#1A1F2E;border-radius:20px;overflow:hidden;border:1px solid #2E3548;">
          <tr>
            <td align="center" style="padding:40px 32px 8px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="background:#7B68EE;width:64px;height:64px;border-radius:16px;color:#FFFFFF;font-size:26px;font-weight:800;letter-spacing:1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">BH</td>
                </tr>
              </table>
              <h1 style="color:#FFFFFF;font-size:26px;font-weight:700;margin:20px 0 4px 0;letter-spacing:-0.3px;">Beat Haven</h1>
              <p style="color:#B0B8C4;font-size:14px;margin:0;">Password reset request</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px 32px;">
              <p style="color:#FFFFFF;font-size:16px;line-height:1.6;margin:0 0 24px 0;">Hi there,</p>
              <p style="color:#B0B8C4;font-size:15px;line-height:1.6;margin:0 0 28px 0;">
                We received a request to reset the password for your Beat Haven account. Use the code below in the app to set a new password. This code expires in <strong style="color:#FFFFFF;">1 hour</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 32px 32px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background:#2E3548;border:1px solid #7B68EE;border-radius:14px;">
                <tr>
                  <td align="center" style="padding:22px 36px;">
                    <div style="color:#B0B8C4;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;font-weight:600;">Your reset code</div>
                    <div style="color:#7B68EE;font-size:34px;font-weight:800;letter-spacing:8px;font-family:'SF Mono','Menlo','Monaco','Consolas',monospace;">${resetCode}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <p style="color:#B0B8C4;font-size:13px;line-height:1.6;margin:0 0 8px 0;">
                Didn't request this? You can safely ignore this email &mdash; your password will not change.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <div style="height:1px;background:#2E3548;width:100%;margin:8px 0 20px 0;"></div>
              <p style="color:#B0B8C4;font-size:12px;line-height:1.6;margin:0 0 4px 0;text-align:center;">
                Beat Haven &mdash; Binaural beats for focus, sleep, and meditation
              </p>
              <p style="color:#B0B8C4;font-size:12px;line-height:1.6;margin:0;text-align:center;">
                Need help? Reply to <a href="mailto:recursionlabsllc@gmail.com" style="color:#7B68EE;text-decoration:none;">recursionlabsllc@gmail.com</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="color:#4A5168;font-size:11px;margin:20px 0 0 0;">&copy; Beat Haven &middot; recursionlabs.org</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Beat Haven — Reset your password

We received a request to reset your password.

Your reset code: ${resetCode}

This code expires in 1 hour.

Didn't request this? You can safely ignore this email — your password will not change.

Need help? Reply to recursionlabsllc@gmail.com
`;

  const result = await client.emails.send({
    from: `Beat Haven <${fromEmail}>`,
    to: toEmail,
    subject: "Reset your Beat Haven password",
    html,
    text,
  });

  if (result.error) {
    throw new Error(
      `Resend failed: ${result.error.message || JSON.stringify(result.error)}`,
    );
  }

  console.log(
    `[Email] Password reset email sent to ${toEmail} (id: ${result.data?.id})`,
  );
}
