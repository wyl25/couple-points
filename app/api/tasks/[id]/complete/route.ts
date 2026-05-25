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
  const [{ data: task, error: taskError }, { data: member, error: memberError }] = await Promise.all([
    supabase.from("tasks").select("id,points,is_active").eq("id", params.id).eq("space_id", auth.spaceId).single(),
    supabase.from("members").select("id,points,is_active").eq("id", memberId).eq("space_id", auth.spaceId).single()
  ]);

  if (taskError || !task || !task.is_active) return jsonError("任务不存在或已停用。", 404);
  if (memberError || !member || !member.is_active) return jsonError("成员不存在或已停用。", 404);

  const { data: completion, error: completionError } = await supabase
    .from("task_completions")
    .insert({ space_id: auth.spaceId, task_id: task.id, member_id: member.id, points: task.points })
    .select("*, tasks(title, cycle), members(name)")
    .single();

  if (completionError) return jsonError(completionError.message, 400);

  const { data: updatedMember, error: updateError } = await supabase
    .from("members")
    .update({ points: member.points + task.points })
    .eq("id", member.id)
    .eq("space_id", auth.spaceId)
    .select("*")
    .single();

  if (updateError) return jsonError(updateError.message, 400);
  return NextResponse.json({ completion, member: updatedMember });
}
