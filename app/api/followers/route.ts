import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { fname } = await request.json();

  if (!fname) {
    return NextResponse.json({ message: 'Farcaster username is required' }, { status: 400 });
  }

  try {
    // Mock data while Neynar API issues are resolved
    console.log('Using mock data for user:', fname);
    
    const response = {
      mainUser: {
        pfp_url: "https://picsum.photos/200/200?random=main",
        username: fname,
        display_name: fname.charAt(0).toUpperCase() + fname.slice(1),
      },
      innerCircle: [
        {
          pfp_url: "https://picsum.photos/200/200?random=1",
          username: "vitalik",
          display_name: "Vitalik Buterin",
        },
        {
          pfp_url: "https://picsum.photos/200/200?random=2", 
          username: "dwr",
          display_name: "Dan Romero",
        },
        {
          pfp_url: "https://picsum.photos/200/200?random=3",
          username: "jesse",
          display_name: "Jesse Pollak",
        },
        {
          pfp_url: "https://picsum.photos/200/200?random=4",
          username: "varunsrin",
          display_name: "Varun Srinivasan", 
        },
        {
          pfp_url: "https://picsum.photos/200/200?random=5",
          username: "linda",
          display_name: "Linda Xie",
        },
        {
          pfp_url: "https://picsum.photos/200/200?random=6",
          username: "balajis", 
          display_name: "Balaji Srinivasan",
        },
        {
          pfp_url: "https://picsum.photos/200/200?random=7",
          username: "seneca",
          display_name: "Seneca",
        },
        {
          pfp_url: "https://picsum.photos/200/200?random=8",
          username: "pfista",
          display_name: "Paul Frazee",
        }
      ],
      outerCircle: [
        {
          pfp_url: "https://picsum.photos/200/200?random=9",
          username: "cassie",
          display_name: "Cassie Heart",
        },
        {
          pfp_url: "https://picsum.photos/200/200?random=10",
          username: "coopahtroopa",
          display_name: "Cooper Turley",
        },
        {
          pfp_url: "https://picsum.photos/200/200?random=11",
          username: "rish",
          display_name: "Rish",
        },
        {
          pfp_url: "https://picsum.photos/200/200?random=12",
          username: "krishna",
          display_name: "Krishna Sriram",
        },
        {
          pfp_url: "https://picsum.photos/200/200?random=13",
          username: "alvesjtiago",
          display_name: "Tiago Alves",
        },
        {
          pfp_url: "https://picsum.photos/200/200?random=14", 
          username: "ace",
          display_name: "Ace",
        },
        {
          pfp_url: "https://picsum.photos/200/200?random=15",
          username: "farcasterxyz",
          display_name: "Farcaster",
        },
        {
          pfp_url: "https://picsum.photos/200/200?random=16",
          username: "warpcast",
          display_name: "Warpcast",
        },
        {
          pfp_url: "https://picsum.photos/200/200?random=17",
          username: "alexmasmej", 
          display_name: "Alex Masmej",
        },
        {
          pfp_url: "https://picsum.photos/200/200?random=18",
          username: "raj",
          display_name: "Raj Gokal",
        },
        {
          pfp_url: "https://picsum.photos/200/200?random=19",
          username: "grin",
          display_name: "Michael Grin",
        },
        {
          pfp_url: "https://picsum.photos/200/200?random=20",
          username: "zachterrell",
          display_name: "Zach Terrell",
        }
      ]
    };
    
    return NextResponse.json(response);

  } catch (error: unknown) {
    console.error('Route error:', error);
    if (error instanceof Error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'An internal server error occurred' }, { status: 500 });
  }
}