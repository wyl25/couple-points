export type Cycle = "daily" | "weekly" | "none";
export type RedemptionStatus = "pending" | "approved" | "rejected";

export type Space = {
  id: string;
  name: string;
  created_at: string;
};

export type Member = {
  id: string;
  space_id: string;
  name: string;
  points: number;
  is_active: boolean;
  created_at: string;
};

export type Task = {
  id: string;
  space_id: string;
  title: string;
  description: string;
  points: number;
  cycle: Cycle;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TaskCompletion = {
  id: string;
  space_id: string;
  task_id: string;
  member_id: string;
  points: number;
  completed_at: string;
  tasks?: Pick<Task, "title" | "cycle"> | null;
  members?: Pick<Member, "name"> | null;
};

export type Reward = {
  id: string;
  space_id: string;
  title: string;
  description: string;
  cost: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RewardRedemption = {
  id: string;
  space_id: string;
  reward_id: string;
  member_id: string;
  cost: number;
  status: RedemptionStatus;
  requested_at: string;
  resolved_at: string | null;
  resolved_by_member_id: string | null;
  rewards?: Pick<Reward, "title"> | null;
  members?: Pick<Member, "name"> | null;
};

export type BootstrapData = {
  space: Space;
  members: Member[];
  tasks: Task[];
  completions: TaskCompletion[];
  rewards: Reward[];
  redemptions: RewardRedemption[];
};
