import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization") || "";
    const rawBody = await request.json();

    console.log("🟢 Incoming Raw Body:", rawBody);
    console.log("🟡 Incoming Headers:", Object.fromEntries(request.headers));

    // ✅ Construct payload that matches FastAPI schema
    const formattedBody = {
      user_id: rawBody.user_id, // ensure correct key
      entity_ids: rawBody.labIds,                // labId as a list
      entity_urls: rawBody.entity_urls || [],     // optional, defaults empty
      inquiry: rawBody.inquiry                    // must be >= 10 chars
    };

    console.log("🔵 Formatted Request Payload:", formattedBody);

    // Backend endpoint
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";
    
    const inquiryUrl = `${base}/api/inquiry/broadcast`;

    // Prepare fetch options
    const fetchOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(formattedBody),
    };

    console.log("🟣 Sending to Backend:", {
      url: inquiryUrl,
      method: fetchOptions.method,
      headers: fetchOptions.headers,
      body: formattedBody,
    });

    // Send to backend
    const response = await fetch(inquiryUrl, fetchOptions);
    console.log("🟠 Backend Response Status:", response.status, response.statusText);

    const json = await response.json();
    console.log("🟢 Backend Response JSON:", json);

    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    console.error("🔴 Error in POST /api/inquiry:", error);
    return NextResponse.json({ detail: "Internal Server Error" }, { status: 500 });
  }
}
