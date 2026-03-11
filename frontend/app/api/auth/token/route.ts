import { NextRequest, NextResponse } from "next/server";
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json(
                { error: 'No token found' },
                { status: 401 }
            );
        }

        // Return the token (this is safe since it's server-side)
        return NextResponse.json({ token });
    } catch (error) {
        console.error('Token access error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}