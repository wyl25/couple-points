"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Check,
  ChevronRight,
  Flame,
  Gift,
  Heart,
  History,
  LogOut,
  Medal,
  MinusCircle,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trophy,
  Users,
  X
} from "lucide-react";
import type { BootstrapData, Cycle, DailySettlementResult, Member, Reward, RewardRedemption, Task } from "@/lib/types";

type View = "dashboard" | "tasks" | "rewards" | "redemptions";
type TaskForm = { title: string; description: string; points: string; penalty_points: string; cycle: Cycle; memberId: string };
type RewardForm = { title: string; description: string; cost: string };

const cycleLabel: Record<Cycle, string> = { daily: "每日", weekly: "每周", none: "不限" };
const emptyReward: RewardForm = { title: "", description: "", cost: "30" };

function emptyTask(memberId = ""): TaskForm {
  return { title: "", description: "", points: "5", penalty_points: "2", cycle: "daily", memberId };
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "请求失败");
  return payload as T;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function shortDate(value: string) {
  return value.slice(5).replace("-", "/");
}

export default function Home() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [memberName, setMemberName] = useState("");
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTask());
  const [rewardForm, setRewardForm] = useState<RewardForm>(emptyReward);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [settlement, setSettlement] = useState<DailySettlementResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadBootstrap = useCallback(async (memberIdToKeep = "") => {
    setLoading(true);
    setError("");
    try {
      const next = await api<BootstrapData>("/api/bootstrap");
      setData(next);
      const memberStillExists = next.members.some((member) => member.id === memberIdToKeep);
      if (!memberStillExists) {
        const fallback = next.members[0]?.id ?? "";
        setSelectedMemberId(fallback);
        setTaskForm(emptyTask(fallback));
        if (fallback) window.localStorage.setItem("couple-points-member", fallback);
        else window.localStorage.removeItem("couple-points-member");
      }
    } catch (err) {
      setData(null);
      if (err instanceof Error && !err.message.includes("请先输入")) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("couple-points-member") ?? "";
    setSelectedMemberId(stored);
    setTaskForm(emptyTask(stored));
    loadBootstrap(stored);
  }, [loadBootstrap]);

  const selectedMember = data?.members.find((member) => member.id === selectedMemberId) ?? null;
  const selectedStats = selectedMember ? data?.stats[selectedMember.id] : null;
  const memberTasks = useMemo(() => data?.tasks.filter((task) => task.member_id === selectedMemberId) ?? [], [data?.tasks, selectedMemberId]);
  const todayCompletedIds = useMemo(() => {
    if (!selectedStats) return new Set<string>();
    return new Set(
      data?.completions
        .filter((item) => item.member_id === selectedMemberId && item.date_key === selectedStats.today_date_key)
        .map((item) => item.task_id) ?? []
    );
  }, [data?.completions, selectedMemberId, selectedStats]);
  const pendingRedemptions = data?.redemptions.filter((redemption) => redemption.status === "pending") ?? [];
  const topMember = useMemo(() => data?.members.reduce<Member | null>((top, member) => (!top || member.points > top.points ? member : top), null) ?? null, [data?.members]);

  function chooseMember(memberId: string) {
    setSelectedMemberId(memberId);
    setTaskForm((current) => ({ ...current, memberId }));
    window.localStorage.setItem("couple-points-member", memberId);
  }

  async function run(action: () => Promise<void>, ok = "已保存") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(ok);
      await loadBootstrap(selectedMemberId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setBusy(false);
    }
  }

  async function joinSpace(event: React.FormEvent) {
    event.preventDefault();
    await run(async () => {
      await api("/api/join", { method: "POST", body: JSON.stringify({ inviteCode }) });
      setInviteCode("");
    }, "已进入空间");
  }

  async function createMember(event: React.FormEvent) {
    event.preventDefault();
    await run(async () => {
      const member = await api<Member>("/api/members", { method: "POST", body: JSON.stringify({ name: memberName }) });
      setMemberName("");
      chooseMember(member.id);
    }, "成员已创建");
  }

  async function saveTask(event: React.FormEvent) {
    event.preventDefault();
    await run(async () => {
      const body = JSON.stringify({
        ...taskForm,
        points: Number(taskForm.points),
        penalty_points: Number(taskForm.penalty_points)
      });
      if (editingTaskId) await api(`/api/tasks/${editingTaskId}`, { method: "PATCH", body });
      else await api("/api/tasks", { method: "POST", body });
      setTaskForm(emptyTask(selectedMemberId));
      setEditingTaskId(null);
    }, editingTaskId ? "任务已更新" : "任务已创建");
  }

  async function saveReward(event: React.FormEvent) {
    event.preventDefault();
    await run(async () => {
      const body = JSON.stringify({ ...rewardForm, cost: Number(rewardForm.cost) });
      if (editingRewardId) await api(`/api/rewards/${editingRewardId}`, { method: "PATCH", body });
      else await api("/api/rewards", { method: "POST", body });
      setRewardForm(emptyReward);
      setEditingRewardId(null);
    }, editingRewardId ? "奖励已更新" : "奖励已创建");
  }

  async function completeTask(task: Task) {
    if (!selectedMemberId) return setError("请先选择当前成员。");
    await run(async () => {
      const result = await api<{ alreadyCompleted?: boolean }>(`/api/tasks/${task.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ memberId: selectedMemberId })
      });
      if (result.alreadyCompleted) setMessage("今天已经完成过这个任务");
    }, "完成得分");
  }

  async function settleYesterday() {
    if (!selectedMemberId) return setError("请先选择当前成员。");
    await run(async () => {
      const result = await api<DailySettlementResult>("/api/settlements/daily", {
        method: "POST",
        body: JSON.stringify({ memberId: selectedMemberId })
      });
      setSettlement(result);
    }, "昨日已结算");
  }

  async function redeemReward(rewardId: string) {
    if (!selectedMemberId) return setError("请先选择当前成员。");
    await run(() => api(`/api/rewards/${rewardId}/redeem`, { method: "POST", body: JSON.stringify({ memberId: selectedMemberId }) }), "兑换已提交");
  }

  async function resolveRedemption(redemptionId: string, decision: "approve" | "reject") {
    await run(() => api(`/api/redemptions/${redemptionId}/${decision}`, {
      method: "POST",
      body: JSON.stringify({ resolvedByMemberId: selectedMemberId || null })
    }), decision === "approve" ? "兑换已确认" : "兑换已拒绝");
  }

  async function logout() {
    await api("/api/logout", { method: "POST" });
    window.localStorage.removeItem("couple-points-member");
    setSelectedMemberId("");
    setData(null);
    setMessage("");
  }

  function editTask(task: Task) {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      description: task.description,
      points: String(task.points),
      penalty_points: String(task.penalty_points),
      cycle: task.cycle,
      memberId: task.member_id
    });
    setView("tasks");
  }

  function editReward(reward: Reward) {
    setEditingRewardId(reward.id);
    setRewardForm({ title: reward.title, description: reward.description, cost: String(reward.cost) });
    setView("rewards");
  }

  if (loading) return <main className="entry"><div className="glass entry-panel">正在加载...</div></main>;

  if (!data) {
    return (
      <main className="entry">
        <form className="glass entry-panel form" onSubmit={joinSpace}>
          <div className="brand hero-brand">
            <div className="logo"><Heart size={22} /></div>
            <div><h1>Couple Points</h1><p>输入邀请码进入共享空间</p></div>
          </div>
          <label className="label">邀请码<input className="input" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} autoFocus /></label>
          <button className="button primary" disabled={busy || !inviteCode.trim()}><Heart size={16} />进入</button>
          <div className="notice">{error}</div>
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="logo"><Activity size={22} /></div>
          <div><h1>{data.space.name}</h1><p>{selectedMember ? `${selectedMember.name} 的健康积分面板` : "请选择成员"}</p></div>
        </div>
        <div className="card-actions">
          <button className="icon-button" title="刷新" onClick={() => loadBootstrap(selectedMemberId)} disabled={busy}><RefreshCw size={17} /></button>
          <button className="icon-button" title="退出" onClick={logout}><LogOut size={17} /></button>
        </div>
      </header>

      <nav className="tabs">
        <button className={`tab ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}><Activity size={16} />今日</button>
        <button className={`tab ${view === "tasks" ? "active" : ""}`} onClick={() => setView("tasks")}><Check size={16} />任务</button>
        <button className={`tab ${view === "rewards" ? "active" : ""}`} onClick={() => setView("rewards")}><Gift size={16} />奖励</button>
        <button className={`tab ${view === "redemptions" ? "active" : ""}`} onClick={() => setView("redemptions")}><History size={16} />记录</button>
      </nav>

      {(message || error) && <div className={`toast ${error ? "error" : ""}`}>{error || message}</div>}

      <section className="member-strip">
        {data.members.map((member) => (
          <button key={member.id} className={`member-chip ${member.id === selectedMemberId ? "active" : ""}`} onClick={() => chooseMember(member.id)}>
            <span>{member.name}</span><strong>{member.points}</strong>
          </button>
        ))}
        <form className="member-add" onSubmit={createMember}>
          <input placeholder="新成员" value={memberName} onChange={(event) => setMemberName(event.target.value)} />
          <button disabled={busy || !memberName.trim()}><Plus size={15} /></button>
        </form>
      </section>

      {view === "dashboard" && (
        <div className="dashboard-grid">
          <section className="glass hero-card">
            <div>
              <p className="eyebrow">今日圆环</p>
              <h2>{selectedMember?.name ?? "选择成员"}</h2>
              <p className="muted">每日任务每天只能完成一次；昨日未完成可手动结算扣分。</p>
            </div>
            <ProgressRing rate={selectedStats?.today_rate ?? 0} completed={selectedStats?.today_completed ?? 0} total={selectedStats?.today_total ?? 0} />
            <div className="hero-stats">
              <Metric icon={<Trophy size={18} />} label="当前积分" value={selectedMember?.points ?? 0} />
              <Metric icon={<Flame size={18} />} label="连续完成" value={`${selectedStats?.streak_days ?? 0} 天`} />
              <Metric icon={<MinusCircle size={18} />} label="昨日结算" value={selectedStats?.yesterday_settled ? "已完成" : "待结算"} />
            </div>
            <button className="button primary wide" disabled={busy || !selectedMember || selectedStats?.yesterday_settled} onClick={settleYesterday}>
              <MinusCircle size={16} />结算昨日未完成
            </button>
          </section>

          <section className="glass section">
            <div className="section-head"><h2>今日任务</h2><span className="badge blue">{memberTasks.filter((task) => task.cycle === "daily" && task.is_active).length} 项</span></div>
            <div className="item-list">
              {memberTasks.filter((task) => task.is_active && task.cycle === "daily").map((task) => (
                <TaskCard key={task.id} task={task} completed={todayCompletedIds.has(task.id)} onComplete={completeTask} onEdit={editTask} />
              ))}
              {memberTasks.filter((task) => task.is_active && task.cycle === "daily").length === 0 && <div className="empty">还没有每日任务</div>}
            </div>
          </section>

          <section className="glass section">
            <div className="section-head"><h2>积分趋势</h2><span className="badge green">7 天</span></div>
            <Trend bars={selectedStats?.trend ?? []} />
          </section>

          <section className="glass section">
            <div className="section-head"><h2>排行榜</h2>{topMember && <span className="badge pink">领先 {topMember.name}</span>}</div>
            <div className="member-list">
              {data.members.map((member) => <button key={member.id} className={`member-row ${member.id === selectedMemberId ? "active" : ""}`} onClick={() => chooseMember(member.id)}><span>{member.name}</span><strong>{member.points}</strong></button>)}
            </div>
          </section>
        </div>
      )}

      {view === "tasks" && (
        <div className="split">
          <section className="glass section">
            <div className="section-head"><h2>{editingTaskId ? "编辑任务" : "新增个人任务"}</h2>{editingTaskId && <button className="icon-button" onClick={() => { setEditingTaskId(null); setTaskForm(emptyTask(selectedMemberId)); }}><X size={16} /></button>}</div>
            <TaskFormView form={taskForm} setForm={setTaskForm} members={data.members} onSubmit={saveTask} busy={busy} editing={Boolean(editingTaskId)} />
          </section>
          <section className="glass section">
            <div className="section-head"><h2>{selectedMember?.name ?? "成员"} 的任务库</h2><span className="badge">{memberTasks.length} 项</span></div>
            <div className="item-list">
              {memberTasks.map((task) => <TaskCard key={task.id} task={task} completed={todayCompletedIds.has(task.id)} onComplete={completeTask} onEdit={editTask} onToggle={(next) => run(() => api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ is_active: next }) }), next ? "任务已启用" : "任务已停用")} />)}
              {memberTasks.length === 0 && <div className="empty">这个成员还没有任务</div>}
            </div>
          </section>
        </div>
      )}

      {view === "rewards" && (
        <div className="split">
          <section className="glass section">
            <div className="section-head"><h2>{editingRewardId ? "编辑奖励" : "新增奖励"}</h2>{editingRewardId && <button className="icon-button" onClick={() => { setEditingRewardId(null); setRewardForm(emptyReward); }}><X size={16} /></button>}</div>
            <RewardFormView form={rewardForm} setForm={setRewardForm} onSubmit={saveReward} busy={busy} editing={Boolean(editingRewardId)} />
          </section>
          <section className="glass section">
            <div className="section-head"><h2>奖励中心</h2></div>
            <div className="item-list">{data.rewards.map((reward) => <RewardCard key={reward.id} reward={reward} onRedeem={redeemReward} onEdit={editReward} onToggle={(next) => run(() => api(`/api/rewards/${reward.id}`, { method: "PATCH", body: JSON.stringify({ is_active: next }) }), next ? "奖励已启用" : "奖励已停用")} />)}</div>
          </section>
        </div>
      )}

      {view === "redemptions" && (
        <div className="split">
          <section className="glass section"><div className="section-head"><h2>兑换审批</h2><span className="badge yellow">{pendingRedemptions.length}</span></div><RedemptionList items={data.redemptions} onResolve={resolveRedemption} busy={busy} /></section>
          <section className="glass section"><div className="section-head"><h2>积分事件</h2></div><EventList data={data} /></section>
        </div>
      )}

      {settlement && <SettlementModal result={settlement} onClose={() => setSettlement(null)} />}
    </main>
  );
}

