// app/api/followers/route.ts - Fixed data structure
import { NextResponse } from 'next/server';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

interface NeynarUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
}

interface InteractionScore {
  user: NeynarUser;
  score: number;
}

async function neynarFetch(endpoint: string) {
  const res = await fetch(`https://api.neynar.com/v2/farcaster/${endpoint}`, {
    headers: {
      'Accept': 'application/json',
      'api_key': NEYNAR_API_KEY!,
    },
  });
  
  if (!res.ok) {
    console.error(`Neynar API error: ${res.status} for ${endpoint}`);
    return null;
  }
  return res.json();
}

export async function POST(request: Request) {
  try {
    const { fname } = await request.json();
    const username = fname?.replace('@', '').toLowerCase().trim();

    if (!username) {
      return NextResponse.json({ message: 'Username is required' }, { status: 400 });
    }

    if (!NEYNAR_API_KEY) {
      return NextResponse.json({ message: 'API not configured' }, { status: 500 });
    }

    console.log(`Looking up user: ${username}`);

    // 1. Search for user
    const searchData = await neynarFetch(`user/search?q=${username}&limit=5`);
    if (!searchData?.result?.users?.length) {
      return NextResponse.json({ message: `User "${username}" not found` }, { status: 404 });
    }

    // Find exact match
    const mainUser = searchData.result.users.find(
      (u: NeynarUser) => u.username.toLowerCase() === username
    ) || searchData.result.users[0];

    const fid = mainUser.fid;
    console.log(`Found user: ${mainUser.username} (FID: ${fid})`);

    // 2. Collect interactions
    const interactions = new Map<number, InteractionScore>();

    const addInteraction = (user: NeynarUser, weight: number) => {
      if (!user || user.fid === fid || !user.pfp_url) return;
      
      const existing = interactions.get(user.fid);
      if (existing) {
        existing.score += weight;
      } else {
        interactions.set(user.fid, { user, score: weight });
      }
    };

    // 3. Get followers (structure: users[].user)
    try {
      const followersData = await neynarFetch(`followers?fid=${fid}&limit=100`);
      console.log(`Followers response:`, followersData?.users?.length || 0);
      
      if (followersData?.users) {
        for (const item of followersData.users) {
          // Data is nested under item.user
          const user = item.user || item;
          if (user?.fid && user?.username) {
            addInteraction(user, 1);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching followers:', e);
    }

    // 4. Get following (structure: users[].user)
    try {
      const followingData = await neynarFetch(`following?fid=${fid}&limit=100`);
      console.log(`Following response:`, followingData?.users?.length || 0);
      
      if (followingData?.users) {
        for (const item of followingData.users) {
          const user = item.user || item;
          if (user?.fid && user?.username) {
            // Mutual = higher score
            if (interactions.has(user.fid)) {
              const existing = interactions.get(user.fid)!;
              existing.score += 3; // Mutual bonus
            } else {
              addInteraction(user, 2);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error fetching following:', e);
    }

    // 5. Sort by score
    const sorted = Array.from(interactions.values())
      .sort((a, b) => b.score - a.score)
      .filter(i => i.user.pfp_url);

    console.log(`Total users: ${sorted.length}, Top score: ${sorted[0]?.score || 0}`);

    const formatUser = (i: InteractionScore) => ({
      pfp_url: i.user.pfp_url,
      username: i.user.username,
      display_name: i.user.display_name || i.user.username,
      score: i.score,
    });

    // 3 circles
    const response = {
      mainUser: {
        pfp_url: mainUser.pfp_url,
        username: mainUser.username,
        display_name: mainUser.display_name || mainUser.username,
      },
      innerCircle: sorted.slice(0, 5).map(formatUser),
      middleCircle: sorted.slice(5, 12).map(formatUser),
      outerCircle: sorted.slice(12, 20).map(formatUser),
      stats: {
        totalInteractions: sorted.length,
        topScore: sorted[0]?.score || 0,
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
