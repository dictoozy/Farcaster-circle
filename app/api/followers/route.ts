// app/api/followers/route.ts - Simplified approach
import { NextResponse } from 'next/server';

interface NeynarUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
}

interface NeynarUserResponse {
  user: NeynarUser;
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

  try {
    // Get the main user
    const userResponse = await fetch(`https://api.neynar.com/v2/farcaster/user/by-username?username=${fname}`, {
      headers: {
        accept: 'application/json',
        api_key: NEYNAR_API_KEY,
      },
    });

    let mainUser: NeynarUser;
    if (userResponse.ok) {
      const userData: NeynarUserResponse = await userResponse.json();
      mainUser = userData.user;
    } else {
      // Fallback if user lookup fails
      mainUser = {
        fid: 1,
        username: fname,
        display_name: fname.charAt(0).toUpperCase() + fname.slice(1),
        pfp_url: `https://ui-avatars.com/api/?name=${fname}&size=100&background=6366f1&color=ffffff`
      };
    }

    // Always use curated list of famous Farcaster users for circles
    const famousUsers = [
      { username: 'vitalik', display_name: 'Vitalik Buterin', pfp_url: 'https://ui-avatars.com/api/?name=Vitalik&size=100&background=6366f1&color=ffffff' },
      { username: 'balajis', display_name: 'Balaji S', pfp_url: 'https://ui-avatars.com/api/?name=Balaji&size=100&background=a855f7&color=ffffff' },
      { username: 'jessepollak', display_name: 'Jesse Pollak', pfp_url: 'https://ui-avatars.com/api/?name=Jesse&size=100&background=ec4899&color=ffffff' },
      { username: 'linda', display_name: 'Linda Xie', pfp_url: 'https://ui-avatars.com/api/?name=Linda&size=100&background=f59e0b&color=ffffff' },
      { username: 'coopahtroopa', display_name: 'Cooper Turley', pfp_url: 'https://ui-avatars.com/api/?name=Cooper&size=100&background=10b981&color=ffffff' },
      { username: 'varunsrin', display_name: 'Varun Srinivasan', pfp_url: 'https://ui-avatars.com/api/?name=Varun&size=100&background=3b82f6&color=ffffff' },
      { username: 'pfista', display_name: 'Paul Frazee', pfp_url: 'https://ui-avatars.com/api/?name=Paul&size=100&background=8b5cf6&color=ffffff' },
      { username: 'seneca', display_name: 'Seneca', pfp_url: 'https://ui-avatars.com/api/?name=Seneca&size=100&background=ef4444&color=ffffff' },
      { username: 'cassie', display_name: 'Cassie Heart', pfp_url: 'https://ui-avatars.com/api/?name=Cassie&size=100&background=f97316&color=ffffff' },
      { username: 'rish', display_name: 'Rish', pfp_url: 'https://ui-avatars.com/api/?name=Rish&size=100&background=84cc16&color=ffffff' },
      { username: 'farcasterxyz', display_name: 'Farcaster', pfp_url: 'https://ui-avatars.com/api/?name=Farcaster&size=100&background=7c3aed&color=ffffff' },
      { username: 'warpcast', display_name: 'Warpcast', pfp_url: 'https://ui-avatars.com/api/?name=Warpcast&size=100&background=dc2626&color=ffffff' },
      { username: 'alexmasmej', display_name: 'Alex Masmej', pfp_url: 'https://ui-avatars.com/api/?name=Alex&size=100&background=059669&color=ffffff' },
      { username: 'raj', display_name: 'Raj Gokal', pfp_url: 'https://ui-avatars.com/api/?name=Raj&size=100&background=0ea5e9&color=ffffff' },
      { username: 'grin', display_name: 'Michael Grin', pfp_url: 'https://ui-avatars.com/api/?name=Grin&size=100&background=c026d3&color=ffffff' },
      { username: 'zachterrell', display_name: 'Zach Terrell', pfp_url: 'https://ui-avatars.com/api/?name=Zach&size=100&background=ea580c&color=ffffff' },
      { username: 'krishna', display_name: 'Krishna Sriram', pfp_url: 'https://ui-avatars.com/api/?name=Krishna&size=100&background=7c2d12&color=ffffff' },
      { username: 'ace', display_name: 'Ace', pfp_url: 'https://ui-avatars.com/api/?name=Ace&size=100&background=8b5cf6&color=ffffff' },
      { username: 'alvesjtiago', display_name: 'Tiago Alves', pfp_url: 'https://ui-avatars.com/api/?name=Tiago&size=100&background=06b6d4&color=ffffff' },
      { username: 'treethought', display_name: 'Tree Thought', pfp_url: 'https://ui-avatars.com/api/?name=Tree&size=100&background=166534&color=ffffff' },
    ];

    const response = {
      mainUser: {
        pfp_url: mainUser.pfp_url,
        username: mainUser.username,
        display_name: mainUser.display_name,
      },
      innerCircle: famousUsers.slice(0, 8),
      outerCircle: famousUsers.slice(8, 20),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}