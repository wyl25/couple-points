import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jsonError, SESSION_COOKIE } from "@/lib/api";
import { hashInvite, signSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";
  if (!inviteCode) return jsonError("请输入邀请码。");

  const supabase = getSupabaseAdmin();
  const { data: space, error } = await supabase
    .from("spaces")
    .select("id,name,created_at")
    .eq("invite_hash", hashInvite(inviteCode))
    .single();

  if (error || !space) return jsonError("邀请码不正确。", 401);

  cookies().set(SESSION_COOKIE, signSession(space.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180
  });

  return NextResponse.json({ space });
}
