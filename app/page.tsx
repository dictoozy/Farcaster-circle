"use client";

import { useState } from 'react';
import Image from 'next/image';

// TypeScript interface for a Farcaster User object
interface FarcasterUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
}

// A component to display the user circles
const CircleVisualization = ({ data }: { data: FarcasterUser[] }) => {
  if (!data || data.length === 0) return null;
  return (
    <div className="p-4 border rounded-lg bg-gray-800/50">
      <h3 className="text-white mb-3 text-center">{data.length} Connections Found</h3>
      <div className="flex flex-wrap gap-2 justify-center">
        {data.map((user) => (
          <Image 
            key={user.fid} 
            src={user.pfp_url} 
            alt={user.username} 
            className="rounded-full border-2 border-purple-400"
            title={user.display_name}
            width={48}
            height={48}
            onError={(e) => { 
              const target = e.target as HTMLImageElement;
              target.src = 'https://i.imgur.com/7bE4g7A.png'; 
            }}
          />
        ))}
      </div>
    </div>
  );
};

// Main Page Component
export default function HomePage() {
  const [fname, setFname] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FarcasterUser[] | null>(null);
  const [isMinting, setIsMinting] = useState<boolean>(false);
  const [mintSuccessTx, setMintSuccessTx] = useState<string | null>(null);

  const contractAddress = 'YOUR_CONTRACT_ADDRESS_HERE';

  const generateCircle = async () => {
    setError(null);
    setData(null);
    setMintSuccessTx(null);

    if (!fname.trim()) {
      setError('Please enter a Farcaster username.');
      return;
    }

    setIsLoading(true);
    const sanitizedFname = fname.startsWith('@') ? fname.substring(1) : fname;

    try {
      const response = await fetch(`/api/user?username=${sanitizedFname}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error: ${response.status}`);
      }

      const fetchedData: FarcasterUser[] = await response.json();
      if (fetchedData.length === 0) {
        setError('No followers found for this user, or user does not exist.');
      }
      setData(fetchedData);

    } catch (err: any) { // This `any` is where the error comes from
      console.error("Failed to generate circle:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMint = async () => {
    console.log("Attempting to mint. Token found:", process.env.NEXT_PUBLIC_WEB3_STORAGE_TOKEN);

    if (!data) {
        setError("Please generate a circle first before minting.");
        return;
    }
    
    if (!process.env.NEXT_PUBLIC_WEB3_STORAGE_TOKEN) {
        setError("Web3.Storage API token is not configured in your .env.local file.");
        return;
    }
    
    if (!contractAddress || contractAddress === 'YOUR_CONTRACT_ADDRESS_HERE') {
        setError("Contract address is not configured in page.tsx.");
        return;
    }

    setIsMinting(true);
    setError(null);
    setMintSuccessTx(null);

    try {
      console.log("Simulating mint process...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      setMintSuccessTx('0x123abc...placeholder_transaction_hash');

    } catch (err: any) { // This `any` is the other source of the error
        console.error("Failed to mint:", err);
        setError(err.message || "An unknown error occurred during minting.");
    } finally {
        setIsMinting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-900 text-white flex flex-col items-center p-4">
      <div className="w-full max-w-2xl mx-auto">
        
        <header className="text-center my-8">
          <h1 className="text-5xl font-bold text-purple-400">Farcaster Circle</h1>
          <p className="text-gray-400 mt-2">Visualize your social circles and mint them onchain.</p>
          <p className="text-sm text-yellow-500 mt-1">Currently running on Base Sepolia testnet</p>
        </header>

        <div className="flex flex-col sm:flex-row gap-2 justify-center mb-6">
          <input
            type="text"
            value={fname}
            onChange={(e) => setFname(e.target.value)}
            placeholder="Enter Farcaster username (e.g., dwr)"
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white w-full sm:w-auto flex-grow"
          />
          <button
            onClick={generateCircle}
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed rounded-lg px-6 py-3 font-bold transition-colors"
          >
            {isLoading ? 'Generating...' : 'Generate Circles'}
          </button>
        </div>

        <div className="w-full min-h-[300px] flex items-center justify-center">
          {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">{error}</div>}
          {isLoading && !error && <div>Loading...</div>}
          {!isLoading && !error && data && <CircleVisualization data={data} />}
        </div>
        
        {data && !isLoading && !error && (
            <div className="text-center mt-6">
                <button
                    onClick={handleMint}
                    disabled={isMinting}
                    className="bg-pink-600 hover:bg-pink-700 disabled:bg-pink-900 disabled:cursor-not-allowed rounded-lg px-8 py-4 font-bold text-xl transition-colors"
                >
                    {isMinting ? 'Minting...' : 'Mint Your Circles (Testnet)'}
                </button>
            </div>
        )}

        {mintSuccessTx && (
            <div className="mt-4 text-center p-3 bg-green-900/50 border border-green-700 rounded-lg">
                <p className="text-green-300">Mint successful! Tx: {mintSuccessTx}</p>
            </div>
        )}

      </div>
    </div>
  );
}