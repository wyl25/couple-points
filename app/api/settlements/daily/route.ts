import { NextResponse } from "next/server";
import { jsonError, requireSpaceId } from "@/lib/api";
import { settleDaily } from "@/lib/store";

export async function POST(request: Request) {
  const auth = requireSpaceId();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  const dateKey = typeof body.dateKey === "string" ? body.dateKey : undefined;
  if (!memberId) return jsonError("请选择要结算的成员。");

  try {
    return NextResponse.json(await settleDaily(auth.spaceId, memberId, dateKey));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "结算失败", 400);
  }
}
