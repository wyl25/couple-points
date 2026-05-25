import { NextResponse } from "next/server";
import { cleanText, jsonError, requireSpaceId } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const auth = requireSpaceId();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name, 40);
  if (!name) return jsonError("请输入成员昵称。");

  const { data, error } = await getSupabaseAdmin()
    .from("members")
    .insert({ space_id: auth.spaceId, name })
    .select("*")
    .single();

  if (error) return jsonError(error.code === "23505" ? "这个昵称已经存在。" : error.message, 400);
  return NextResponse.json(data);
}
