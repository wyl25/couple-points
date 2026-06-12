import { randomUUID } from "node:crypto";
import { getStore } from "@edgeone/pages-blob";
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
const retroactiveDays = 3;
const blobStoreName = process.env.EDGEONE_BLOB_STORE || "couple-points-data";
const collectionQueues = new Map<string, Promise<unknown>>();

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

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function dayDifference(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / dayMs);
}

function withId<T>(data: T & { _id?: string; id?: string }) {
  const { _id, ...rest } = data;
  return { ...rest, id: data.id ?? _id } as T & { id: string };
}

function collectionKey(collectionName: string) {
  return `collections/${collectionName}.json`;
}

function blobStore() {
  return getStore(blobStoreName);
}

async function readCollection<T>(collectionName: string) {
  const data = await blobStore().get(collectionKey(collectionName), { type: "json", consistency: "strong" });
  if (!data) return [];
  if (!Array.isArray(data)) throw new Error(`存储集合 ${collectionName} 的格式不正确。`);
  return data.map((item) => withId(item as T & { _id?: string; id?: string }));
}

async function writeCollection<T>(collectionName: string, records: T[]) {
  await blobStore().setJSON(collectionKey(collectionName), records, { cacheControl: "no-store" });
}

async function mutateCollection<T>(collectionName: string, mutate: (records: T[]) => T[] | Promise<T[]>) {
  const previous = collectionQueues.get(collectionName) ?? Promise.resolve();
  const next = previous.then(async () => {
    const records = await readCollection<T>(collectionName);
    const updated = await mutate(records);
    await writeCollection(collectionName, updated);
    return updated;
  });
  collectionQueues.set(collectionName, next.catch(() => undefined));
  return next;
}

function matchesWhere(item: Record<string, unknown>, where: Record<string, unknown>) {
  return Object.entries(where).every(([key, value]) => item[key] === value);
}

async function getAll<T>(collectionName: string, where: Record<string, unknown> = {}) {
  const records = await readCollection<T>(collectionName);
  return records.filter((item) => matchesWhere(item as Record<string, unknown>, where));
}

async function getOne<T>(collectionName: string, where: Record<string, unknown>) {
  const [item] = await getAll<T>(collectionName, where);
  return item ?? null;
}

async function setDoc<T extends { id: string }>(collectionName: string, data: T) {
  await mutateCollection<T>(collectionName, (records) => {
    const index = records.findIndex((item) => (item as T & { id: string }).id === data.id);
    if (index === -1) return [...records, data];
    const next = [...records];
    next[index] = data;
    return next;
  });
  return data;
}

export async function ensureStorageCollections() {
  // Blob collections are created lazily on their first write.
}

export async function importDataSnapshot(snapshot: Record<string, unknown>) {
  const aliases: Record<string, string> = {
    spaces: names.spaces,
    members: names.members,
    tasks: names.tasks,
    completions: names.completions,
    task_completions: names.completions,
    rewards: names.rewards,
    redemptions: names.redemptions,
    reward_redemptions: names.redemptions,
    point_events: names.pointEvents,
    settlements: names.settlements,
    daily_settlements: names.settlements
  };
  const allowed = new Set(Object.values(names));
  const imported: Record<string, number> = {};

  for (const [inputName, value] of Object.entries(snapshot)) {
    const collectionName = aliases[inputName] ?? inputName;
    if (!allowed.has(collectionName)) continue;
    const records = Array.isArray(value)
      ? value
      : value && typeof value === "object" && Array.isArray((value as { data?: unknown }).data)
        ? (value as { data: unknown[] }).data
        : null;
    if (!records) throw new Error(`集合 ${inputName} 不是数组格式。`);
    const normalized = records.map((item) => {
      if (!item || typeof item !== "object") throw new Error(`集合 ${inputName} 包含无效记录。`);
      return withId(item as { _id?: string; id?: string });
    });
    if (normalized.some((item) => !item.id)) throw new Error(`集合 ${inputName} 存在缺少 id 的记录。`);
    await writeCollection(collectionName, normalized);
    imported[collectionName] = normalized.length;
  }

  if (Object.keys(imported).length === 0) throw new Error("没有找到可导入的积分系统集合。");
  return imported;
}

