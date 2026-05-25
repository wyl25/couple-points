import { NextResponse } from "next/server";
import { cleanText, jsonError, positiveInt, requireSpaceId } from "@/lib/api";
import { createTask } from "@/lib/store";
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

  try {
    return NextResponse.json(await createTask(auth.spaceId, { title, description, points, cycle }));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "创建任务失败", 400);
  }
}
