export type Cycle = "daily" | "weekly" | "none";
export type RedemptionStatus = "pending" | "approved" | "rejected";
export type PointEventType = "task_complete" | "daily_penalty" | "reward_approved";

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
  member_id: string;
  title: string;
  description: string;
  points: number;
  penalty_points: number;
  cycle: Cycle;
  daily_once: boolean;
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
  date_key: string;
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

export type PointEvent = {
  id: string;
  space_id: string;
  member_id: string;
  type: PointEventType;
  amount: number;
  reason: string;
  task_id?: string | null;
  reward_id?: string | null;
  redemption_id?: string | null;
  date_key: string;
  created_at: string;
};

export type DailySettlement = {
  id: string;
  space_id: string;
  member_id: string;
  date_key: string;
  penalty_total: number;
  completed_task_ids: string[];
  missed_task_ids: string[];
  created_at: string;
};

export type MemberStats = {
  member_id: string;
  today_total: number;
  today_completed: number;
  today_rate: number;
  streak_days: number;
  yesterday_settled: boolean;
  yesterday_date_key: string;
  today_date_key: string;
  trend: Array<{ date_key: string; amount: number }>;
};

export type BootstrapData = {
  space: Space;
  members: Member[];
  tasks: Task[];
  completions: TaskCompletion[];
  rewards: Reward[];
  redemptions: RewardRedemption[];
  pointEvents: PointEvent[];
  settlements: DailySettlement[];
  stats: Record<string, MemberStats>;
};

export type DailySettlementResult = {
  settlement: DailySettlement;
  member: Member;
  completed: Array<Pick<Task, "id" | "title" | "points">>;
  missed: Array<Pick<Task, "id" | "title" | "penalty_points">>;
};
