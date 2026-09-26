import crypto from "crypto";
import { STAFF_COOKIE } from "./brand";

const SECRET = process.env.SESSION_SECRET || process.env.ADMIN_PANEL_PASSWORD || "dev-secret-change-me";

export type StaffRole = "super_admin" | "org_admin" | "member" | "viewer" | "analyst" | "editor";

export type StaffSession = {
  userId: string;
  email: string;
  name: string;
  role: StaffRole;
  organizationId: string | null;
};

export function createStaffSessionToken(payload: StaffSession): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
  return `${payloadB64}.${signature}`;
}

export function verifyStaffSessionToken(token: string | undefined | null): StaffSession | null {
  if (!token) return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expectedSig = crypto.createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as StaffSession;
    if (!parsed?.userId || !parsed.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export { STAFF_COOKIE };