export async function getStorageSummary() {
  const entries = await Promise.all(Object.values(names).map(async (collectionName) => [
    collectionName,
    (await readCollection(collectionName)).length
  ] as const));
  return Object.fromEntries(entries);
}

async function updateDoc<T>(collectionName: string, id: string, updates: Partial<T>) {
  let updated: T | null = null;
  await mutateCollection<T>(collectionName, (records) => records.map((item) => {
    if ((item as T & { id?: string }).id !== id) return item;
    updated = { ...item, ...updates };
    return updated;
  }));
  if (!updated) throw new Error("要更新的数据不存在。");
  return updated;
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
  const settlementDate = dateKey(-(retroactiveDays + 1));
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

    const checkinDates = Array.from({ length: retroactiveDays + 1 }, (_, offsetDays) => {
      const key = shiftDateKey(today, -offsetDays);
      const completedIds = new Set(
        completions
          .filter((item) => item.member_id === member.id && item.date_key === key)
          .map((item) => item.task_id)
      );
      return {
        date_key: key,
        offset_days: offsetDays,
        completed: dailyTasks.filter((task) => completedIds.has(task.id)).length,
        total: dailyTasks.length
      };
    });

    stats[member.id] = {
      member_id: member.id,
      today_total: dailyTasks.length,
      today_completed: dailyTasks.filter((task) => todayCompletedTaskIds.has(task.id)).length,
      today_rate: dailyTasks.length === 0 ? 1 : todayCompletedTaskIds.size / dailyTasks.length,
      streak_days: streak,
      yesterday_settled: settlements.some((item) => item.member_id === member.id && item.date_key === yesterday),
      yesterday_date_key: yesterday,
      settlement_date_key: settlementDate,
      settlement_date_settled: settlements.some((item) => item.member_id === member.id && item.date_key === settlementDate),
      today_date_key: today,
      checkin_dates: checkinDates,
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

export async function completeTask(spaceId: string, taskId: string, memberId: string, targetDateKey?: string) {
  const [task, member] = await Promise.all([
    getOne<Task>(names.tasks, { id: taskId, space_id: spaceId, member_id: memberId }),
    getOne<Member>(names.members, { id: memberId, space_id: spaceId })
  ]);
  if (!task || !task.is_active) throw new Error("任务不存在或已停用。");
  if (!member || !member.is_active) throw new Error("成员不存在或已停用。");

  const today = dateKey();
  const key = targetDateKey ?? today;
  if (!isDateKey(key)) throw new Error("日期格式不正确。");
  const ageInDays = dayDifference(key, today);
  if (task.cycle === "daily" && (ageInDays < 0 || ageInDays > retroactiveDays)) {
    throw new Error(`每日任务只能补打卡今天及前 ${retroactiveDays} 天。`);
  }
  if (task.cycle !== "daily" && key !== today) {
    throw new Error("每周和不限周期任务只能记录在今天。");
  }
  if (task.cycle === "daily") {
    const settlement = await getOne<DailySettlement>(names.settlements, {
      space_id: spaceId,
      member_id: member.id,
      date_key: key
    });
    if (settlement) throw new Error("这一天已经结算，不能再补打卡。");
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

export async function settleDaily(spaceId: string, memberId: string, targetDateKey = dateKey(-(retroactiveDays + 1))): Promise<DailySettlementResult> {
  if (!isDateKey(targetDateKey)) throw new Error("日期格式不正确。");
  const ageInDays = dayDifference(targetDateKey, dateKey());
  if (ageInDays <= retroactiveDays) {
    throw new Error(`最近 ${retroactiveDays} 天仍可补打卡，暂时不能结算扣分。`);
  }
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

export async function ensureDefaultSpace(input: { name: string; invite_hash: string }) {
  const existing = await getOne<Space>(names.spaces, { invite_hash: input.invite_hash });
  if (existing) return existing;
  return setDoc<Space & { invite_hash: string }>(names.spaces, {
    id: "default-space",
    name: input.name,
    invite_hash: input.invite_hash,
    created_at: now()
  });
}
