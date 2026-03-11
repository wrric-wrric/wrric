import { NextRequest, NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

const registerUrl = `${base}/api/signup`;

export async function POST(req: NextRequest) {
    console.log("entered register route");
    const { username, email, password, recaptchaResponse } = await req.json();
    const data = { username, email, password, recaptchaResponse };

    try {
        const response = await fetch(registerUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        const json = await response.json();
        console.log("response from register route: ", json);
        return NextResponse.json(json);
    } catch (error) {
        console.log("error: ", error);
        return NextResponse.error();
    }
}