import { NextResponse } from 'next/server';

// Define the structure of a Farcaster user from the Neynar API
interface NeynarUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
}

export async function POST(request: Request) {
  const { fname } = await request.json();
  const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

  if (!fname) {
    return NextResponse.json({ message: 'Username is required' }, { status: 400 });
  }

  if (!NEYNAR_API_KEY) {
    return NextResponse.json({ message: 'Neynar API key not configured' }, { status: 500 });
  }

  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      api_key: NEYNAR_API_KEY,
    },
  };

  try {
    // Step 1: Get the main user's profile information by their username
    const userResponse = await fetch(`https://api.neynar.com/v2/farcaster/user/search?q=${fname}&viewer_fid=1`, options);
    if (!userResponse.ok) throw new Error('Failed to find user.');
    
    const userData = await userResponse.json();
    if (!userData.result || userData.result.users.length === 0) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    const mainUser: NeynarUser = userData.result.users[0];
    const userFid = mainUser.fid;

    // Step 2: Get the user's followers
    const followersResponse = await fetch(`https://api.neynar.com/v2/farcaster/followers?fid=${userFid}&limit=20`, options);
    if (!followersResponse.ok) throw new Error('Failed to fetch followers.');

    const followersData = await followersResponse.json();
    const followers: NeynarUser[] = followersData.users;

    // Step 3: Structure the data to match the front-end's expectation
    const apiResponse = {
      mainUser: mainUser,
      innerCircle: followers.slice(0, 8), // First 8 followers go to the inner circle
      outerCircle: followers.slice(8, 20), // Next 12 followers go to the outer circle
    };

    return NextResponse.json(apiResponse);

  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}