function ProgressRing({ rate, completed, total }: { rate: number; completed: number; total: number }) {
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, rate)));
  return (
    <div className="ring-wrap">
      <svg viewBox="0 0 180 180" className="ring">
        <circle cx="90" cy="90" r={radius} className="ring-bg" />
        <circle cx="90" cy="90" r={radius} className="ring-value" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="ring-center"><strong>{Math.round(rate * 100)}%</strong><span>{completed}/{total}</span></div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return <div className="metric"><span>{icon}</span><p>{label}</p><strong>{value}</strong></div>;
}

function Trend({ bars }: { bars: Array<{ date_key: string; amount: number }> }) {
  const max = Math.max(1, ...bars.map((bar) => Math.abs(bar.amount)));
  return <div className="trend">{bars.map((bar) => <div className="trend-item" key={bar.date_key}><div className="trend-track"><span className={bar.amount < 0 ? "down" : "up"} style={{ height: `${18 + (Math.abs(bar.amount) / max) * 78}%` }} /></div><small>{shortDate(bar.date_key)}</small></div>)}</div>;
}

function TaskFormView({ form, setForm, members, onSubmit, busy, editing }: { form: TaskForm; setForm: (form: TaskForm) => void; members: Member[]; onSubmit: (event: React.FormEvent) => void; busy: boolean; editing: boolean }) {
  return (
    <form className="form" onSubmit={onSubmit}>
      <label className="label">所属成员<select className="select" value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })}>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
      <label className="label">任务名称<input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label className="label">说明<textarea className="textarea" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      <div className="form-row three">
        <label className="label">完成加分<input className="input" type="number" min="1" value={form.points} onChange={(event) => setForm({ ...form, points: event.target.value })} /></label>
        <label className="label">未完成扣分<input className="input" type="number" min="0" value={form.penalty_points} disabled={form.cycle !== "daily"} onChange={(event) => setForm({ ...form, penalty_points: event.target.value })} /></label>
        <label className="label">周期<select className="select" value={form.cycle} onChange={(event) => setForm({ ...form, cycle: event.target.value as Cycle })}><option value="daily">每日</option><option value="weekly">每周</option><option value="none">不限</option></select></label>
      </div>
      <button className="button primary" disabled={busy || !form.memberId}><Plus size={16} />{editing ? "保存任务" : "创建任务"}</button>
    </form>
  );
}

