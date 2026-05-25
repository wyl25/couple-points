import { NextResponse } from "next/server";
import { jsonError, requireSpaceId } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase";

type Params = { params: { id: string } };

export async function POST(request: Request, { params }: Params) {
  const auth = requireSpaceId();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const resolvedByMemberId = typeof body.resolvedByMemberId === "string" ? body.resolvedByMemberId : null;

  const { data, error } = await getSupabaseAdmin()
    .from("reward_redemptions")
    .update({ status: "rejected", resolved_at: new Date().toISOString(), resolved_by_member_id: resolvedByMemberId })
    .eq("id", params.id)
    .eq("space_id", auth.spaceId)
    .eq("status", "pending")
    .select("*, rewards(title), members:members!reward_redemptions_member_id_fkey(name)")
    .single();

  if (error) return jsonError(error.message, 400);
  return NextResponse.json(data);
}
