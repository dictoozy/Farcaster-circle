import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username');
  
  if (!username) {
    return NextResponse.json({ message: 'Username is required' }, { status: 400 });
  }

  const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
  if (!NEYNAR_API_KEY) {
    return NextResponse.json({ message: 'API key not configured' }, { status: 500 });
  }

  try {
    // 1. Get the user's FID from their username
    const userResponse = await fetch(`https://api.neynar.com/v2/farcaster/user/search?q=${username}&viewer_fid=1`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'api_key': NEYNAR_API_KEY,
      },
    });
    
    if (!userResponse.ok) {
        throw new Error('Failed to fetch user from Neynar API');
    }
    
    const userData = await userResponse.json();

    // Safer check to ensure the user exists
    if (!userData.result || !userData.result.users || userData.result.users.length === 0) {
      return NextResponse.json({ message: 'Farcaster user not found' }, { status: 404 });
    }

    const fid = userData.result.users[0].fid;

    // 2. Use the FID to get the user's followers (limited to 25 for this example)
    const followersResponse = await fetch(`https://api.neynar.com/v2/farcaster/followers?fid=${fid}&limit=25`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'api_key': NEYNAR_API_KEY,
      },
    });

    if (!followersResponse.ok) {
      throw new Error('Failed to fetch followers');
    }

    const followersData = await followersResponse.json();
    
    return NextResponse.json(followersData.users, { status: 200 });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ message: error.message || 'An internal server error occurred' }, { status: 500 });
  }
}