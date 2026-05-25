import { NextResponse } from "next/server";
import { getSpaceIdFromCookie } from "@/lib/api";

export async function GET() {
  return NextResponse.json({ joined: Boolean(getSpaceIdFromCookie()) });
}
