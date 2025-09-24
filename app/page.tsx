// app/page.tsx - Complete fixed version
'use client';

import { useState, useRef } from 'react';
import { createPublicClient, createWalletClient, http, custom, parseAbi } from 'viem';
import { baseSepolia } from 'viem/chains';
import { toPng } from 'html-to-image';
import Image from 'next/image';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: string[] }) => Promise<string[]>;
      isMetaMask?: boolean;
    };
  }
}

interface User {
  pfp_url: string;
  username: string;
  display_name: string;
}

interface ApiResponse {
  mainUser: User;
  innerCircle: User[];
  outerCircle: User[];
}

export default function HomePage() {
  const [fname, setFname] = useState('');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [mintSuccess, setMintSuccess] = useState<string | null>(null);

  const circleRef = useRef<HTMLDivElement>(null);

  // Your deployed contract address
  const contractAddress = '0xD7c7d560De9C40E0bADfC68B8a9F9A9e1F31F67E';
  
  const contractAbi = parseAbi([
    'function mintCircle(string memory uri) external'
  ]);

  const generateCircle = async () => {
    if (!fname.trim()) {
      setError('Please enter a Farcaster username');
      return;
    }

    setIsLoading(true);
    setError(null);
    setData(null);
    setMintSuccess(null);

    try {
      const response = await fetch('/api/followers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fname: fname.replace('@', '') }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch user data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      }) as string[];

      return createWalletClient({
        account: accounts[0] as `0x${string}`,
        chain: baseSepolia,
        transport: custom(window.ethereum)
      });
    } catch {
      throw new Error('Failed to connect wallet');
    }
  };

  const mintCircle = async () => {
    if (!data || !circleRef.current) {
      setError('Please generate a circle first');
      return;
    }

    if (!contractAddress || contractAddress.length !== 42) {
      setError('Contract address not configured');
      return;
    }

    setIsMinting(true);
    setError(null);

    try {
      // Connect wallet
      const walletClient = await connectWallet();
      const [address] = await walletClient.getAddresses();

      // For now, use a simple placeholder metadata URL to test minting
      // We'll add the image upload later once basic minting works
      const placeholderMetadata = `data:application/json;base64,${btoa(JSON.stringify({
        name: `Farcaster Circle - ${data.mainUser.display_name}`,
        description: `A social circle visualization for ${data.mainUser.username}`,
        image: "https://via.placeholder.com/400x400/6366f1/ffffff?text=Farcaster+Circle",
        attributes: [
          { trait_type: 'Username', value: data.mainUser.username },
          { trait_type: 'Inner Circle Count', value: data.innerCircle.length },
          { trait_type: 'Outer Circle Count', value: data.outerCircle.length },
        ],
      }))}`;

      // Mint NFT with placeholder metadata
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

      const { request } = await publicClient.simulateContract({
        address: contractAddress as `0x${string}`,
        abi: contractAbi,
        functionName: 'mintCircle',
        args: [placeholderMetadata],
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      setMintSuccess(hash);
      
    } catch (err) {
      console.error('Minting error:', err);
      setError(err instanceof Error ? err.message : 'Minting failed');
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Farcaster Circles
          </h1>
          <p className="text-lg text-gray-300 mb-2">
            Visualize your social circles and mint them as NFTs
          </p>
          <p className="text-sm text-yellow-400">Running on Base Sepolia Testnet</p>
        </div>

        <div className="flex flex-col items-center gap-8">
          {/* Centered Controls */}
          <div className="w-full max-w-md space-y-4">
            <input
              type="text"
              value={fname}
              onChange={(e) => setFname(e.target.value)}
              placeholder="Enter username (e.g., dwr)"
              className="px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 w-full focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
            <button
              onClick={generateCircle}
              disabled={isLoading}
              className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-cyan-600 hover:to-blue-600 transition-all"
            >
              {isLoading ? 'Generating...' : 'Generate Circles'}
            </button>
          </div>

          {isLoading && (
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-400"></div>
          )}
          
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg max-w-md">
              <p className="font-semibold">Error:</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {mintSuccess && (
            <div className="bg-green-900/50 border border-green-700 text-green-300 px-4 py-3 rounded-lg max-w-md">
              <p className="font-bold text-lg mb-2">NFT Minted Successfully!</p>
              <a
                href={`https://sepolia.basescan.org/tx/${mintSuccess}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 underline hover:text-cyan-300 text-sm"
              >
                View on Basescan
              </a>
            </div>
          )}

          {/* Centered Visualization */}
          {data && (
            <div className="flex flex-col items-center">
              <div
                ref={circleRef}
                className="p-6 bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-2xl border border-white/20 mb-6"
              >
                <CircleVisualization data={data} />
              </div>
              
              {!mintSuccess && (
                <button
                  onClick={mintCircle}
                  disabled={isMinting}
                  className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-600 hover:to-pink-600 transition-all"
                >
                  {isMinting ? 'Minting...' : 'Mint Your Circles NFT'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const CircleVisualization = ({ data }: { data: ApiResponse }) => {
  const centerSize = 60;
  const innerSize = 40;
  const outerSize = 30;
  const canvasSize = 400;

  return (
    <div className="relative" style={{ width: canvasSize, height: canvasSize }}>
      {/* Center user */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
        <img
          src={data.mainUser.pfp_url}
          alt={data.mainUser.display_name}
          width={centerSize}
          height={centerSize}
          className="rounded-full border-4 border-cyan-400 shadow-lg shadow-cyan-400/50"
          onError={(e) => {
            e.currentTarget.src = `https://ui-avatars.com/api/?name=${data.mainUser.username}&size=${centerSize}&background=6366f1&color=ffffff`;
          }}
        />
      </div>

      {/* Inner circle */}
      {data.innerCircle.map((user, index) => {
        const angle = (index / data.innerCircle.length) * 2 * Math.PI;
        const radius = 130;
        const x = radius * Math.cos(angle) + canvasSize / 2;
        const y = radius * Math.sin(angle) + canvasSize / 2;

        return (
          <div
            key={user.username}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
            style={{ left: x, top: y }}
          >
            <img
              src={user.pfp_url}
              alt={user.username}
              width={innerSize}
              height={innerSize}
              className="rounded-full border-2 border-purple-400 shadow-lg"
              onError={(e) => {
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${user.username}&size=${innerSize}&background=a855f7&color=ffffff`;
              }}
            />
          </div>
        );
      })}

      {/* Outer circle */}
      {data.outerCircle.map((user, index) => {
        const angle = (index / data.outerCircle.length) * 2 * Math.PI;
        const radius = 200;
        const x = radius * Math.cos(angle) + canvasSize / 2;
        const y = radius * Math.sin(angle) + canvasSize / 2;

        return (
          <div
            key={user.username}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: x, top: y }}
          >
            <img
              src={user.pfp_url}
              alt={user.username}
              width={outerSize}
              height={outerSize}
              className="rounded-full border-2 border-gray-400 shadow-md"
              onError={(e) => {
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${user.username}&size=${outerSize}&background=6b7280&color=ffffff`;
              }}
            />
          </div>
        );
      })}
    </div>
  );
};