function RewardFormView({ form, setForm, onSubmit, busy, editing }: { form: RewardForm; setForm: (form: RewardForm) => void; onSubmit: (event: React.FormEvent) => void; busy: boolean; editing: boolean }) {
  return <form className="form" onSubmit={onSubmit}><label className="label">奖励名称<input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="label">说明<textarea className="textarea" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className="label">所需积分<input className="input" type="number" min="1" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} /></label><button className="button primary" disabled={busy}><Gift size={16} />{editing ? "保存奖励" : "创建奖励"}</button></form>;
}

function TaskCard({ task, completed, onComplete, onEdit, onToggle }: { task: Task; completed: boolean; onComplete: (task: Task) => void; onEdit: (task: Task) => void; onToggle?: (next: boolean) => void }) {
  return <div className={`task-card ${completed ? "done" : ""}`}><div className="card-title-row"><div><h3>{task.title}</h3>{task.description && <p>{task.description}</p>}</div><div className="card-actions"><span className="badge green">+{task.points}</span>{task.cycle === "daily" && <span className="badge red">-{task.penalty_points}</span>}<span className="badge blue">{cycleLabel[task.cycle]}</span>{!task.is_active && <span className="badge">停用</span>}</div></div><div className="card-actions"><button className="button primary" onClick={() => onComplete(task)} disabled={!task.is_active || completed}>{completed ? <Sparkles size={16} /> : <Check size={16} />}{completed ? "已完成" : "完成"}</button><button className="icon-button" title="编辑" onClick={() => onEdit(task)}><Pencil size={16} /></button>{onToggle && <button className="icon-button" title={task.is_active ? "停用" : "启用"} onClick={() => onToggle(!task.is_active)}>{task.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}</button>}</div></div>;
}

