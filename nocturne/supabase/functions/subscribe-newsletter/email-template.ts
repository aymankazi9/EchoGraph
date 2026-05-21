export function generateConfirmationEmail({
  confirmationUrl,
}: {
  email: string
  confirmationUrl: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm your Nocturne subscription</title>
</head>
<body style="margin:0;padding:0;background-color:#0F1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">

    <!-- Header -->
    <div style="margin-bottom:24px;">
      <span style="font-size:32px;color:#1D9E75;font-weight:500;line-height:1;">N</span>
      <span style="font-size:18px;color:#E8EDF5;font-weight:500;margin-left:8px;">Nocturne</span>
    </div>

    <!-- Heading -->
    <h1 style="font-size:20px;color:#E8EDF5;font-weight:500;margin:24px 0 8px;padding:0;">
      Confirm your subscription
    </h1>

    <!-- Body -->
    <p style="font-size:14px;color:#8B97AD;line-height:1.6;margin:0 0 24px;padding:0;">
      Click the button below to confirm your subscription to Nocturne updates.
      This link expires in 24 hours.
    </p>

    <!-- CTA button -->
    <a href="${confirmationUrl}"
       style="display:block;width:fit-content;margin:0 auto 24px;background-color:#1D9E75;color:#0F1117;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:500;text-decoration:none;">
      Confirm subscription &#x2192;
    </a>

    <!-- Security note -->
    <p style="font-size:12px;color:#5A6880;text-align:center;margin:0 0 32px;padding:0;">
      If you didn&#39;t request this, you can safely ignore this email.
      Your email will not be added without confirmation.
    </p>

    <!-- Divider -->
    <div style="border-top:1px solid #2A3347;margin:32px 0;"></div>

    <!-- Footer -->
    <p style="font-size:12px;color:#5A6880;text-align:center;margin:0 0 4px;padding:0;">
      Nocturne &middot; Privacy-first study intelligence
    </p>
    <p style="font-size:12px;color:#5A6880;text-align:center;margin:0;padding:0;">
      <!-- TODO: confirm final domain before launch -->
      You&#39;re receiving this because you signed up at nocturne.app
    </p>

  </div>
</body>
</html>`
}
