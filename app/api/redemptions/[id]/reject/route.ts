import { NextResponse } from "next/server";
import { jsonError, requireSpaceId } from "@/lib/api";
import { rejectRedemption } from "@/lib/store";

type Params = { params: { id: string } };

export async function POST(request: Request, { params }: Params) {
  const auth = requireSpaceId();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const resolvedByMemberId = typeof body.resolvedByMemberId === "string" ? body.resolvedByMemberId : null;

  try {
    return NextResponse.json(await rejectRedemption(auth.spaceId, params.id, resolvedByMemberId));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "拒绝兑换失败", 400);
  }
}