function RewardCard({ reward, onRedeem, onEdit, onToggle }: { reward: Reward; onRedeem: (id: string) => void; onEdit: (reward: Reward) => void; onToggle?: (next: boolean) => void }) {
  return <div className="reward-card"><div className="card-title-row"><div><h3>{reward.title}</h3>{reward.description && <p>{reward.description}</p>}</div><div className="card-actions"><span className="badge yellow">{reward.cost} 分</span>{!reward.is_active && <span className="badge">停用</span>}</div></div><div className="card-actions"><button className="button primary" onClick={() => onRedeem(reward.id)} disabled={!reward.is_active}><Gift size={16} />兑换</button><button className="icon-button" title="编辑" onClick={() => onEdit(reward)}><Pencil size={16} /></button>{onToggle && <button className="icon-button" title={reward.is_active ? "停用" : "启用"} onClick={() => onToggle(!reward.is_active)}>{reward.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}</button>}</div></div>;
}

function RedemptionList({ items, onResolve, busy }: { items: RewardRedemption[]; onResolve: (id: string, decision: "approve" | "reject") => void; busy: boolean }) {
  if (items.length === 0) return <div className="empty">暂无兑换记录</div>;
  return <div className="item-list">{items.map((item) => <div className="item-row" key={item.id}><div><strong>{item.members?.name ?? "成员"}</strong> 申请 {item.rewards?.title ?? "奖励"}<div className="meta">{formatTime(item.requested_at)} · {item.cost} 分</div></div><div className="card-actions"><span className={`badge ${item.status === "approved" ? "green" : item.status === "rejected" ? "red" : "yellow"}`}>{item.status === "pending" ? "待确认" : item.status === "approved" ? "已确认" : "已拒绝"}</span>{item.status === "pending" && <><button className="icon-button" disabled={busy} onClick={() => onResolve(item.id, "approve")}><Check size={16} /></button><button className="icon-button" disabled={busy} onClick={() => onResolve(item.id, "reject")}><X size={16} /></button></>}</div></div>)}</div>;
}

