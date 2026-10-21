/**
 * Transactional email via Resend (https://resend.com).
 * Set RESEND_API_KEY and EMAIL_FROM on Fly / .env.local.
 * Without keys, sendAccountInvite returns { ok: false } so callers can still create the account.
 */

export type SendResult = { ok: true } | { ok: false; error: string };

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return {
      ok: false,
      error: "Email is not configured (set RESEND_API_KEY and EMAIL_FROM).",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject: options.subject,
        text: options.text,
        html: options.html || undefined,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      return { ok: false, error: `Email provider error (${response.status}): ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Email send failed" };
  }
}

function appBaseUrl() {
  return (process.env.APP_BASE_URL || process.env.ADMIN_URL || "https://opas-admin.fly.dev").replace(
    /\/$/,
    ""
  );
}

export async function sendStaffInvite(options: {
  to: string;
  name: string;
  password: string;
  companyName: string;
}): Promise<SendResult> {
  const loginUrl = `${appBaseUrl()}/login`;
  const subject = `${options.companyName} — kirjautumistiedot / sign-in details`;
  const text = [
    `Hei ${options.name},`,
    "",
    `Sinulle on luotu tili yritykseen ${options.companyName}.`,
    "",
    `Sähköposti: ${options.to}`,
    `Salasana: ${options.password}`,
    "",
    `Kirjaudu: ${loginUrl}`,
    "",
    "Vaihda salasana kirjautumisen jälkeen Profiili-sivulta.",
    "",
    "---",
    `Hello ${options.name},`,
    "",
    `An account was created for you at ${options.companyName}.`,
    "",
    `Email: ${options.to}`,
    `Password: ${options.password}`,
    "",
    `Sign in: ${loginUrl}`,
    "",
    "Change your password after signing in on the Profile page.",
  ].join("\n");

  return sendEmail({ to: options.to, subject, text });
}

export async function sendCoachInvite(options: {
  to: string;
  coachName: string;
  username: string;
  password: string;
  companyName: string;
}): Promise<SendResult> {
  const loginUrl = `${appBaseUrl()}/login`;
  const subject = `${options.companyName} — valmentajaportaalin tunnukset / coach portal login`;
  const text = [
    `Hei ${options.coachName},`,
    "",
    `Sinulle on luotu kirjautuminen yrityksen ${options.companyName} valmentajaportaaliin.`,
    "",
    `Käyttäjänimi: ${options.username}`,
    `Salasana: ${options.password}`,
    "",
    `Kirjaudu: ${loginUrl}`,
    "(Valitse kirjautumistyypiksi valmentaja / profile.)",
    "",
    "Ensimmäisellä kerralla sinua pyydetään vaihtamaan salasana.",
    "",
    "---",
    `Hello ${options.coachName},`,
    "",
    `A coach portal login was created for you at ${options.companyName}.`,
    "",
    `Username: ${options.username}`,
    `Password: ${options.password}`,
    "",
    `Sign in: ${loginUrl}`,
    "(Choose the profile / coach sign-in option.)",
    "",
    "You will be asked to set your own password on first login.",
  ].join("\n");

  return sendEmail({ to: options.to, subject, text });
}
