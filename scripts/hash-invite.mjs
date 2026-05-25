import { createHash } from "node:crypto";

const [invite, secret] = process.argv.slice(2);
if (!invite || !secret) {
  console.error("Usage: node scripts/hash-invite.mjs <invite-code> <secret>");
  process.exit(1);
}

const hash = createHash("sha256").update(`${secret}:${invite.trim()}`).digest("hex");
console.log(hash);