function EventList({ data }: { data: BootstrapData }) {
  if (data.pointEvents.length === 0) return <div className="empty">暂无积分事件</div>;
  const memberById = new Map(data.members.map((member) => [member.id, member.name]));
  return <div className="timeline">{data.pointEvents.slice(0, 18).map((event) => <div className="timeline-item" key={event.id}><span className={event.amount >= 0 ? "event-plus" : "event-minus"}>{event.amount >= 0 ? "+" : ""}{event.amount}</span><div><strong>{memberById.get(event.member_id) ?? "成员"}</strong><p>{event.reason}</p><small>{event.date_key} · {formatTime(event.created_at)}</small></div></div>)}</div>;
}

function SettlementModal({ result, onClose }: { result: DailySettlementResult; onClose: () => void }) {
  return <div className="modal-backdrop"><div className="glass modal"><button className="icon-button modal-close" onClick={onClose}><X size={16} /></button><div className="modal-icon"><MinusCircle size={24} /></div><h2>昨日结算完成</h2><p className="muted">共扣除 {result.settlement.penalty_total} 分，已记录到积分事件。</p><div className="settlement-grid"><div><h3>已完成</h3>{result.completed.length ? result.completed.map((task) => <p key={task.id}><Check size={14} />{task.title}</p>) : <p className="muted">无</p>}</div><div><h3>未完成</h3>{result.missed.length ? result.missed.map((task) => <p key={task.id}><ChevronRight size={14} />{task.title} -{task.penalty_points}</p>) : <p className="muted">无</p>}</div></div><button className="button primary wide" onClick={onClose}>知道了</button></div></div>;
}
