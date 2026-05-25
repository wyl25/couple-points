import { randomUUID } from "node:crypto";
import tcb from "@cloudbase/node-sdk";
import type {
  Cycle,
  DailySettlement,
  DailySettlementResult,
  Member,
  MemberStats,
  PointEvent,
  PointEventType,
  Reward,
  RewardRedemption,
  Space,
  Task,
  TaskCompletion
} from "@/lib/types";

type CreateTaskInput = Pick<Task, "member_id" | "title" | "description" | "points" | "penalty_points" | "cycle">;
type UpdateTaskInput = Partial<Pick<Task, "member_id" | "title" | "description" | "points" | "penalty_points" | "cycle" | "is_active">>;
type CreateRewardInput = Pick<Reward, "title" | "description" | "cost">;
type UpdateRewardInput = Partial<Pick<Reward, "title" | "description" | "cost" | "is_active">>;

const names = {
  spaces: "couple_points_spaces",
  members: "couple_points_members",
  tasks: "couple_points_tasks",
  completions: "couple_points_task_completions",
  rewards: "couple_points_rewards",
  redemptions: "couple_points_reward_redemptions",
  pointEvents: "couple_points_point_events",
  settlements: "couple_points_daily_settlements"
};

const dayMs = 24 * 60 * 60 * 1000;

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function now() {
  return new Date().toISOString();
}

function dateKey(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * dayMs);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function shiftDateKey(key: string, offsetDays: number) {
  const [year, month, day] = key.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day) + offsetDays * dayMs;
  return new Date(utc).toISOString().slice(0, 10);
}

function withId<T>(data: T & { _id?: string; id?: string }) {
  const { _id, ...rest } = data;
  return { ...rest, id: data.id ?? _id } as T & { id: string };
}

function getDb() {
  const env = requireEnv("CLOUDBASE_ENV_ID");
  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;
  const app = tcb.init({
    env,
    ...(secretId && secretKey ? { secretId, secretKey } : {})
  });
  return app.database(process.env.CLOUDBASE_DATABASE ? { database: process.env.CLOUDBASE_DATABASE } : {});
}

async function getAll<T>(collectionName: string, where: Record<string, unknown> = {}) {
  const result = await getDb().collection(collectionName).where(where).limit(1000).get();
  return (result.data ?? []).map((item) => withId(item as T & { _id?: string; id?: string }));
}

async function getOne<T>(collectionName: string, where: Record<string, unknown>) {
  const [item] = await getAll<T>(collectionName, where);
  return item ?? null;
}

async function setDoc<T extends { id: string }>(collectionName: string, data: T) {
  await getDb().collection(collectionName).doc(data.id).set(data);
  return data;
}

async function updateDoc<T>(collectionName: string, id: string, updates: Partial<T>) {
  await getDb().collection(collectionName).doc(id).update(updates);
  const updated = await getDb().collection(collectionName).doc(id).get();
  return withId((updated.data?.[0] ?? { id, ...updates }) as T & { _id?: string; id?: string });
}

async function addPointEvent(input: {
  space_id: string;
  member_id: string;
  type: PointEventType;
  amount: number;
  reason: string;
  task_id?: string | null;
  reward_id?: string | null;
  redemption_id?: string | null;
  date_key?: string;
}) {
  return setDoc<PointEvent>(names.pointEvents, {
    id: randomUUID(),
    date_key: input.date_key ?? dateKey(),
    created_at: now(),
    task_id: null,
    reward_id: null,
    redemption_id: null,
    ...input
  });
}

function attachCompletionRefs(item: TaskCompletion, tasks: Map<string, Task>, members: Map<string, Member>) {
  const task = tasks.get(item.task_id);
  const member = members.get(item.member_id);
  return {
    ...item,
    tasks: task ? { title: task.title, cycle: task.cycle } : null,
    members: member ? { name: member.name } : null
  };
}

function attachRedemptionRefs(item: RewardRedemption, rewards: Map<string, Reward>, members: Map<string, Member>) {
  const reward = rewards.get(item.reward_id);
  const member = members.get(item.member_id);
  return {
    ...item,
    rewards: reward ? { title: reward.title } : null,
    members: member ? { name: member.name } : null
  };
}

