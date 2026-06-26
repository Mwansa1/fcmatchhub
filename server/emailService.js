function hasEmailProvider() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

async function sendVerificationEmail({ to, clubName, verificationUrl }) {
  const subject = "Verify your FC MatchHub manager account";
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #101827;">
      <h1 style="margin: 0 0 12px;">Verify your manager account</h1>
      <p>Confirm this email to activate the FC MatchHub account for <strong>${clubName}</strong>.</p>
      <p><a href="${verificationUrl}" style="display: inline-block; padding: 12px 16px; background: #d4a820; color: #101010; text-decoration: none; font-weight: 700;">Verify Email</a></p>
      <p>If the button does not work, open this link:</p>
      <p>${verificationUrl}</p>
    </div>
  `;

  if (!hasEmailProvider() && process.env.ALLOW_DEV_VERIFY_LINK === "true") {
    return {
      sent: false,
      provider: "development",
      devVerificationLink: verificationUrl
    };
  }

  if (!hasEmailProvider()) {
    throw new Error("Email service is not configured. Add RESEND_API_KEY and EMAIL_FROM before accepting real signups.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject,
      html
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Email provider rejected the verification email.");
  }

  return {
    sent: true,
    provider: "resend",
    id: payload.id
  };
}

async function sendPasswordResetEmail({ to, clubName, resetUrl }) {
  const subject = "Reset your FC MatchHub password";
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #101827;">
      <h1 style="margin: 0 0 12px;">Reset your password</h1>
      <p>Use this secure link to choose a new password for <strong>${clubName || "your club"}</strong>.</p>
      <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 16px; background: #d4a820; color: #101010; text-decoration: none; font-weight: 700;">Change Password</a></p>
      <p>This link expires soon. If you did not request this, you can ignore this email.</p>
      <p>If the button does not work, open this link:</p>
      <p>${resetUrl}</p>
    </div>
  `;

  if (!hasEmailProvider() && process.env.ALLOW_DEV_VERIFY_LINK === "true") {
    return {
      sent: false,
      provider: "development",
      devResetLink: resetUrl
    };
  }

  if (!hasEmailProvider()) {
    throw new Error("Email service is not configured. Add RESEND_API_KEY and EMAIL_FROM before sending password reset emails.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject,
      html
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Email provider rejected the password reset email.");
  }

  return {
    sent: true,
    provider: "resend",
    id: payload.id
  };
}

module.exports = {
  hasEmailProvider,
  sendPasswordResetEmail,
  sendVerificationEmail
};
