// app/api/followers/route.ts - Fixed for new Neynar API
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

    // 1. Search for user (new API endpoint)
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

    // 3. Get user's feed (their casts)
    try {
      const feedData = await neynarFetch(`feed/user/${fid}/replies_and_recasts?limit=50`);
      console.log(`Feed data: ${feedData?.casts?.length || 0} casts`);
      
      // Get reactions on their casts
      if (feedData?.casts) {
        for (const cast of feedData.casts.slice(0, 20)) {
          // Get detailed cast with reactions
          const castData = await neynarFetch(`cast?identifier=${cast.hash}&type=hash`);
          if (castData?.cast?.reactions) {
            // Likes
            for (const like of castData.cast.reactions.likes || []) {
              if (like.fid !== fid) {
                const userData = await neynarFetch(`user/bulk?fids=${like.fid}`);
                if (userData?.users?.[0]) {
                  addInteraction(userData.users[0], 1);
                }
              }
            }
            // Recasts
            for (const recast of castData.cast.reactions.recasts || []) {
              if (recast.fid !== fid) {
                const userData = await neynarFetch(`user/bulk?fids=${recast.fid}`);
                if (userData?.users?.[0]) {
                  addInteraction(userData.users[0], 3);
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Error fetching feed:', e);
    }

    // 4. Get followers as fallback/supplement
    try {
      const followersData = await neynarFetch(`followers?fid=${fid}&limit=100`);
      console.log(`Followers: ${followersData?.users?.length || 0}`);
      
      if (followersData?.users) {
        for (const follower of followersData.users) {
          addInteraction(follower, 0.5);
        }
      }
    } catch (e) {
      console.error('Error fetching followers:', e);
    }

    // 5. Get following
    try {
      const followingData = await neynarFetch(`following?fid=${fid}&limit=100`);
      console.log(`Following: ${followingData?.users?.length || 0}`);
      
      if (followingData?.users) {
        for (const following of followingData.users) {
          // Mutual follow = higher score
          if (interactions.has(following.fid)) {
            const existing = interactions.get(following.fid)!;
            existing.score += 2; // Bonus for mutual
          } else {
            addInteraction(following, 1);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching following:', e);
    }

    // 6. Sort by score
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