function buildStats(
  members: Member[],
  tasks: Task[],
  completions: TaskCompletion[],
  settlements: DailySettlement[],
  pointEvents: PointEvent[]
) {
  const today = dateKey();
  const yesterday = dateKey(-1);
  const stats: Record<string, MemberStats> = {};

  for (const member of members) {
    const dailyTasks = tasks.filter((task) => task.member_id === member.id && task.is_active && task.cycle === "daily");
    const todayCompletedTaskIds = new Set(
      completions
        .filter((item) => item.member_id === member.id && item.date_key === today)
        .map((item) => item.task_id)
    );

    let streak = 0;
    for (let i = 0; i < 365; i += 1) {
      const key = shiftDateKey(today, -i);
      if (dailyTasks.length === 0) break;
      const completedIds = new Set(
        completions
          .filter((item) => item.member_id === member.id && item.date_key === key)
          .map((item) => item.task_id)
      );
      if (dailyTasks.every((task) => completedIds.has(task.id))) streak += 1;
      else break;
    }

    const trend = Array.from({ length: 7 }, (_, index) => {
      const key = shiftDateKey(today, index - 6);
      const amount = pointEvents
        .filter((event) => event.member_id === member.id && event.date_key === key)
        .reduce((sum, event) => sum + event.amount, 0);
      return { date_key: key, amount };
    });

    stats[member.id] = {
      member_id: member.id,
      today_total: dailyTasks.length,
      today_completed: dailyTasks.filter((task) => todayCompletedTaskIds.has(task.id)).length,
      today_rate: dailyTasks.length === 0 ? 1 : todayCompletedTaskIds.size / dailyTasks.length,
      streak_days: streak,
      yesterday_settled: settlements.some((item) => item.member_id === member.id && item.date_key === yesterday),
      yesterday_date_key: yesterday,
      today_date_key: today,
      trend
    };
  }

  return stats;
}

export async function findSpaceByInviteHash(invite_hash: string) {
  return getOne<Space>(names.spaces, { invite_hash });
}

export async function getBootstrap(spaceId: string) {
  const [space, members, tasks, completions, rewards, redemptions, pointEvents, settlements] = await Promise.all([
    getOne<Space>(names.spaces, { id: spaceId }),
    getAll<Member>(names.members, { space_id: spaceId }),
    getAll<Task>(names.tasks, { space_id: spaceId }),
    getAll<TaskCompletion>(names.completions, { space_id: spaceId }),
    getAll<Reward>(names.rewards, { space_id: spaceId }),
    getAll<RewardRedemption>(names.redemptions, { space_id: spaceId }),
    getAll<PointEvent>(names.pointEvents, { space_id: spaceId }),
    getAll<DailySettlement>(names.settlements, { space_id: spaceId })
  ]);

  if (!space) throw new Error("空间不存在。");

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const memberById = new Map(members.map((member) => [member.id, member]));
  const rewardById = new Map(rewards.map((reward) => [reward.id, reward]));

  return {
    space,
    members: members.sort((a, b) => b.points - a.points || a.created_at.localeCompare(b.created_at)),
    tasks: tasks.sort((a, b) => Number(b.is_active) - Number(a.is_active) || b.created_at.localeCompare(a.created_at)),
    completions: completions
      .sort((a, b) => b.completed_at.localeCompare(a.completed_at))
      .slice(0, 120)
      .map((item) => attachCompletionRefs(item, taskById, memberById)),
    rewards: rewards.sort((a, b) => Number(b.is_active) - Number(a.is_active) || b.created_at.localeCompare(a.created_at)),
    redemptions: redemptions
      .sort((a, b) => b.requested_at.localeCompare(a.requested_at))
      .slice(0, 80)
      .map((item) => attachRedemptionRefs(item, rewardById, memberById)),
    pointEvents: pointEvents.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 120),
    settlements: settlements.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 120),
    stats: buildStats(members, tasks, completions, settlements, pointEvents)
  };
}

export async function createMember(spaceId: string, name: string) {
  const existing = await getOne<Member>(names.members, { space_id: spaceId, name });
  if (existing) throw new Error("这个昵称已经存在。");
  return setDoc<Member>(names.members, {
    id: randomUUID(),
    space_id: spaceId,
    name,
    points: 0,
    is_active: true,
    created_at: now()
  });
}

export async function createTask(spaceId: string, input: CreateTaskInput) {
  const member = await getOne<Member>(names.members, { id: input.member_id, space_id: spaceId });
  if (!member) throw new Error("成员不存在。");

  return setDoc<Task>(names.tasks, {
    id: randomUUID(),
    space_id: spaceId,
    ...input,
    penalty_points: input.cycle === "daily" ? input.penalty_points : 0,
    daily_once: input.cycle === "daily",
    is_active: true,
    created_at: now(),
    updated_at: now()
  });
}

