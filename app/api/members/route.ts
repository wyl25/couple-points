import { NextResponse } from "next/server";
import { cleanText, jsonError, requireSpaceId } from "@/lib/api";
import { createMember } from "@/lib/store";

export async function POST(request: Request) {
  const auth = requireSpaceId();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name, 40);
  if (!name) return jsonError("请输入成员昵称。");

  try {
    return NextResponse.json(await createMember(auth.spaceId, name));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "创建成员失败", 400);
  }
}
