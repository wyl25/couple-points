import { NextResponse } from "next/server";
import { requireSpaceId } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const auth = requireSpaceId();
  if ("error" in auth) return auth.error;

  const supabase = getSupabaseAdmin();
  const [space, members, tasks, completions, rewards, redemptions] = await Promise.all([
    supabase.from("spaces").select("id,name,created_at").eq("id", auth.spaceId).single(),
    supabase.from("members").select("*").eq("space_id", auth.spaceId).order("points", { ascending: false }).order("created_at"),
    supabase.from("tasks").select("*").eq("space_id", auth.spaceId).order("is_active", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("task_completions").select("*, tasks(title, cycle), members(name)").eq("space_id", auth.spaceId).order("completed_at", { ascending: false }).limit(40),
    supabase.from("rewards").select("*").eq("space_id", auth.spaceId).order("is_active", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("reward_redemptions").select("*, rewards(title), members:members!reward_redemptions_member_id_fkey(name)").eq("space_id", auth.spaceId).order("requested_at", { ascending: false }).limit(40)
  ]);

  const firstError = [space, members, tasks, completions, rewards, redemptions].find((result) => result.error)?.error;
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

  return NextResponse.json({
    space: space.data,
    members: members.data ?? [],
    tasks: tasks.data ?? [],
    completions: completions.data ?? [],
    rewards: rewards.data ?? [],
    redemptions: redemptions.data ?? []
  });
}