export async function updateTask(spaceId: string, taskId: string, updates: UpdateTaskInput) {
  const task = await getOne<Task>(names.tasks, { id: taskId, space_id: spaceId });
  if (!task) throw new Error("任务不存在。");
  const nextCycle = updates.cycle ?? task.cycle;
  return updateDoc<Task>(names.tasks, taskId, {
    ...updates,
    penalty_points: nextCycle === "daily" ? updates.penalty_points ?? task.penalty_points : 0,
    daily_once: nextCycle === "daily",
    updated_at: now()
  } as Partial<Task>);
}

export async function completeTask(spaceId: string, taskId: string, memberId: string) {
  const [task, member] = await Promise.all([
    getOne<Task>(names.tasks, { id: taskId, space_id: spaceId, member_id: memberId }),
    getOne<Member>(names.members, { id: memberId, space_id: spaceId })
  ]);
  if (!task || !task.is_active) throw new Error("任务不存在或已停用。");
  if (!member || !member.is_active) throw new Error("成员不存在或已停用。");

  const key = dateKey();
  if (task.cycle === "daily") {
    const existing = await getOne<TaskCompletion>(names.completions, {
      space_id: spaceId,
      task_id: task.id,
      member_id: member.id,
      date_key: key
    });
    if (existing) {
      return {
        completion: { ...existing, tasks: { title: task.title, cycle: task.cycle }, members: { name: member.name } },
        member,
        alreadyCompleted: true
      };
    }
  }

  const completion = await setDoc<TaskCompletion>(names.completions, {
    id: randomUUID(),
    space_id: spaceId,
    task_id: task.id,
    member_id: member.id,
    points: task.points,
    date_key: key,
    completed_at: now(),
    tasks: { title: task.title, cycle: task.cycle },
    members: { name: member.name }
  });
  await addPointEvent({
    space_id: spaceId,
    member_id: member.id,
    type: "task_complete",
    amount: task.points,
    reason: `完成任务：${task.title}`,
    task_id: task.id,
    date_key: key
  });
  const updatedMember = await updateDoc<Member>(names.members, member.id, { points: member.points + task.points } as Partial<Member>);
  return { completion, member: updatedMember, alreadyCompleted: false };
}

export async function settleDaily(spaceId: string, memberId: string, targetDateKey = dateKey(-1)): Promise<DailySettlementResult> {
  const [member, existing] = await Promise.all([
    getOne<Member>(names.members, { id: memberId, space_id: spaceId }),
    getOne<DailySettlement>(names.settlements, { space_id: spaceId, member_id: memberId, date_key: targetDateKey })
  ]);
  if (!member) throw new Error("成员不存在。");
  if (existing) throw new Error("这一天已经结算过，不能重复扣分。");

  const [tasks, completions] = await Promise.all([
    getAll<Task>(names.tasks, { space_id: spaceId, member_id: memberId }),
    getAll<TaskCompletion>(names.completions, { space_id: spaceId, member_id: memberId, date_key: targetDateKey })
  ]);
  const dailyTasks = tasks.filter((task) => task.is_active && task.cycle === "daily");
  const completedIds = new Set(completions.map((item) => item.task_id));
  const completed = dailyTasks.filter((task) => completedIds.has(task.id));
  const missed = dailyTasks.filter((task) => !completedIds.has(task.id));
  const penaltyTotal = missed.reduce((sum, task) => sum + Math.max(0, task.penalty_points), 0);

  const settlement = await setDoc<DailySettlement>(names.settlements, {
    id: randomUUID(),
    space_id: spaceId,
    member_id: memberId,
    date_key: targetDateKey,
    penalty_total: penaltyTotal,
    completed_task_ids: completed.map((task) => task.id),
    missed_task_ids: missed.map((task) => task.id),
    created_at: now()
  });

  for (const task of missed) {
    if (task.penalty_points > 0) {
      await addPointEvent({
        space_id: spaceId,
        member_id: memberId,
        type: "daily_penalty",
        amount: -task.penalty_points,
        reason: `未完成每日任务：${task.title}`,
        task_id: task.id,
        date_key: targetDateKey
      });
    }
  }

  const updatedMember = penaltyTotal > 0
    ? await updateDoc<Member>(names.members, member.id, { points: member.points - penaltyTotal } as Partial<Member>)
    : member;

  return {
    settlement,
    member: updatedMember,
    completed: completed.map((task) => ({ id: task.id, title: task.title, points: task.points })),
    missed: missed.map((task) => ({ id: task.id, title: task.title, penalty_points: task.penalty_points }))
  };
}

