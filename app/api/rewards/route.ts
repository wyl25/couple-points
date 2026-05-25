import { NextResponse } from "next/server";
import { cleanText, jsonError, positiveInt, requireSpaceId } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const auth = requireSpaceId();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const title = cleanText(body.title, 80);
  const description = cleanText(body.description, 300);
  const cost = positiveInt(body.cost);
  if (!title) return jsonError("请输入奖励名称。");
  if (!cost) return jsonError("奖励积分必须是正整数。");

  const { data, error } = await getSupabaseAdmin()
    .from("rewards")
    .insert({ space_id: auth.spaceId, title, description, cost })
    .select("*")
    .single();

  if (error) return jsonError(error.message, 400);
  return NextResponse.json(data);
}
