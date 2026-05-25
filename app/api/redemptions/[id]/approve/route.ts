import { NextResponse } from "next/server";
import { jsonError, requireSpaceId } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase";

type Params = { params: { id: string } };

export async function POST(request: Request, { params }: Params) {
  const auth = requireSpaceId();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const resolvedByMemberId = typeof body.resolvedByMemberId === "string" ? body.resolvedByMemberId : null;
  const supabase = getSupabaseAdmin();

  const { data: redemption, error: redemptionError } = await supabase
    .from("reward_redemptions")
    .select("id,member_id,cost,status")
    .eq("id", params.id)
    .eq("space_id", auth.spaceId)
    .single();

  if (redemptionError || !redemption) return jsonError("兑换申请不存在。", 404);
  if (redemption.status !== "pending") return jsonError("这个兑换申请已经处理过。", 409);

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id,points")
    .eq("id", redemption.member_id)
    .eq("space_id", auth.spaceId)
    .single();

  if (memberError || !member) return jsonError("成员不存在。", 404);
  if (member.points < redemption.cost) return jsonError("积分不足，无法确认兑换。", 409);

  const [{ data: updatedRedemption, error: updateRedemptionError }, { data: updatedMember, error: updateMemberError }] = await Promise.all([
    supabase
      .from("reward_redemptions")
      .update({ status: "approved", resolved_at: new Date().toISOString(), resolved_by_member_id: resolvedByMemberId })
      .eq("id", redemption.id)
      .eq("space_id", auth.spaceId)
      .select("*, rewards(title), members:members!reward_redemptions_member_id_fkey(name)")
      .single(),
    supabase
      .from("members")
      .update({ points: member.points - redemption.cost })
      .eq("id", member.id)
      .eq("space_id", auth.spaceId)
      .select("*")
      .single()
  ]);

  if (updateRedemptionError) return jsonError(updateRedemptionError.message, 400);
  if (updateMemberError) return jsonError(updateMemberError.message, 400);
  return NextResponse.json({ redemption: updatedRedemption, member: updatedMember });
}
