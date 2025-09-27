// app/api/followers/route.ts - Full interaction-based version
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
  next?: {
    cursor?: string;
  };
}

interface NeynarCastsResponse {
  casts: Array<{
    author: NeynarUser;
    reactions: {
      likes_count: number;
      recasts_count: number;
      likes: Array<{
        fid: number;
        user: NeynarUser;
      }>;
      recasts: Array<{
        fid: number;
        user: NeynarUser;
      }>;
    };
    replies: {
      count: number;
    };
  }>;
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
            if (like.fid !== userData.user.fid && like.user) {
              interactionUsers.set(like.fid, like.user);
            }
          });

          // Add users who recast this cast
          cast.reactions?.recasts?.forEach((recast) => {
            if (recast.fid !== userData.user.fid && recast.user) {
              interactionUsers.set(recast.fid, recast.user);
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
            interactionUsers.set(notification.actor.fid, notification.actor);
          }
        });
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }

    // Step 4: If we don't have enough interaction data, supplement with followers
    if (interactionUsers.size < 20) {
      console.log('Not enough interaction data, supplementing with followers...');
      try {
        const followersResponse = await fetch(
          `https://api.neynar.com/v2/farcaster/followers?fid=${userData.user.fid}&limit=${Math.min(25, 25 - interactionUsers.size)}`,
          {
            headers: {
              'Accept': 'application/json',
              'api_key': NEYNAR_API_KEY,
            },
          }
        );

        if (followersResponse.ok) {
          const followersData: NeynarFollowersResponse = await followersResponse.json();
          followersData.users?.forEach((follower) => {
            if (!interactionUsers.has(follower.fid)) {
              interactionUsers.set(follower.fid, follower);
            }
          });
        }
      } catch (error) {
        console.error('Error fetching followers as fallback:', error);
      }
    }

    // Step 5: If still not enough, add curated users
    if (interactionUsers.size < 20) {
      console.log('Still need more users, adding curated list...');
      const curatedUsers = [
        { fid: 3, username: 'dwr', display_name: 'Dan Romero', pfp_url: 'https://ui-avatars.com/api/?name=Dan&size=100&background=6366f1&color=ffffff' },
        { fid: 5650, username: 'vitalik', display_name: 'Vitalik Buterin', pfp_url: 'https://ui-avatars.com/api/?name=Vitalik&size=100&background=a855f7&color=ffffff' },
        { fid: 20396, username: 'jessepollak', display_name: 'Jesse Pollak', pfp_url: 'https://ui-avatars.com/api/?name=Jesse&size=100&background=ec4899&color=ffffff' },
        { fid: 143, username: 'linda', display_name: 'Linda Xie', pfp_url: 'https://ui-avatars.com/api/?name=Linda&size=100&background=f59e0b&color=ffffff' },
        { fid: 150, username: 'coopahtroopa', display_name: 'Cooper Turley', pfp_url: 'https://ui-avatars.com/api/?name=Cooper&size=100&background=10b981&color=ffffff' },
        { fid: 2, username: 'varunsrin', display_name: 'Varun Srinivasan', pfp_url: 'https://ui-avatars.com/api/?name=Varun&size=100&background=3b82f6&color=ffffff' },
      ];

      curatedUsers.forEach((user) => {
        if (interactionUsers.size < 20 && !interactionUsers.has(user.fid)) {
          interactionUsers.set(user.fid, user as NeynarUser);
        }
      });
    }

    // Step 6: Convert to array and shuffle for randomization
    const allInteractionUsers = Array.from(interactionUsers.values());
    const shuffledUsers = allInteractionUsers.sort(() => Math.random() - 0.5);

    console.log(`Found ${shuffledUsers.length} total users for circles`);

    // Step 7: Create response with proper user data
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
      totalUsers: response.stats.totalInteractions
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}