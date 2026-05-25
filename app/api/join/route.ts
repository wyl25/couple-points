import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jsonError, SESSION_COOKIE } from "@/lib/api";
import { hashInvite, signSession } from "@/lib/session";
import { ensureCloudBaseCollections, ensureCloudBaseSpace, findSpaceByInviteHash } from "@/lib/store";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";
  if (!inviteCode) return jsonError("请输入邀请码。");

  const inviteHash = hashInvite(inviteCode);
  const defaultInviteCode = process.env.INVITE_CODE || "love-0525";
  if (inviteCode === defaultInviteCode) {
    await ensureCloudBaseCollections();
    await ensureCloudBaseSpace({
      name: process.env.SPACE_NAME || "我们的积分空间",
      invite_hash: inviteHash
    });
  }

  const space = await findSpaceByInviteHash(inviteHash);
  if (!space) return jsonError("邀请码不正确。", 401);

  cookies().set(SESSION_COOKIE, signSession(space.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180
  });

  return NextResponse.json({ space });
}
