# Couple Points

情侣或小团队共享积分系统。Next.js 部署在 EdgeOne Pages，数据使用 EdgeOne Pages Blob，不依赖 CloudBase。

## 功能

- 每位成员拥有独立任务库。
- 每日任务支持完成加分和未完成扣分。
- 今天及前三天可补打卡，第四天后才能结算扣分。
- 奖励自定义、兑换申请、确认后扣分。
- 积分事件、完成记录和结算记录可追溯。
- 手机浏览器和桌面浏览器均可使用。

## 本地检查

```bash
npm install
npm run typecheck
npm run lint
npm run build
```

Blob SDK 需要 EdgeOne Pages Functions 运行环境。本地构建可以正常完成，但涉及数据的 API 应在线上环境验证。

## EdgeOne 环境变量

```env
DB_PROVIDER=edgeone-blob
EDGEONE_BLOB_STORE=couple-points-data
INVITE_CODE=love-0525
INVITE_HASH_SECRET=一段长随机字符串
SESSION_SECRET=另一段长随机字符串
MIGRATION_SECRET=仅用于首次导入的长随机字符串
```

部署并完成数据导入后，可以删除 `MIGRATION_SECRET`，导入接口将自动失效。

## 从 CloudBase 迁移

1. 在 CloudBase 文档型数据库中将以下集合分别导出为 JSON：

```text
couple_points_spaces
couple_points_members
couple_points_tasks
couple_points_task_completions
couple_points_rewards
couple_points_reward_redemptions
couple_points_point_events
couple_points_daily_settlements
```

2. 将导出的 JSON 放进同一个目录，例如 `cloudbase-export`。

3. 生成统一迁移文件：

```bash
npm run migration:payload -- cloudbase-export edgeone-migration.json
```

4. 部署完成后导入：

```bash
curl -X POST "https://你的域名/api/admin/import" \
  -H "Content-Type: application/json" \
  -H "x-migration-secret: 你的MIGRATION_SECRET" \
  --data-binary "@edgeone-migration.json"
```

5. 查询导入后的集合数量：

```bash
curl "https://你的域名/api/admin/import" \
  -H "x-migration-secret: 你的MIGRATION_SECRET"
```

确认成员、积分、任务和历史记录完整后，从 EdgeOne 删除 `MIGRATION_SECRET`、`CLOUDBASE_APIKEY` 和 `CLOUDBASE_ENV_ID`。

## 存储说明

每个逻辑集合保存为 Blob Store `couple-points-data` 中的独立 JSON 文件。所有读取使用强一致模式，避免完成任务后仍看到旧积分。该架构适合成员数量较少的私人共享积分空间。
