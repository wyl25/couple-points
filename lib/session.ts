import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const textEncoder = new TextEncoder();

function secret(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function hashInvite(inviteCode: string) {
  return createHash("sha256")
    .update(`${secret("INVITE_HASH_SECRET")}:${inviteCode.trim()}`)
    .digest("hex");
}

export function signSession(spaceId: string) {
  const payload = Buffer.from(JSON.stringify({ spaceId })).toString("base64url");
  const signature = createHmac("sha256", secret("SESSION_SECRET")).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySession(token?: string) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = createHmac("sha256", secret("SESSION_SECRET")).update(payload).digest("base64url");
  const providedBytes = textEncoder.encode(signature);
  const expectedBytes = textEncoder.encode(expected);
  if (providedBytes.length !== expectedBytes.length) return null;
  if (!timingSafeEqual(providedBytes, expectedBytes)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof parsed.spaceId === "string" ? parsed.spaceId : null;
  } catch {
    return null;
  }
}
