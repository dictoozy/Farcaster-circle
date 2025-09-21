// FINAL DIAGNOSTIC VERSION: This will print the loaded API key to Vercel's logs.
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { fname } = await request.json();
  const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

  // --- THIS IS OUR LISTENING DEVICE for VERCEL ---
  console.log("================ VERCEL LOG ================");
  console.log("Farcaster username requested:", fname);
  console.log("Is Neynar API Key present on Vercel?:", !!NEYNAR_API_KEY);
  console.log("Key snippet:", NEYNAR_API_KEY ? NEYNAR_API_KEY.slice(0, 4) + "..." : "undefined");
  console.log("============================================");

  if (!fname) {
    return NextResponse.json({ message: 'Farcaster username is required' }, { status: 400 });
  }
  if (!NEYNAR_API_KEY) {
    return NextResponse.json({ message: 'CRITICAL ERROR: Neynar API key is undefined on Vercel!' }, { status: 500 });
  }

  try {
    const userApiUrl = `https://api.neynar.com/v2/farcaster/user/bulk-by-username?usernames=${fname}&viewer_fid=3`;
    
    const userResponse = await fetch(userApiUrl, {
      headers: { api_key: NEYNAR_API_KEY }
    });

    if (!userResponse.ok) {
        const errorText = await userResponse.text();
        console.error("Neynar API Error on Vercel:", errorText);
        throw new Error('Failed to fetch user from Neynar API. Check Vercel logs.');
    }
    const userData = await userResponse.json();
    
    if (!userData.users || userData.users.length === 0) {
        throw new Error(`User "${fname}" not found on Farcaster.`);
    }
    
    const user = userData.users[0];
    
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

    const allFollowers = followersData.users.map((follower: any) => ({
      pfp_url: follower.pfp.url,
      username: follower.username,
      display_name: follower.displayName,
    }));
    
    const innerCircle = allFollowers.slice(0, 10);
    const outerCircle = allFollowers.slice(10, 30);
    
    return NextResponse.json({ mainUser, innerCircle, outerCircle });

  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'An internal server error occurred' }, { status: 500 });
  }
}