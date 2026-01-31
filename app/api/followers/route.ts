// app/api/followers/route.ts - Proper interaction-based ranking
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
  likes: number;
  recasts: number;
  replies: number;
  mentions: number;
}

async function neynarFetch(endpoint: string) {
  const res = await fetch(`https://api.neynar.com/v2/farcaster/${endpoint}`, {
    headers: {
      'Accept': 'application/json',
      'api_key': NEYNAR_API_KEY!,
    },
    next: { revalidate: 300 }, // Cache for 5 min
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

    if (!fname) {
      return NextResponse.json({ message: 'Username is required' }, { status: 400 });
    }

    if (!NEYNAR_API_KEY) {
      return NextResponse.json({ message: 'API not configured' }, { status: 500 });
    }

    // 1. Get main user
    const userData = await neynarFetch(`user/by-username?username=${fname.replace('@', '')}`);
    if (!userData?.user) {
      return NextResponse.json({ message: `User "${fname}" not found` }, { status: 404 });
    }

    const mainUser = userData.user;
    const fid = mainUser.fid;
    console.log(`Found user: ${mainUser.username} (FID: ${fid})`);

    // 2. Collect interactions with scoring
    const interactions = new Map<number, InteractionScore>();

    const addInteraction = (user: NeynarUser, type: 'like' | 'recast' | 'reply' | 'mention', weight: number) => {
      if (!user || user.fid === fid) return;
      
      const existing = interactions.get(user.fid) || {
        user,
        score: 0,
        likes: 0,
        recasts: 0,
        replies: 0,
        mentions: 0,
      };
      
      existing.score += weight;
      existing[type === 'like' ? 'likes' : type === 'recast' ? 'recasts' : type === 'reply' ? 'replies' : 'mentions']++;
      existing.user = user; // Update with latest user data
      interactions.set(user.fid, existing);
    };

    // 3. Get user's casts and who interacted
    const castsData = await neynarFetch(`feed?feed_type=filter&filter_type=fids&fids=${fid}&limit=50`);
    if (castsData?.casts) {
      for (const cast of castsData.casts) {
        // Likes (weight: 1)
        if (cast.reactions?.likes) {
          for (const like of cast.reactions.likes) {
            if (like.fid && like.fid !== fid) {
              // Fetch user data if not included
              const likeUser = await neynarFetch(`user/bulk?fids=${like.fid}`);
              if (likeUser?.users?.[0]) {
                addInteraction(likeUser.users[0], 'like', 1);
              }
            }
          }
        }
        
        // Recasts (weight: 3)
        if (cast.reactions?.recasts) {
          for (const recast of cast.reactions.recasts) {
            if (recast.fid && recast.fid !== fid) {
              const recastUser = await neynarFetch(`user/bulk?fids=${recast.fid}`);
              if (recastUser?.users?.[0]) {
                addInteraction(recastUser.users[0], 'recast', 3);
              }
            }
          }
        }
        
        // Direct replies (weight: 5)
        if (cast.replies?.count > 0) {
          const repliesData = await neynarFetch(`cast/conversation?identifier=${cast.hash}&type=hash&reply_depth=1&limit=20`);
          if (repliesData?.conversation?.cast?.direct_replies) {
            for (const reply of repliesData.conversation.cast.direct_replies) {
              if (reply.author && reply.author.fid !== fid) {
                addInteraction(reply.author, 'reply', 5);
              }
            }
          }
        }
      }
    }

    // 4. Get mentions of the user
    const mentionsData = await neynarFetch(`mentions-and-replies?fid=${fid}&limit=50`);
    if (mentionsData?.notifications || mentionsData?.casts) {
      const items = mentionsData.notifications || mentionsData.casts || [];
      for (const item of items) {
        const author = item.author || item.cast?.author;
        if (author && author.fid !== fid) {
          addInteraction(author, 'mention', 4);
        }
      }
    }

    // 5. Fallback: get followers if not enough interactions
    if (interactions.size < 15) {
      console.log('Not enough interactions, adding followers...');
      const followersData = await neynarFetch(`followers?fid=${fid}&limit=50`);
      if (followersData?.users) {
        for (const follower of followersData.users) {
          if (!interactions.has(follower.fid)) {
            addInteraction(follower, 'like', 0.5); // Lower weight for followers
          }
        }
      }
    }

    // 6. Sort by score and create 3 circles
    const sorted = Array.from(interactions.values())
      .sort((a, b) => b.score - a.score)
      .filter(i => i.user.pfp_url); // Only users with profile pics

    console.log(`Total interactions: ${sorted.length}, Top score: ${sorted[0]?.score || 0}`);

    const formatUser = (i: InteractionScore) => ({
      pfp_url: i.user.pfp_url,
      username: i.user.username,
      display_name: i.user.display_name || i.user.username,
      score: i.score,
    });

    // 3 circles: inner (top 5), middle (6-12), outer (13-20)
    const response = {
      mainUser: {
        pfp_url: mainUser.pfp_url,
        username: mainUser.username,
        display_name: mainUser.display_name || mainUser.username,
      },
      innerCircle: sorted.slice(0, 5).map(formatUser),      // Closest friends
      middleCircle: sorted.slice(5, 12).map(formatUser),    // Good friends
      outerCircle: sorted.slice(12, 20).map(formatUser),    // Acquaintances
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
