import crypto from "crypto";

// Falls back to ADMIN_PANEL_PASSWORD if SESSION_SECRET isn't set, so this
// doesn't hard-break existing setups — but a dedicated SESSION_SECRET is
// recommended once real coach accounts are in use.
export const COACH_SESSION_COOKIE = "harbor_coach_session";

const SECRET = process.env.SESSION_SECRET || process.env.ADMIN_PANEL_PASSWORD || "dev-secret-change-me";

type CoachSessionPayload = {
  coachAccountId: string;
  coachId: string;
  coachName: string;
};

export function createCoachSessionToken(payload: CoachSessionPayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
  return `${payloadB64}.${signature}`;
}

export function verifyCoachSessionToken(token: string | undefined | null): CoachSessionPayload | null {
  if (!token) return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expectedSig = crypto.createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
  if (signature !== expectedSig) return null; // tampered or forged token

  try {
    return JSON.parse(Buffer.from(payloadB64, "base64url").toString());
  } catch {
    return null;
  }
}
