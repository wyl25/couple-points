import { randomUUID } from "node:crypto";
import tcb from "@cloudbase/node-sdk";
import type { Cycle, Member, Reward, RewardRedemption, Space, Task, TaskCompletion } from "@/lib/types";

type CreateTaskInput = Pick<Task, "title" | "description" | "points" | "cycle">;
type UpdateTaskInput = Partial<Pick<Task, "title" | "description" | "points" | "cycle" | "is_active">>;
type CreateRewardInput = Pick<Reward, "title" | "description" | "cost">;
type UpdateRewardInput = Partial<Pick<Reward, "title" | "description" | "cost" | "is_active">>;

const names = {
  spaces: "couple_points_spaces",
  members: "couple_points_members",
  tasks: "couple_points_tasks",
  completions: "couple_points_task_completions",
  rewards: "couple_points_rewards",
  redemptions: "couple_points_reward_redemptions"
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function now() {
  return new Date().toISOString();
}

function byNewest<T extends Record<string, unknown>>(field: keyof T) {
  return (a: T, b: T) => String(b[field]).localeCompare(String(a[field]));
}

function byOldest<T extends Record<string, unknown>>(field: keyof T) {
  return (a: T, b: T) => String(a[field]).localeCompare(String(b[field]));
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
  const db = getDb();
  const result = await db.collection(collectionName).where(where).limit(1000).get();
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
  return withId((updated.data?.[0] ?? updates) as T & { _id?: string; id?: string });
}

export async function findSpaceByInviteHash(invite_hash: string) {
  return getOne<Space>(names.spaces, { invite_hash });
}

export async function getBootstrap(spaceId: string) {
  const [space, members, tasks, completions, rewards, redemptions] = await Promise.all([
    getOne<Space>(names.spaces, { id: spaceId }),
    getAll<Member>(names.members, { space_id: spaceId }),
    getAll<Task>(names.tasks, { space_id: spaceId }),
    getAll<TaskCompletion>(names.completions, { space_id: spaceId }),
    getAll<Reward>(names.rewards, { space_id: spaceId }),
    getAll<RewardRedemption>(names.redemptions, { space_id: spaceId })
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
      .sort(byNewest<TaskCompletion>("completed_at"))
      .slice(0, 40)
      .map((item) => ({
        ...item,
        tasks: taskById.get(item.task_id) ? { title: taskById.get(item.task_id)!.title, cycle: taskById.get(item.task_id)!.cycle } : null,
        members: memberById.get(item.member_id) ? { name: memberById.get(item.member_id)!.name } : null
      })),
    rewards: rewards.sort((a, b) => Number(b.is_active) - Number(a.is_active) || b.created_at.localeCompare(a.created_at)),
    redemptions: redemptions
      .sort(byNewest<RewardRedemption>("requested_at"))
      .slice(0, 40)
      .map((item) => ({
        ...item,
        rewards: rewardById.get(item.reward_id) ? { title: rewardById.get(item.reward_id)!.title } : null,
        members: memberById.get(item.member_id) ? { name: memberById.get(item.member_id)!.name } : null
      }))
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
  return setDoc<Task>(names.tasks, {
    id: randomUUID(),
    space_id: spaceId,
    ...input,
    is_active: true,
    created_at: now(),
    updated_at: now()
  });
}

export async function updateTask(spaceId: string, taskId: string, updates: UpdateTaskInput) {
  const task = await getOne<Task>(names.tasks, { id: taskId, space_id: spaceId });
  if (!task) throw new Error("任务不存在。");
  return updateDoc<Task>(names.tasks, taskId, { ...updates, updated_at: now() } as Partial<Task>);
}

export async function completeTask(spaceId: string, taskId: string, memberId: string) {
  const [task, member] = await Promise.all([
    getOne<Task>(names.tasks, { id: taskId, space_id: spaceId }),
    getOne<Member>(names.members, { id: memberId, space_id: spaceId })
  ]);
  if (!task || !task.is_active) throw new Error("任务不存在或已停用。");
  if (!member || !member.is_active) throw new Error("成员不存在或已停用。");

  const completion = await setDoc<TaskCompletion>(names.completions, {
    id: randomUUID(),
    space_id: spaceId,
    task_id: task.id,
    member_id: member.id,
    points: task.points,
    completed_at: now(),
    tasks: { title: task.title, cycle: task.cycle },
    members: { name: member.name }
  });
  const updatedMember = await updateDoc<Member>(names.members, member.id, { points: member.points + task.points } as Partial<Member>);
  return { completion, member: updatedMember };
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

  const member = await getOne<Member>(names.members, { id: redemption.member_id, space_id: spaceId });
  if (!member) throw new Error("成员不存在。");
  if (member.points < redemption.cost) throw new Error("积分不足，无法确认兑换。");

  const [updatedRedemption, updatedMember] = await Promise.all([
    updateDoc<RewardRedemption>(names.redemptions, redemption.id, {
      status: "approved",
      resolved_at: now(),
      resolved_by_member_id: resolvedByMemberId
    } as Partial<RewardRedemption>),
    updateDoc<Member>(names.members, member.id, { points: member.points - redemption.cost } as Partial<Member>)
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
