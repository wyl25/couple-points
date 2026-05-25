import { NextResponse } from "next/server";
import { cleanText, jsonError, positiveInt, requireSpaceId } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { Cycle } from "@/lib/types";

const cycles = new Set(["daily", "weekly", "none"]);

export async function POST(request: Request) {
  const auth = requireSpaceId();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const title = cleanText(body.title, 80);
  const description = cleanText(body.description, 300);
  const points = positiveInt(body.points);
  const cycle = cycles.has(body.cycle) ? (body.cycle as Cycle) : "daily";
  if (!title) return jsonError("请输入任务名称。");
  if (!points) return jsonError("任务积分必须是正整数。");

  const { data, error } = await getSupabaseAdmin()
    .from("tasks")
    .insert({ space_id: auth.spaceId, title, description, points, cycle })
    .select("*")
    .single();

  if (error) return jsonError(error.message, 400);
  return NextResponse.json(data);
}
