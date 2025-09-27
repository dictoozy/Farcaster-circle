// app/api/followers/route.ts - Focus on actual interactions
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

interface NeynarCast {
  author: NeynarUser;
  reactions: {
    likes: Array<{
      fid: number;
      fname: string;
    }>;
    recasts: Array<{
      fid: number;
      fname: string;
    }>;
  };
  replies: {
    count: number;
  };
}

interface NeynarCastsResponse {
  casts: NeynarCast[];
  next?: {
    cursor?: string;
  };
}

interface NeynarNotificationsResponse {
  notifications: Array<{
    type: string;
    actor: NeynarUser;
  }>;
}

export async function POST(request: Request) {
  const { fname: username } = await request.json();
  
  if (!username) {
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

  try {
    console.log('Looking up user:', username);

    // Step 1: Get user by username
    const userResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/user/by-username?username=${username}`,
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
        { message: `User "${username}" not found on Farcaster` },
        { status: 404 }
      );
    }

    const userData: NeynarUserResponse = await userResponse.json();
    console.log('User found:', userData.user.username, 'FID:', userData.user.fid);

    // Step 2: Get user's recent casts to see who interacts with them
    const interactionUsers = new Map<number, NeynarUser>();

    try {
      console.log('Fetching user casts for interactions...');
      const castsResponse = await fetch(
        `https://api.neynar.com/v2/farcaster/casts?fid=${userData.user.fid}&limit=25`,
        {
          headers: {
            'Accept': 'application/json',
            'api_key': NEYNAR_API_KEY,
          },
        }
      );

      if (castsResponse.ok) {
        const castsData: NeynarCastsResponse = await castsResponse.json();
        console.log(`Found ${castsData.casts?.length || 0} casts`);

        // Extract users who liked or recast their posts
        castsData.casts?.forEach((cast) => {
          // Add users who liked this cast
          cast.reactions?.likes?.forEach((like) => {
            if (like.fid !== userData.user.fid) { // Don't include self
              // We need to fetch user details for these FIDs
              // For now, create a placeholder
              interactionUsers.set(like.fid, {
                fid: like.fid,
                username: like.fname || `user${like.fid}`,
                display_name: like.fname || `User ${like.fid}`,
                pfp_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(like.fname || like.fid.toString())}&size=100&background=random`
              });
            }
          });

          // Add users who recast this cast
          cast.reactions?.recasts?.forEach((recast) => {
            if (recast.fid !== userData.user.fid) {
              interactionUsers.set(recast.fid, {
                fid: recast.fid,
                username: recast.fname || `user${recast.fid}`,
                display_name: recast.fname || `User ${recast.fid}`,
                pfp_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(recast.fname || recast.fid.toString())}&size=100&background=random`
              });
            }
          });
        });
      }
    } catch (error) {
      console.error('Error fetching casts:', error);
    }

    // Step 3: Get notifications to see who mentions/replies to them
    try {
      console.log('Fetching notifications for more interactions...');
      const notificationsResponse = await fetch(
        `https://api.neynar.com/v2/farcaster/notifications?fid=${userData.user.fid}&type=mentions&limit=25`,
        {
          headers: {
            'Accept': 'application/json',
            'api_key': NEYNAR_API_KEY,
          },
        }
      );

      if (notificationsResponse.ok) {
        const notificationsData: NeynarNotificationsResponse = await notificationsResponse.json();
        console.log(`Found ${notificationsData.notifications?.length || 0} notifications`);

        // Add users who mentioned them
        notificationsData.notifications?.forEach((notification) => {
          if (notification.actor && notification.actor.fid !== userData.user.fid) {
            interactionUsers.set(notification.actor.fid, {
              fid: notification.actor.fid,
              username: notification.actor.username,
              display_name: notification.actor.display_name || notification.actor.username,
              pfp_url: notification.actor.pfp_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(notification.actor.username)}&size=100&background=random`
            });
          }
        });
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }

    // Step 4: If we don't have enough interaction data, supplement with some followers
    if (interactionUsers.size < 20) {
      console.log('Not enough interaction data, supplementing with followers...');
      try {
        const followersResponse = await fetch(
          `https://api.neynar.com/v2/farcaster/followers?fid=${userData.user.fid}&limit=${25 - interactionUsers.size}`,
          {
            headers: {
              'Accept': 'application/json',
              'api_key': NEYNAR_API_KEY,
            },
          }
        );

        if (followersResponse.ok) {
          const followersData = await followersResponse.json();
          followersData.users?.forEach((follower: NeynarUser) => {
            if (!interactionUsers.has(follower.fid)) {
              interactionUsers.set(follower.fid, {
                fid: follower.fid,
                username: follower.username,
                display_name: follower.display_name || follower.username,
                pfp_url: follower.pfp_url || `https://ui-avatars.com/api/?name=${follower.username}&size=100&background=random`
              });
            }
          });
        }
      } catch (error) {
        console.error('Error fetching followers as fallback:', error);
      }
    }

    // Step 5: Convert to array and shuffle for randomization
    const allInteractionUsers = Array.from(interactionUsers.values());
    const shuffledUsers = allInteractionUsers.sort(() => Math.random() - 0.5);

    console.log(`Found ${shuffledUsers.length} interaction users`);

    // Step 6: Create response with proper user data
    const processedUsers = shuffledUsers.map((user) => ({
      pfp_url: user.pfp_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&size=100&background=6366f1&color=ffffff`,
      username: user.username,
      display_name: user.display_name || user.username,
    }));

    const response = {
      mainUser: {
        pfp_url: userData.user.pfp_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.user.username)}&size=100&background=6366f1&color=ffffff`,
        username: userData.user.username,
        display_name: userData.user.display_name || userData.user.username,
      },
      innerCircle: processedUsers.slice(0, 8),
      outerCircle: processedUsers.slice(8, 20),
      stats: {
        totalInteractions: shuffledUsers.length,
        method: shuffledUsers.length > 0 ? 'interactions' : 'fallback'
      }
    };

    console.log('Response created:', {
      innerCircle: response.innerCircle.length,
      outerCircle: response.outerCircle.length,
      totalInteractions: response.stats.totalInteractions
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('API Error:', error);
    
    // Ultimate fallback with popular Farcaster users
    const fallbackUsers = [
      { username: 'dwr', display_name: 'Dan Romero', pfp_url: 'https://ui-avatars.com/api/?name=Dan&size=100&background=6366f1&color=ffffff' },
      { username: 'vitalik', display_name: 'Vitalik Buterin', pfp_url: 'https://ui-avatars.com/api/?name=Vitalik&size=100&background=a855f7&color=ffffff' },
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

    return NextResponse.json({
      mainUser: {
        pfp_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(username || 'User')}&size=100&background=6366f1&color=ffffff`,
        username: username || 'user',
        display_name: username ? username.charAt(0).toUpperCase() + username.slice(1) : 'User',
      },
      innerCircle: fallbackUsers.slice(0, 8),
      outerCircle: fallbackUsers.slice(8, 20),
      stats: {
        totalInteractions: 0,
        method: 'fallback'
      }
    });
  }
}