import { NextResponse } from "next/server";
import { jsonError, requireSpaceId } from "@/lib/api";
import { redeemReward } from "@/lib/store";

type Params = { params: { id: string } };

export async function POST(request: Request, { params }: Params) {
  const auth = requireSpaceId();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  if (!memberId) return jsonError("请选择成员。");

  try {
    return NextResponse.json(await redeemReward(auth.spaceId, params.id, memberId));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "提交兑换失败", 400);
  }
}
