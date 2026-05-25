import { NextResponse } from "next/server";
import { cleanText, jsonError, positiveInt, requireSpaceId } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase";

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  const auth = requireSpaceId();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ("title" in body) {
    const title = cleanText(body.title, 80);
    if (!title) return jsonError("请输入奖励名称。");
    updates.title = title;
  }
  if ("description" in body) updates.description = cleanText(body.description, 300);
  if ("cost" in body) {
    const cost = positiveInt(body.cost);
    if (!cost) return jsonError("奖励积分必须是正整数。");
    updates.cost = cost;
  }
  if ("is_active" in body) updates.is_active = Boolean(body.is_active);

  const { data, error } = await getSupabaseAdmin()
    .from("rewards")
    .update(updates)
    .eq("id", params.id)
    .eq("space_id", auth.spaceId)
    .select("*")
    .single();

  if (error) return jsonError(error.message, 400);
  return NextResponse.json(data);
}
