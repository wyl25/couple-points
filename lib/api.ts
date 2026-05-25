import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "@/lib/session";

export const SESSION_COOKIE = "couple_points_session";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function getSpaceIdFromCookie() {
  return verifySession(cookies().get(SESSION_COOKIE)?.value);
}

export function requireSpaceId() {
  const spaceId = getSpaceIdFromCookie();
  if (!spaceId) return { error: jsonError("请先输入邀请码进入空间。", 401) } as const;
  return { spaceId } as const;
}

export function cleanText(value: unknown, maxLength = 120) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function positiveInt(value: unknown) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return null;
  return number;
}
