"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Gift, Heart, History, LogOut, Medal, Pencil, Plus, RefreshCw, Star, ToggleLeft, ToggleRight, Trophy, Users, X } from "lucide-react";
import type { BootstrapData, Cycle, Member, Reward, RewardRedemption, Task } from "@/lib/types";

type View = "dashboard" | "tasks" | "rewards" | "redemptions";
type TaskForm = { title: string; description: string; points: string; cycle: Cycle };
type RewardForm = { title: string; description: string; cost: string };

const emptyTask: TaskForm = { title: "", description: "", points: "5", cycle: "daily" };
const emptyReward: RewardForm = { title: "", description: "", cost: "20" };
const cycleLabel: Record<Cycle, string> = { daily: "每日", weekly: "每周", none: "不限周期" };

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "请求失败");
  return payload as T;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function Home() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [memberName, setMemberName] = useState("");
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTask);
  const [rewardForm, setRewardForm] = useState<RewardForm>(emptyReward);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
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
        setSelectedMemberId("");
        window.localStorage.removeItem("couple-points-member");
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
    loadBootstrap(stored);
  }, [loadBootstrap]);

  const selectedMember = data?.members.find((member) => member.id === selectedMemberId) ?? null;
  const activeTasks = data?.tasks.filter((task) => task.is_active) ?? [];
  const pendingRedemptions = data?.redemptions.filter((redemption) => redemption.status === "pending") ?? [];
  const topMember = useMemo(() => data?.members.reduce<Member | null>((top, member) => (!top || member.points > top.points ? member : top), null) ?? null, [data?.members]);

  function chooseMember(memberId: string) {
    setSelectedMemberId(memberId);
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
      const body = JSON.stringify({ ...taskForm, points: Number(taskForm.points) });
      if (editingTaskId) await api(`/api/tasks/${editingTaskId}`, { method: "PATCH", body });
      else await api("/api/tasks", { method: "POST", body });
      setTaskForm(emptyTask);
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

  async function completeTask(taskId: string) {
    if (!selectedMemberId) return setError("请先选择当前成员。");
    await run(() => api(`/api/tasks/${taskId}/complete`, { method: "POST", body: JSON.stringify({ memberId: selectedMemberId }) }), "已加分");
  }

  async function redeemReward(rewardId: string) {
    if (!selectedMemberId) return setError("请先选择当前成员。");
    await run(() => api(`/api/rewards/${rewardId}/redeem`, { method: "POST", body: JSON.stringify({ memberId: selectedMemberId }) }), "兑换已提交");
  }

  async function resolveRedemption(redemptionId: string, decision: "approve" | "reject") {
    await run(() => api(`/api/redemptions/${redemptionId}/${decision}`, { method: "POST", body: JSON.stringify({ resolvedByMemberId: selectedMemberId || null }) }), decision === "approve" ? "兑换已确认" : "兑换已拒绝");
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
    setTaskForm({ title: task.title, description: task.description, points: String(task.points), cycle: task.cycle });
    setView("tasks");
  }

  function editReward(reward: Reward) {
    setEditingRewardId(reward.id);
    setRewardForm({ title: reward.title, description: reward.description, cost: String(reward.cost) });
    setView("rewards");
  }

  if (loading) return <main className="entry"><div className="card entry-panel">正在加载...</div></main>;

  if (!data) {
    return (
      <main className="entry">
        <form className="card entry-panel form" onSubmit={joinSpace}>
          <div className="brand"><div className="logo"><Heart size={22} /></div><div><h1>Couple Points</h1><p>共享积分空间</p></div></div>
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
        <div className="brand"><div className="logo"><Heart size={22} /></div><div><h1>{data.space.name}</h1><p>{selectedMember ? `当前成员：${selectedMember.name}` : "请选择成员"}</p></div></div>
        <div className="card-actions"><button className="icon-button" title="刷新" onClick={() => loadBootstrap(selectedMemberId)} disabled={busy}><RefreshCw size={17} /></button><button className="icon-button" title="退出" onClick={logout}><LogOut size={17} /></button></div>
      </header>

      <nav className="tabs">
        <button className={`tab ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}><Trophy size={16} />总览</button>
        <button className={`tab ${view === "tasks" ? "active" : ""}`} onClick={() => setView("tasks")}><Check size={16} />任务</button>
        <button className={`tab ${view === "rewards" ? "active" : ""}`} onClick={() => setView("rewards")}><Gift size={16} />奖励</button>
        <button className={`tab ${view === "redemptions" ? "active" : ""}`} onClick={() => setView("redemptions")}><History size={16} />兑换</button>
      </nav>

      {(message || error) && <div className={error ? "notice" : "success"}>{error || message}</div>}

      {!selectedMember && (
        <section className="card section" style={{ marginBottom: 18 }}>
          <div className="section-head"><div className="section-title"><Users size={18} /><h2>成员</h2></div></div>
          <div className="split">
            <div className="member-list">
              {data.members.map((member) => <button key={member.id} className="member-row" onClick={() => chooseMember(member.id)}><span className="member-name">{member.name}</span><span className="points">{member.points}</span></button>)}
              {data.members.length === 0 && <div className="empty">暂无成员</div>}
            </div>
            <form className="form" onSubmit={createMember}><label className="label">新成员昵称<input className="input" value={memberName} onChange={(event) => setMemberName(event.target.value)} /></label><button className="button primary" disabled={busy || !memberName.trim()}><Plus size={16} />创建成员</button></form>
          </div>
        </section>
      )}

      {view === "dashboard" && (
        <div className="dashboard-grid grid">
          <section className="card section">
            <div className="section-head"><div className="section-title"><Medal size={18} /><h2>积分排行</h2></div>{topMember && <span className="badge green">领先 {topMember.name}</span>}</div>
            <div className="member-list">{data.members.map((member) => <button key={member.id} className={`member-row ${member.id === selectedMemberId ? "active" : ""}`} onClick={() => chooseMember(member.id)}><span><span className="member-name">{member.name}</span><span className="meta"> {member.is_active ? "" : "已停用"}</span></span><span className="points">{member.points}</span></button>)}</div>
            <form className="form" onSubmit={createMember} style={{ marginTop: 14 }}><div className="form-row"><input className="input" placeholder="新成员昵称" value={memberName} onChange={(event) => setMemberName(event.target.value)} /><button className="button" disabled={busy || !memberName.trim()}><Plus size={16} />添加</button></div></form>
          </section>
          <section className="card section"><div className="section-head"><div className="section-title"><Star size={18} /><h2>快捷任务</h2></div><span className="badge blue">可重复完成</span></div><div className="item-list">{activeTasks.slice(0, 8).map((task) => <TaskCard key={task.id} task={task} onComplete={completeTask} onEdit={editTask} />)}{activeTasks.length === 0 && <div className="empty">暂无启用任务</div>}</div></section>
          <section className="card section"><div className="section-head"><div className="section-title"><History size={18} /><h2>最近记录</h2></div></div><div className="timeline">{data.completions.slice(0, 8).map((item) => <div className="timeline-item" key={item.id}><strong>{item.members?.name ?? "成员"}</strong> 完成 {item.tasks?.title ?? "任务"} <span className="badge green">+{item.points}</span><div className="meta">{formatTime(item.completed_at)}</div></div>)}{data.completions.length === 0 && <div className="empty">暂无完成记录</div>}</div></section>
          <section className="card section"><div className="section-head"><div className="section-title"><Gift size={18} /><h2>待确认兑换</h2></div><span className="badge yellow">{pendingRedemptions.length}</span></div><RedemptionList items={pendingRedemptions} onResolve={resolveRedemption} busy={busy} /></section>
        </div>
      )}

      {view === "tasks" && (
        <div className="split">
          <section className="card section"><div className="section-head"><h2>{editingTaskId ? "编辑任务" : "新增任务"}</h2>{editingTaskId && <button className="icon-button" title="取消" onClick={() => { setEditingTaskId(null); setTaskForm(emptyTask); }}><X size={16} /></button>}</div><TaskFormView form={taskForm} setForm={setTaskForm} onSubmit={saveTask} busy={busy} editing={Boolean(editingTaskId)} /></section>
          <section className="card section"><div className="section-head"><h2>任务列表</h2></div><div className="item-list">{data.tasks.map((task) => <TaskCard key={task.id} task={task} onComplete={completeTask} onEdit={editTask} onToggle={(next) => run(() => api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ is_active: next }) }), next ? "任务已启用" : "任务已停用")} />)}</div></section>
        </div>
      )}

      {view === "rewards" && (
        <div className="split">
          <section className="card section"><div className="section-head"><h2>{editingRewardId ? "编辑奖励" : "新增奖励"}</h2>{editingRewardId && <button className="icon-button" title="取消" onClick={() => { setEditingRewardId(null); setRewardForm(emptyReward); }}><X size={16} /></button>}</div><RewardFormView form={rewardForm} setForm={setRewardForm} onSubmit={saveReward} busy={busy} editing={Boolean(editingRewardId)} /></section>
          <section className="card section"><div className="section-head"><h2>奖励列表</h2></div><div className="item-list">{data.rewards.map((reward) => <RewardCard key={reward.id} reward={reward} onRedeem={redeemReward} onEdit={editReward} onToggle={(next) => run(() => api(`/api/rewards/${reward.id}`, { method: "PATCH", body: JSON.stringify({ is_active: next }) }), next ? "奖励已启用" : "奖励已停用")} />)}</div></section>
        </div>
      )}

      {view === "redemptions" && <section className="card section"><div className="section-head"><div className="section-title"><History size={18} /><h2>兑换记录</h2></div></div><RedemptionList items={data.redemptions} onResolve={resolveRedemption} busy={busy} /></section>}
    </main>
  );
}

function TaskFormView({ form, setForm, onSubmit, busy, editing }: { form: TaskForm; setForm: (form: TaskForm) => void; onSubmit: (event: React.FormEvent) => void; busy: boolean; editing: boolean }) {
  return <form className="form" onSubmit={onSubmit}><label className="label">任务名称<input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="label">说明<textarea className="textarea" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><div className="form-row"><label className="label">积分<input className="input" type="number" min="1" value={form.points} onChange={(event) => setForm({ ...form, points: event.target.value })} /></label><label className="label">周期<select className="select" value={form.cycle} onChange={(event) => setForm({ ...form, cycle: event.target.value as Cycle })}><option value="daily">每日</option><option value="weekly">每周</option><option value="none">不限</option></select></label></div><button className="button primary" disabled={busy}><Plus size={16} />{editing ? "保存任务" : "创建任务"}</button></form>;
}

function RewardFormView({ form, setForm, onSubmit, busy, editing }: { form: RewardForm; setForm: (form: RewardForm) => void; onSubmit: (event: React.FormEvent) => void; busy: boolean; editing: boolean }) {
  return <form className="form" onSubmit={onSubmit}><label className="label">奖励名称<input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="label">说明<textarea className="textarea" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className="label">所需积分<input className="input" type="number" min="1" value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} /></label><button className="button primary" disabled={busy}><Gift size={16} />{editing ? "保存奖励" : "创建奖励"}</button></form>;
}

function TaskCard({ task, onComplete, onEdit, onToggle }: { task: Task; onComplete: (id: string) => void; onEdit: (task: Task) => void; onToggle?: (next: boolean) => void }) {
  return <div className="task-card"><div className="card-title-row"><div><h3>{task.title}</h3>{task.description && <p>{task.description}</p>}</div><div className="card-actions"><span className="badge green">+{task.points}</span><span className="badge blue">{cycleLabel[task.cycle]}</span>{!task.is_active && <span className="badge red">停用</span>}</div></div><div className="card-actions"><button className="button primary" onClick={() => onComplete(task.id)} disabled={!task.is_active}><Check size={16} />完成</button><button className="icon-button" title="编辑" onClick={() => onEdit(task)}><Pencil size={16} /></button>{onToggle && <button className="icon-button" title={task.is_active ? "停用" : "启用"} onClick={() => onToggle(!task.is_active)}>{task.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}</button>}</div></div>;
}

function RewardCard({ reward, onRedeem, onEdit, onToggle }: { reward: Reward; onRedeem: (id: string) => void; onEdit: (reward: Reward) => void; onToggle?: (next: boolean) => void }) {
  return <div className="reward-card"><div className="card-title-row"><div><h3>{reward.title}</h3>{reward.description && <p>{reward.description}</p>}</div><div className="card-actions"><span className="badge yellow">{reward.cost} 分</span>{!reward.is_active && <span className="badge red">停用</span>}</div></div><div className="card-actions"><button className="button primary" onClick={() => onRedeem(reward.id)} disabled={!reward.is_active}><Gift size={16} />兑换</button><button className="icon-button" title="编辑" onClick={() => onEdit(reward)}><Pencil size={16} /></button>{onToggle && <button className="icon-button" title={reward.is_active ? "停用" : "启用"} onClick={() => onToggle(!reward.is_active)}>{reward.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}</button>}</div></div>;
}

function RedemptionList({ items, onResolve, busy }: { items: RewardRedemption[]; onResolve: (id: string, decision: "approve" | "reject") => void; busy: boolean }) {
  if (items.length === 0) return <div className="empty">暂无兑换记录</div>;
  return <div className="item-list">{items.map((item) => <div className="item-row" key={item.id}><div><strong>{item.members?.name ?? "成员"}</strong> 申请 {item.rewards?.title ?? "奖励"}<div className="meta">{formatTime(item.requested_at)} · {item.cost} 分</div></div><div className="card-actions"><span className={`badge ${item.status === "approved" ? "green" : item.status === "rejected" ? "red" : "yellow"}`}>{item.status === "pending" ? "待确认" : item.status === "approved" ? "已确认" : "已拒绝"}</span>{item.status === "pending" && <><button className="icon-button" title="确认" disabled={busy} onClick={() => onResolve(item.id, "approve")}><Check size={16} /></button><button className="icon-button" title="拒绝" disabled={busy} onClick={() => onResolve(item.id, "reject")}><X size={16} /></button></>}</div></div>)}</div>;
}
