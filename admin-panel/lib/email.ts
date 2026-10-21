/**
 * Transactional email via Resend (https://resend.com).
 * Requires RESEND_API_KEY on Fly / .env.local.
 * The From address comes from the company setting (invite_from_email), not a hardcoded env value.
 */

export type SendResult = { ok: true } | { ok: false; error: string };

function normalizeFrom(from: string, companyName: string): string {
  const trimmed = from.trim();
  if (!trimmed) return "";
  // Already "Name <email@domain>"
  if (trimmed.includes("<") && trimmed.includes(">")) return trimmed;
  // Bare email → prefix with company name
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    const safeName = (companyName || "Opas").replace(/[<>"]/g, "").trim() || "Opas";
    return `${safeName} <${trimmed}>`;
  }
  return trimmed;
}

export async function sendEmail(options: {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error: "Email is not configured (set RESEND_API_KEY on the server).",
    };
  }
  if (!options.from?.trim()) {
    return {
      ok: false,
      error: "Set the company invite From email in Settings first.",
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
        from: options.from,
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
  fromEmail: string | null | undefined;
}): Promise<SendResult> {
  const from = normalizeFrom(options.fromEmail || "", options.companyName);
  if (!from) {
    return { ok: false, error: "Set the company invite From email in Settings first." };
  }
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

  return sendEmail({ to: options.to, from, subject, text });
}

export async function sendCoachInvite(options: {
  to: string;
  coachName: string;
  username: string;
  password: string;
  companyName: string;
  fromEmail: string | null | undefined;
}): Promise<SendResult> {
  const from = normalizeFrom(options.fromEmail || "", options.companyName);
  if (!from) {
    return { ok: false, error: "Set the company invite From email in Settings first." };
  }
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

  return sendEmail({ to: options.to, from, subject, text });
}
