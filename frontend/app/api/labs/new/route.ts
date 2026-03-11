import { NextResponse } from "next/server";


const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

const NewLabUrl = `${base}/api/user_entities/`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = request.headers.get("Authorization") || "";

    // console.log("body: ",  body);
    // console.log("token: ", token);

    console.log(JSON.stringify(body, null, 2));

    const response = await fetch(NewLabUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const json = await response.json();

    console.log("response: ", json);
    console.log("status: ", response.status);

    if (!response.ok) {
      return NextResponse.json(json, { status: response.status });
    }

    return NextResponse.json(json);
  } catch (error) {
    console.log("error: ", error);
    return NextResponse.error();
  }
}