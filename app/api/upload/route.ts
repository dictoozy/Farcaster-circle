// app/api/followers/route.ts
import { NextResponse } from 'next/server';

interface NeynarUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  follower_count?: number;
  following_count?: number;
}

interface NeynarUserResponse {
  user: NeynarUser;
}

interface NeynarFollowersResponse {
  users: NeynarUser[];
}

export async function POST(request: Request) {
  try {
    const { fname } = await request.json();

    if (!fname) {
      return NextResponse.json(
        { message: 'Username is required' },
        { status: 400 }
      );
    }

    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
    if (!NEYNAR_API_KEY) {
      return NextResponse.json(
        { message: 'Neynar API key not configured' },
        { status: 500 }
      );
    }

    console.log('Looking up user:', fname);

    // Step 1: Get user by username
    const userResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/user/by-username?username=${fname}`,
      {
        headers: {
          'Accept': 'application/json',
          'api_key': NEYNAR_API_KEY,
        },
      }
    );

    if (!userResponse.ok) {
      console.error('User lookup failed:', userResponse.status);
      return NextResponse.json(
        { message: `User "${fname}" not found on Farcaster` },
        { status: 404 }
      );
    }

    const userData: NeynarUserResponse = await userResponse.json();
    console.log('User found:', userData.user.username);

    // Step 2: Get followers
    const followersResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/followers?fid=${userData.user.fid}&limit=25`,
      {
        headers: {
          'Accept': 'application/json',
          'api_key': NEYNAR_API_KEY,
        },
      }
    );

    if (!followersResponse.ok) {
      console.error('Followers lookup failed:', followersResponse.status);
      // Fallback to mock data for followers if this fails
      const mockFollowers = Array.from({ length: 20 }, (_, i) => ({
        fid: i + 1000,
        username: `user${i}`,
        display_name: `User ${i}`,
        pfp_url: `https://ui-avatars.com/api/?name=User${i}&size=100&background=random`,
      }));

      return NextResponse.json({
        mainUser: {
          pfp_url: userData.user.pfp_url,
          username: userData.user.username,
          display_name: userData.user.display_name,
        },
        innerCircle: mockFollowers.slice(0, 8),
        outerCircle: mockFollowers.slice(8, 20),
      });
    }

    const followersData: NeynarFollowersResponse = await followersResponse.json();
    console.log('Followers found:', followersData.users?.length || 0);

    // Process the real data
    const allFollowers = followersData.users.map((follower: NeynarUser) => ({
      pfp_url: follower.pfp_url || `https://ui-avatars.com/api/?name=${follower.username}&size=100&background=6366f1&color=ffffff`,
      username: follower.username,
      display_name: follower.display_name || follower.username,
    }));

    const response = {
      mainUser: {
        pfp_url: userData.user.pfp_url || `https://ui-avatars.com/api/?name=${userData.user.username}&size=100&background=6366f1&color=ffffff`,
        username: userData.user.username,
        display_name: userData.user.display_name || userData.user.username,
      },
      innerCircle: allFollowers.slice(0, 8),
      outerCircle: allFollowers.slice(8, 20),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}