export async function createReward(spaceId: string, input: CreateRewardInput) {
  return setDoc<Reward>(names.rewards, {
    id: randomUUID(),
    space_id: spaceId,
    ...input,
    is_active: true,
    created_at: now(),
    updated_at: now()
  });
}

export async function updateReward(spaceId: string, rewardId: string, updates: UpdateRewardInput) {
  const reward = await getOne<Reward>(names.rewards, { id: rewardId, space_id: spaceId });
  if (!reward) throw new Error("奖励不存在。");
  return updateDoc<Reward>(names.rewards, rewardId, { ...updates, updated_at: now() } as Partial<Reward>);
}

export async function redeemReward(spaceId: string, rewardId: string, memberId: string) {
  const [reward, member] = await Promise.all([
    getOne<Reward>(names.rewards, { id: rewardId, space_id: spaceId }),
    getOne<Member>(names.members, { id: memberId, space_id: spaceId })
  ]);
  if (!reward || !reward.is_active) throw new Error("奖励不存在或已停用。");
  if (!member || !member.is_active) throw new Error("成员不存在或已停用。");

  return setDoc<RewardRedemption>(names.redemptions, {
    id: randomUUID(),
    space_id: spaceId,
    reward_id: reward.id,
    member_id: member.id,
    cost: reward.cost,
    status: "pending",
    requested_at: now(),
    resolved_at: null,
    resolved_by_member_id: null,
    rewards: { title: reward.title },
    members: { name: member.name }
  });
}

export async function approveRedemption(spaceId: string, redemptionId: string, resolvedByMemberId: string | null) {
  const redemption = await getOne<RewardRedemption>(names.redemptions, { id: redemptionId, space_id: spaceId });
  if (!redemption) throw new Error("兑换申请不存在。");
  if (redemption.status !== "pending") throw new Error("这个兑换申请已经处理过。");

  const [member, reward] = await Promise.all([
    getOne<Member>(names.members, { id: redemption.member_id, space_id: spaceId }),
    getOne<Reward>(names.rewards, { id: redemption.reward_id, space_id: spaceId })
  ]);
  if (!member) throw new Error("成员不存在。");
  if (member.points < redemption.cost) throw new Error("积分不足，无法确认兑换。");

  const [updatedRedemption, updatedMember] = await Promise.all([
    updateDoc<RewardRedemption>(names.redemptions, redemption.id, {
      status: "approved",
      resolved_at: now(),
      resolved_by_member_id: resolvedByMemberId
    } as Partial<RewardRedemption>),
    updateDoc<Member>(names.members, member.id, { points: member.points - redemption.cost } as Partial<Member>),
    addPointEvent({
      space_id: spaceId,
      member_id: member.id,
      type: "reward_approved",
      amount: -redemption.cost,
      reason: `兑换奖励：${reward?.title ?? "奖励"}`,
      reward_id: redemption.reward_id,
      redemption_id: redemption.id
    })
  ]);

  return { redemption: updatedRedemption, member: updatedMember };
}

export async function rejectRedemption(spaceId: string, redemptionId: string, resolvedByMemberId: string | null) {
  const redemption = await getOne<RewardRedemption>(names.redemptions, { id: redemptionId, space_id: spaceId });
  if (!redemption) throw new Error("兑换申请不存在。");
  if (redemption.status !== "pending") throw new Error("这个兑换申请已经处理过。");
  return updateDoc<RewardRedemption>(names.redemptions, redemption.id, {
    status: "rejected",
    resolved_at: now(),
    resolved_by_member_id: resolvedByMemberId
  } as Partial<RewardRedemption>);
}

export async function ensureCloudBaseSpace(input: { name: string; invite_hash: string }) {
  const existing = await getOne<Space>(names.spaces, { invite_hash: input.invite_hash });
  if (existing) return existing;
  return setDoc<Space & { invite_hash: string }>(names.spaces, {
    id: "default-space",
    name: input.name,
    invite_hash: input.invite_hash,
    created_at: now()
  });
}
