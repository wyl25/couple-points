import { NextResponse } from "next/server";
import { cleanText, jsonError, positiveInt, requireSpaceId } from "@/lib/api";
import { updateTask } from "@/lib/store";
import type { Cycle } from "@/lib/types";

const cycles = new Set(["daily", "weekly", "none"]);

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  const auth = requireSpaceId();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  if ("title" in body) {
    const title = cleanText(body.title, 80);
    if (!title) return jsonError("请输入任务名称。");
    updates.title = title;
  }
  if ("description" in body) updates.description = cleanText(body.description, 300);
  if ("points" in body) {
    const points = positiveInt(body.points);
    if (!points) return jsonError("任务积分必须是正整数。");
    updates.points = points;
  }
  if ("cycle" in body) {
    if (!cycles.has(body.cycle)) return jsonError("任务周期无效。");
    updates.cycle = body.cycle as Cycle;
  }
  if ("is_active" in body) updates.is_active = Boolean(body.is_active);

  try {
    return NextResponse.json(await updateTask(auth.spaceId, params.id, updates));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "更新任务失败", 400);
  }
}
