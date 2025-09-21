// FINAL, VERCEL-READY VERSION: Fixes all TypeScript errors.
import { NextResponse } from 'next/server';

// Define specific types for Neynar's API responses
interface NeynarUser {
    pfp_url: string;
    username: string;
    display_name: string;
    fid: number;
}

interface NeynarFollower {
    pfp: { url: string };
    username: string;
    displayName: string;
}

export async function POST(request: Request) {
  const { fname } = await request.json();
  const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

  if (!fname) {
    return NextResponse.json({ message: 'Farcaster username is required' }, { status: 400 });
  }
  if (!NEYNAR_API_KEY) {
    return NextResponse.json({ message: 'Neynar API key not configured' }, { status: 500 });
  }

  try {
    const userApiUrl = `https://api.neynar.com/v2/farcaster/user/bulk-by-username?usernames=${fname}&viewer_fid=3`;
    
    const userResponse = await fetch(userApiUrl, {
      headers: { api_key: NEYNAR_API_KEY }
    });

    const userData = await userResponse.json();

    if (!userResponse.ok || !userData.users || userData.users.length === 0) {
        throw new Error(`User "${fname}" not found on Farcaster.`);
    }
    
    const user: NeynarUser = userData.users[0];
    
    const mainUser = {
      pfp_url: user.pfp_url,
      username: user.username,
      display_name: user.display_name,
    };

    const followersResponse = await fetch(`https://api.neynar.com/v2/farcaster/followers?fid=${user.fid}&limit=30`, {
        headers: { api_key: NEYNAR_API_KEY }
    });
    if (!followersResponse.ok) throw new Error('Failed to fetch followers.');
    const followersData = await followersResponse.json();

    const allFollowers = followersData.users.map((follower: NeynarFollower) => ({
      pfp_url: follower.pfp.url,
      username: follower.username,
      display_name: follower.displayName,
    }));
    
    const innerCircle = allFollowers.slice(0, 10);
    const outerCircle = allFollowers.slice(10, 30);
    
    return NextResponse.json({ mainUser, innerCircle, outerCircle });

  } catch (error: unknown) { // Use 'unknown' for better type safety
    if (error instanceof Error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'An internal server error occurred' }, { status: 500 });
  }
}