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

  // Replace with your actual deployed contract address
  const contractAddress = '0xYOUR_DEPLOYED_CONTRACT_ADDRESS';
  
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

    if (contractAddress === '0xYOUR_DEPLOYED_CONTRACT_ADDRESS') {
      setError('Contract address not configured');
      return;
    }

    setIsMinting(true);
    setError(null);

    try {
      // Connect wallet
      const walletClient = await connectWallet();
      const [address] = await walletClient.getAddresses();

      // Capture image
      const imageDataUrl = await toPng(circleRef.current, {
        backgroundColor: '#111827',
        width: 600,
        height: 600,
      });

      // Convert to blob for upload
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();

      // Upload to IPFS
      const formData = new FormData();
      formData.append('file', blob, `${data.mainUser.username}-circle.png`);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      const { ipfsUrl } = await uploadResponse.json();

      // Create metadata
      const metadata = {
        name: `Farcaster Circle - ${data.mainUser.display_name}`,
        description: `A social circle visualization for ${data.mainUser.username}`,
        image: ipfsUrl,
        attributes: [
          { trait_type: 'Username', value: data.mainUser.username },
          { trait_type: 'Inner Circle Count', value: data.innerCircle.length },
          { trait_type: 'Outer Circle Count', value: data.outerCircle.length },
        ],
      };

      // Upload metadata
      const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
      const metadataFormData = new FormData();
      metadataFormData.append('file', metadataBlob, 'metadata.json');

      const metadataResponse = await fetch('/api/upload', {
        method: 'POST',
        body: metadataFormData,
      });

      const { ipfsUrl: metadataUrl } = await metadataResponse.json();

      // Mint NFT
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

      const { request } = await publicClient.simulateContract({
        address: contractAddress as `0x${string}`,
        abi: contractAbi,
        functionName: 'mintCircle',
        args: [metadataUrl],
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      setMintSuccess(hash);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Minting failed');
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Farcaster Circles
          </h1>
          <p className="text-xl text-gray-300 mb-2">
            Visualize your social circles and mint them as NFTs
          </p>
          <p className="text-sm text-yellow-400">Running on Base Sepolia Testnet</p>
        </div>

        <div className="flex gap-4 justify-center mb-8">
          <input
            type="text"
            value={fname}
            onChange={(e) => setFname(e.target.value)}
            placeholder="Enter username (e.g., dwr)"
            className="px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 w-64 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
          <button
            onClick={generateCircle}
            disabled={isLoading}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-cyan-600 hover:to-blue-600 transition-all"
          >
            {isLoading ? 'Generating...' : 'Generate Circles'}
          </button>
        </div>

        <div className="flex justify-center mb-8">
          {isLoading && (
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-400"></div>
          )}
          
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 px-6 py-4 rounded-lg">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          )}

          {data && (
            <div className="text-center">
              <div
                ref={circleRef}
                className="inline-block p-8 bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-2xl border border-white/20 mb-6"
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

          {mintSuccess && (
            <div className="bg-green-900/50 border border-green-700 text-green-300 px-6 py-4 rounded-lg text-center">
              <p className="font-bold text-lg mb-2">NFT Minted Successfully!</p>
              <a
                href={`https://sepolia.basescan.org/tx/${mintSuccess}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 underline hover:text-cyan-300"
              >
                View on Basescan
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const CircleVisualization = ({ data }: { data: ApiResponse }) => {
  const centerSize = 80;
  const innerSize = 50;
  const outerSize = 40;
  const canvasSize = 500;

  return (
    <div className="relative" style={{ width: canvasSize, height: canvasSize }}>
      {/* Center user */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
        <Image
          src={data.mainUser.pfp_url}
          alt={data.mainUser.display_name}
          width={centerSize}
          height={centerSize}
          className="rounded-full border-4 border-cyan-400 shadow-lg shadow-cyan-400/50"
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
            <Image
              src={user.pfp_url}
              alt={user.username}
              width={innerSize}
              height={innerSize}
              className="rounded-full border-2 border-purple-400 shadow-lg"
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
            <Image
              src={user.pfp_url}
              alt={user.username}
              width={outerSize}
              height={outerSize}
              className="rounded-full border-2 border-gray-400 shadow-md"
            />
          </div>
        );
      })}
    </div>
  );
};