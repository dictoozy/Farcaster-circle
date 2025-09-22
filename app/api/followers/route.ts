// File: app/api/user/route.ts

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
    // 1. First, we need to get the user's FID (Farcaster ID) from their username
    const userResponse = await fetch(`https://api.neynar.com/v2/farcaster/user/search?q=${username}&viewer_fid=1`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'api_key': NEYNAR_API_KEY,
      },
    });
    
    if (!userResponse.ok) {
        throw new Error('Failed to find user');
    }
    
    const userData = await userResponse.json();
    const fid = userData.result.users[0]?.fid;

    if (!fid) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // 2. Now, use the FID to get the user's followers (or any other connection)
    // We'll limit it to 25 followers for this example
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
    
    // The API gives us a list of users, which is exactly what your component needs
    return NextResponse.json(followersData.users, { status: 200 });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'An error occurred' }, { status: 500 });
  }
}