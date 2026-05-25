import { NextResponse } from "next/server";
import { requireSpaceId } from "@/lib/api";
import { getBootstrap } from "@/lib/store";

export async function GET() {
  const auth = requireSpaceId();
  if ("error" in auth) return auth.error;

  try {
    return NextResponse.json(await getBootstrap(auth.spaceId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "加载失败" }, { status: 500 });
  }
}
