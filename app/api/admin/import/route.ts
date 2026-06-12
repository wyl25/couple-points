import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getStorageSummary, importDataSnapshot } from "@/lib/store";

function authorized(request: Request) {
  const expected = process.env.MIGRATION_SECRET;
  return Boolean(expected && request.headers.get("x-migration-secret") === expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return jsonError("无权访问迁移接口。", 401);
  try {
    return NextResponse.json({ provider: "edgeone-blob", collections: await getStorageSummary() });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "读取存储状态失败", 500);
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return jsonError("无权访问迁移接口。", 401);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("迁移文件不是有效的 JSON。", 400);

  try {
    const snapshot = "collections" in body && body.collections && typeof body.collections === "object"
      ? body.collections as Record<string, unknown>
      : body as Record<string, unknown>;
    const imported = await importDataSnapshot(snapshot);
    return NextResponse.json({ imported, collections: await getStorageSummary() });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "数据导入失败", 400);
  }
}
