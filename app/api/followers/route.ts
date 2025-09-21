// app/api/followers/route.ts
import { NextRequest, NextResponse } from 'next/server';

// TypeScript interfaces for Neynar API responses
interface NeynarUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  follower_count: number;
  following_count: number;
}

interface NeynarUserResponse {
  users: NeynarUser[];
}

interface NeynarCast {
  hash: string;
  author: NeynarUser;
  text: string;
  timestamp: string;
}

interface NeynarReactionsResponse {
  reactions: Array<{
    cast: NeynarCast;
    user: NeynarUser;
  }>;
  next?: {
    cursor: string;
  };
}

interface UserInteraction {
  user: NeynarUser;
  count: number;
}

// Response format for frontend
interface ApiUser {
  pfp_url: string;
  username: string;
  display_name: string;
}

interface ApiResponse {
  mainUser: ApiUser;
  innerCircle: ApiUser[];
  outerCircle: ApiUser[];
}

export async function POST(request: NextRequest) {
  try {
    const { fname } = await request.json();

    if (!fname || typeof fname !== 'string') {
      return NextResponse.json(
        { message: 'Username is required' },
        { status: 400 }
      );
    }

    // Get Neynar API key from environment
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { message: 'Neynar API key not configured' },
        { status: 500 }
      );
    }

    // Step 1: Find the user by username to get their FID
    const userResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk-by-username?usernames=${fname}`,
      {
        headers: {
          'Accept': 'application/json',
          'api_key': apiKey,
        },
      }
    );

    if (!userResponse.ok) {
      throw new Error(`Failed to fetch user data: ${userResponse.status}`);
    }

    const userData: NeynarUserResponse = await userResponse.json();
    
    if (!userData.users || userData.users.length === 0) {
      return NextResponse.json(
        { message: `User "${fname}" not found on Farcaster` },
        { status: 404 }
      );
    }

    const mainUser = userData.users[0];

    // Step 2: Get user's recent likes/reactions to find who they interact with
    const reactionsResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/reactions/user?fid=${mainUser.fid}&reaction_type=like&limit=100`,
      {
        headers: {
          'Accept': 'application/json',
          'api_key': apiKey,
        },
      }
    );

    if (!reactionsResponse.ok) {
      throw new Error(`Failed to fetch reactions: ${reactionsResponse.status}`);
    }

    const reactionsData: NeynarReactionsResponse = await reactionsResponse.json();

    // Step 3: Process interactions to find most-interacted-with users
    const interactionCounts = new Map<number, UserInteraction>();

    // Count interactions with each user
    reactionsData.reactions?.forEach((reaction) => {
      const author = reaction.cast.author;
      
      // Skip self-interactions
      if (author.fid === mainUser.fid) return;
      
      if (interactionCounts.has(author.fid)) {
        const existing = interactionCounts.get(author.fid)!;
        existing.count += 1;
      } else {
        interactionCounts.set(author.fid, {
          user: author,
          count: 1
        });
      }
    });

    // Sort by interaction count
    const sortedInteractions = Array.from(interactionCounts.values())
      .sort((a, b) => b.count - a.count);

    // If we don't have enough interactions, try to get following data as fallback
    let fallbackUsers: NeynarUser[] = [];
    if (sortedInteractions.length < 15) {
      try {
        const followingResponse = await fetch(
          `https://api.neynar.com/v2/farcaster/following?fid=${mainUser.fid}&limit=50`,
          {
            headers: {
              'Accept': 'application/json',
              'api_key': apiKey,
            },
          }
        );

        if (followingResponse.ok) {
          const followingData = await followingResponse.json();
          fallbackUsers = followingData.users || [];
        }
      } catch {
        // Ignore errors for fallback data
      }
    }

    // Helper function to convert user format
    const formatUser = (user: NeynarUser): ApiUser => ({
      pfp_url: user.pfp_url || '',
      username: user.username,
      display_name: user.display_name || user.username,
    });

    // Create circles based on interaction strength
    const innerCircle: ApiUser[] = [];
    const outerCircle: ApiUser[] = [];

    // Use interaction data first
    sortedInteractions.forEach((interaction, index) => {
      if (index < 8) {
        innerCircle.push(formatUser(interaction.user));
      } else if (index < 20) {
        outerCircle.push(formatUser(interaction.user));
      }
    });

    // Fill remaining spots with following data if needed
    if (innerCircle.length < 8 && fallbackUsers.length > 0) {
      const remainingInner = 8 - innerCircle.length;
      const existingFids = new Set([
        mainUser.fid,
        ...sortedInteractions.map(i => i.user.fid)
      ]);

      fallbackUsers
        .filter(user => !existingFids.has(user.fid))
        .slice(0, remainingInner)
        .forEach(user => {
          innerCircle.push(formatUser(user));
          existingFids.add(user.fid);
        });
    }

    if (outerCircle.length < 12 && fallbackUsers.length > 0) {
      const remainingOuter = 12 - outerCircle.length;
      const existingFids = new Set([
        mainUser.fid,
        ...sortedInteractions.map(i => i.user.fid),
        ...innerCircle.map(u => u.username) // approximate check
      ]);

      fallbackUsers
        .filter(user => !existingFids.has(user.fid))
        .slice(innerCircle.length, innerCircle.length + remainingOuter)
        .forEach(user => {
          outerCircle.push(formatUser(user));
        });
    }

    // If still no data, create some placeholder circles
    if (innerCircle.length === 0 && outerCircle.length === 0) {
      return NextResponse.json(
        { message: `No social circle data found for "${fname}". This user may have very limited public activity.` },
        { status: 404 }
      );
    }

    const response: ApiResponse = {
      mainUser: formatUser(mainUser),
      innerCircle,
      outerCircle,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('API Error:', error);
    
    return NextResponse.json(
      { 
        message: error instanceof Error 
          ? `Server error: ${error.message}` 
          : 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}