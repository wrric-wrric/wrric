import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://10.22.129.236:8000";

/**
 * ==============================================================
 *  🔍 GET /api/match_records/funder
 *  Retrieve all match records associated with the current user's funder profile
 * ==============================================================
 */
export async function GET(request: NextRequest) {
  console.debug("🟢 [GET /api/match_records/funder] Initiating funder match fetch...");

  try {
    // Step 1: Validate user session
    const session = await getCurrentUser(request);
    if (!session) {
      console.warn("❌ Unauthorized access attempt — no session found.");
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user?.id || "(unknown)";
    console.debug(`✅ Session validated for user_id=${userId}`);
    console.debug("🟡 Access Token (truncated):", session.accessToken?.slice(0, 25) + "...");

    // Step 2: Prepare backend request
    const backendUrl = `${base}/api/match_records/funder`;
    console.debug(`📡 Sending request to backend: ${backendUrl}`);

    const response = await fetch(backendUrl, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    console.debug(`📬 Backend responded with status: ${response.status} (${response.statusText})`);

    // Step 3: Handle response cases
    if (response.status === 404) {
      console.warn(`⚠️ No funder profile or matches found for user_id=${userId}`);
      const errorData = await response.json().catch(() => ({}));
      console.debug("🧾 404 Response body:", errorData);
      return NextResponse.json(errorData, { status: 404 });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("🚨 Backend error data:", errorData);
      return NextResponse.json(
        { detail: "Failed to retrieve funder matches", ...errorData },
        { status: response.status }
      );
    }

    // Step 4: Success
    const matchRecords = await response.json();
    console.info(
      `✅ Successfully retrieved ${matchRecords.length} match records for user_id=${userId}`
    );
    console.debug("🧾 Match records preview:", JSON.stringify(matchRecords.slice(0, 4), null, 2));

    return NextResponse.json(matchRecords, { status: 200 });
  } catch (error: any) {
    console.error("💥 [GET /api/match_records/funder] Unexpected error:", error);
    return NextResponse.json(
      { detail: "Internal server error while fetching funder matches" },
      { status: 500 }
    );
  }
}

/**
 * ==============================================================
 *  📨 POST /api/match_records
 *  Create a new match record for a funder <-> lab pairing
 * ==============================================================
 */
export async function POST(request: NextRequest) {
  console.debug("🟢 [POST /api/match_records] Creating new match record...");

  try {
    // Step 1: Validate user session
    const session = await getCurrentUser(request);
    if (!session) {
      console.warn("❌ Unauthorized request — no valid session found.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.debug("✅ Authenticated as:", session.user?.email || "(unknown email)");
    console.debug("🟡 Access Token (truncated):", session.accessToken?.slice(0, 25) + "...");

    // Step 2: Read and log incoming body
    const body = await request.json();
    console.debug("📥 Incoming body payload:", JSON.stringify(body, null, 2));

    // Step 3: Prepare backend URL and request
    const backendUrl = `${base}/api/match_records`;
    console.debug(`📡 Forwarding to backend: ${backendUrl}`);

    const fetchOptions = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    };

    console.debug("📦 Outgoing fetch options:", {
      method: fetchOptions.method,
      headers: fetchOptions.headers,
      body: fetchOptions.body,
    });

    // Step 4: Execute backend request
    const response = await fetch(backendUrl, fetchOptions);
    console.debug(`📬 Backend response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("🚨 Backend error response:", errorData);
      throw new Error(errorData.detail || `Backend returned ${response.status}`);
    }

    // Step 5: Parse success response
    const matchRecord = await response.json();
    console.info("✅ Match record created successfully:", matchRecord);
    return NextResponse.json(matchRecord, { status: 201 });
  } catch (error) {
    console.error("💥 [POST /api/match_records] Error:", error);
    return NextResponse.json(
      { error: "Failed to create match record", detail: String(error) },
      { status: 500 }
    );
  }
}
