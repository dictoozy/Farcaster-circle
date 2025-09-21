// FINAL VERSION: Uses the paid 'bulk-by-username' endpoint for maximum reliability.
import { NextResponse } from 'next/server';

interface UserPfp {
    url: string;
}

interface User {
    pfp_url?: string;
    pfp?: UserPfp;
    username: string;
    display_name?: string;
    displayName?: string;
    fid: number;
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
        console.error("Neynar API Error or User Not Found:", userData);
        throw new Error(`User "${fname}" not found on Farcaster.`);
    }
    
    const user = userData.users[0];
    
    const mainUser = {
      pfp_url: user.pfp_url,
      username: user.username,
      display_name: user.display_name,
    };

    // This endpoint should also now be available on the paid plan
    const followersResponse = await fetch(`https://api.neynar.com/v2/farcaster/followers?fid=${user.fid}&limit=30`, {
        headers: { api_key: NEYNAR_API_KEY }
    });
    if (!followersResponse.ok) throw new Error('Failed to fetch followers.');
    const followersData = await followersResponse.json();

    const allFollowers = followersData.users.map((follower: any) => ({
      pfp_url: follower.pfp.url,
      username: follower.username,
      display_name: follower.displayName,
    }));
    
    const innerCircle = allFollowers.slice(0, 10);
    const outerCircle = allFollowers.slice(10, 30);
    
    return NextResponse.json({ mainUser, innerCircle, outerCircle });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ message: error.message || 'An internal server error occurred' }, { status: 500 });
  }
}