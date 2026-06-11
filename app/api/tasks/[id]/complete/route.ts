import { NextResponse } from "next/server";
import { jsonError, requireSpaceId } from "@/lib/api";
import { completeTask } from "@/lib/store";

type Params = { params: { id: string } };

export async function POST(request: Request, { params }: Params) {
  const auth = requireSpaceId();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  const dateKey = typeof body.dateKey === "string" ? body.dateKey : undefined;
  if (!memberId) return jsonError("请选择成员。");

  try {
    return NextResponse.json(await completeTask(auth.spaceId, params.id, memberId, dateKey));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "完成任务失败", 400);
  }
}
