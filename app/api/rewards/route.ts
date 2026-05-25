import { NextResponse } from "next/server";
import { cleanText, jsonError, positiveInt, requireSpaceId } from "@/lib/api";
import { createReward } from "@/lib/store";

export async function POST(request: Request) {
  const auth = requireSpaceId();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const title = cleanText(body.title, 80);
  const description = cleanText(body.description, 300);
  const cost = positiveInt(body.cost);
  if (!title) return jsonError("请输入奖励名称。");
  if (!cost) return jsonError("奖励积分必须是正整数。");

  try {
    return NextResponse.json(await createReward(auth.spaceId, { title, description, cost }));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "创建奖励失败", 400);
  }
}
