import tcb from "@cloudbase/node-sdk";
import { createHash } from "node:crypto";

for (const name of ["CLOUDBASE_ENV_ID", "INVITE_HASH_SECRET"]) {
  if (!process.env[name]) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
}

const collections = [
  "couple_points_spaces",
  "couple_points_members",
  "couple_points_tasks",
  "couple_points_task_completions",
  "couple_points_rewards",
  "couple_points_reward_redemptions",
  "couple_points_point_events",
  "couple_points_daily_settlements"
];

const app = tcb.init({
  env: process.env.CLOUDBASE_ENV_ID,
  ...(process.env.TENCENT_SECRET_ID && process.env.TENCENT_SECRET_KEY
    ? { secretId: process.env.TENCENT_SECRET_ID, secretKey: process.env.TENCENT_SECRET_KEY }
    : {})
});
const db = app.database(process.env.CLOUDBASE_DATABASE ? { database: process.env.CLOUDBASE_DATABASE } : {});

for (const name of collections) {
  try {
    await db.createCollection(name);
    console.log(`created ${name}`);
  } catch {
    console.log(`exists ${name}`);
  }
}

const inviteCode = process.env.INVITE_CODE || "love-0525";
const inviteHash = createHash("sha256")
  .update(`${process.env.INVITE_HASH_SECRET}:${inviteCode}`)
  .digest("hex");

await db.collection("couple_points_spaces").doc("default-space").set({
  id: "default-space",
  name: process.env.SPACE_NAME || "Our Points",
  invite_hash: inviteHash,
  created_at: new Date().toISOString()
});

console.log(`seeded default space; invite code: ${inviteCode}`);
