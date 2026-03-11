import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ lab: string }> }
) {
  try {
    const { lab } = await context.params;
    const res = await fetch(`${BACKEND_URL}/api/labs/${lab}/shares`, {
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: "Failed to get share count" }, { status: 500 });
  }
}
