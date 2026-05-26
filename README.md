# Couple Points

国内可访问版情侣/小团队积分系统。前端使用 Next.js，后端 API 使用腾讯云 CloudBase 云数据库。

## 功能

- 成员独立任务库：每个任务只属于一个成员。
- Apple Health 风格首页：今日完成圆环、连续完成天数、7 天积分趋势。
- 每日任务每天最多完成一次，重复点击不会重复加分。
- 每日任务支持自定义未完成扣分。
- 手动结算昨日：检查昨日未完成每日任务并扣分，且同一天不会重复结算。
- 积分事件流水：任务加分、每日扣分、奖励兑换扣分都有记录。
- 奖励兑换仍采用提交后确认的流程。

## 本地开发

```bash
npm install
npm run dev
```

默认邀请码：

```text

```

## CloudBase 配置

在腾讯云 CloudBase/云开发中新建环境后，复制 `.env.example` 为 `.env.local`，填写：

```env
DB_PROVIDER=cloudbase
CLOUDBASE_ENV_ID=你的云开发环境 ID
CLOUDBASE_DATABASE=
TENCENT_SECRET_ID=你的腾讯云 SecretId
TENCENT_SECRET_KEY=你的腾讯云 SecretKey
INVITE_HASH_SECRET=一段长随机字符串
SESSION_SECRET=另一段长随机字符串
```

如果代码部署在 CloudBase 环境内，通常可以不填 `TENCENT_SECRET_ID` 和 `TENCENT_SECRET_KEY`；本地执行初始化脚本时需要填写。

初始化数据库集合和默认空间：

```bash
npm run seed:cloudbase
```

脚本会创建这些集合：

- `couple_points_spaces`
- `couple_points_members`
- `couple_points_tasks`
- `couple_points_task_completions`
- `couple_points_rewards`
- `couple_points_reward_redemptions`
- `couple_points_point_events`
- `couple_points_daily_settlements`

## 部署

推荐部署到腾讯云 CloudBase 支持 Next.js 的 Web/应用托管服务。环境变量与 `.env.local` 保持一致。

部署完成后，把线上网址和邀请码 `love-0525` 分享给对方即可。
