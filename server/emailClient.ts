import { Resend } from "resend";

let cachedConnectionSettings: any = null;

async function getCredentials(): Promise<{ apiKey: string; fromEmail: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error("X-Replit-Token not found for repl/depl");
  }

  const response = await fetch(
    "https://" +
      hostname +
      "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    },
  );
  const data = await response.json();
  const item = data.items?.[0];

  if (!item || !item.settings?.api_key) {
    throw new Error("Resend not connected");
  }

  cachedConnectionSettings = item;
  return {
    apiKey: item.settings.api_key,
    fromEmail: item.settings.from_email,
  };
}

export async function getUncachableResendClient(): Promise<{
  client: Resend;
  fromEmail: string;
}> {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail,
  };
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetCode: string,
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset your Beat Haven password</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;background:#13131a;border-radius:16px;padding:40px 32px;">
          <tr>
            <td style="text-align:center;">
              <h1 style="color:#ffffff;font-size:24px;margin:0 0 8px 0;font-weight:700;">Beat Haven</h1>
              <p style="color:#9ca3af;font-size:14px;margin:0 0 32px 0;">Reset your password</p>
            </td>
          </tr>
          <tr>
            <td>
              <p style="color:#e5e7eb;font-size:16px;line-height:1.5;margin:0 0 24px 0;">
                We received a request to reset your password. Use the code below to set a new password. This code expires in <strong>1 hour</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center">
              <div style="background:#1f1f2a;border:1px solid #2d2d3d;border-radius:12px;padding:20px 24px;display:inline-block;margin:8px 0 24px 0;">
                <div style="color:#a78bfa;font-size:32px;font-weight:700;letter-spacing:6px;font-family:'SF Mono',Monaco,Consolas,monospace;">${resetCode}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td>
              <p style="color:#9ca3af;font-size:13px;line-height:1.5;margin:0 0 8px 0;">
                Didn't request this? You can safely ignore this email &mdash; your password will not change.
              </p>
              <p style="color:#6b7280;font-size:12px;line-height:1.5;margin:24px 0 0 0;text-align:center;">
                &copy; Beat Haven
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  const text = `Beat Haven — Reset your password

We received a request to reset your password.

Your reset code: ${resetCode}

This code expires in 1 hour.

Didn't request this? You can safely ignore this email — your password will not change.
`;

  const result = await client.emails.send({
    from: fromEmail,
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
