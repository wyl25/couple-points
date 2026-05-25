import { NextResponse } from "next/server";
import { jsonError, requireSpaceId } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase";

type Params = { params: { id: string } };

export async function POST(request: Request, { params }: Params) {
  const auth = requireSpaceId();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  if (!memberId) return jsonError("请选择成员。");

  const supabase = getSupabaseAdmin();
  const [{ data: reward, error: rewardError }, { data: member, error: memberError }] = await Promise.all([
    supabase.from("rewards").select("id,cost,is_active").eq("id", params.id).eq("space_id", auth.spaceId).single(),
    supabase.from("members").select("id,is_active").eq("id", memberId).eq("space_id", auth.spaceId).single()
  ]);

  if (rewardError || !reward || !reward.is_active) return jsonError("奖励不存在或已停用。", 404);
  if (memberError || !member || !member.is_active) return jsonError("成员不存在或已停用。", 404);

  const { data, error } = await supabase
    .from("reward_redemptions")
    .insert({ space_id: auth.spaceId, reward_id: reward.id, member_id: member.id, cost: reward.cost })
    .select("*, rewards(title), members:members!reward_redemptions_member_id_fkey(name)")
    .single();

  if (error) return jsonError(error.message, 400);
  return NextResponse.json(data);
}
