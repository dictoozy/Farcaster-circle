// app/api/followers/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { fname } = await request.json();

    if (!fname) {
      return NextResponse.json(
        { message: 'Username is required' },
        { status: 400 }
      );
    }

    // For now, return mock data while Neynar issues are resolved
    // This will let you test the complete flow
    const mockData = {
      mainUser: {
        pfp_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${fname}`,
        username: fname,
        display_name: fname.charAt(0).toUpperCase() + fname.slice(1),
      },
      innerCircle: Array.from({ length: 8 }, (_, i) => ({
        pfp_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${fname}inner${i}`,
        username: `user${i}`,
        display_name: `Inner User ${i}`,
      })),
      outerCircle: Array.from({ length: 12 }, (_, i) => ({
        pfp_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${fname}outer${i}`,
        username: `outer${i}`,
        display_name: `Outer User ${i}`,
      })),
    };

    return NextResponse.json(mockData);
  } catch (error) {
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}