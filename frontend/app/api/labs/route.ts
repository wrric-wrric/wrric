import { NextResponse } from "next/server";
import { getLabs } from "./cache";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization") || undefined;
    const labs = await getLabs(authHeader);
    return NextResponse.json(labs);
  } catch (error) {
    console.error("Error in /api/labs route:", error);
    return NextResponse.json({ error: "Failed to fetch labs" }, { status: 500 });
  }
}
