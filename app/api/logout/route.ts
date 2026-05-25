import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/api";

export async function POST() {
  cookies().delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
