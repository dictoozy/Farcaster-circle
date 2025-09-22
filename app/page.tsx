// File: app/page.tsx
"use client";

import { useState, useRef, useEffect } from 'react';

// This is a placeholder for your visualization component.
// Make sure you have a component that can accept the user data.
const CircleVisualization = ({ data }: { data: any[] }) => {
  if (!data || data.length === 0) return null;
  return (
    <div className="p-4 border rounded-lg bg-gray-800">
      <h3 className="text-white mb-2">{data.length} Connections Found</h3>
      <div className="flex flex-wrap gap-2">
        {data.map((user) => (
          <img 
            key={user.fid} 
            src={user.pfp_url} 
            alt={user.username} 
            className="w-12 h-12 rounded-full border-2 border-purple-400"
            onError={(e) => { e.currentTarget.src = 'https://i.imgur.com/7bE4g7A.png'; }} // Fallback image
          />
        ))}
      </div>
    </div>
  );
};

// Main Page Component
export default function HomePage() {
  // === STATE MANAGEMENT ===
  const [fname, setFname] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any[] | null>(null);
  const [isMinting, setIsMinting] = useState<boolean>(false);
  const [mintSuccessTx, setMintSuccessTx] = useState<string | null>(null);

  // === CONFIGURATION ===
  // ❗️ PASTE YOUR CONTRACT ADDRESS HERE
  const contractAddress = 'Y0xD7c7d560De9C40E0bADfC68B8a9F9A9e1F31F67E';

  // === FUNCTIONS ===

  /**
   * Fetches user data from our API route.
   */
  const generateCircle = async () => {
    // Clear previous state
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

      const fetchedData = await response.json();
      if (fetchedData.length === 0) {
        setError('No followers found for this user.');
      }
      setData(fetchedData);

    } catch (err: any) {
      console.error("Failed to generate circle:", err);
      setError(err.message);

    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles the minting logic.
   */
  const handleMint = async () => {
    // This is our debug line to check the environment variable
    console.log("Attempting to mint. Token found:", process.env.NEXT_PUBLIC_WEB3_STORAGE_TOKEN);

    if (!data) {
        setError("Please generate a circle first before minting.");
        return;
    }
    
    // Check for the Web3 Storage Token
    if (!process.env.NEXT_PUBLIC_WEB3_STORAGE_TOKEN) {
        setError("Web3.Storage API token is not configured.");
        return;
    }
   
    setIsMinting(true);
    setError(null);
    setMintSuccessTx(null);

    try {
        // --- YOUR MINTING LOGIC GOES HERE ---
        // This is where you would:
        // 1. Connect to the user's wallet.
        // 2. Generate an image of the circle visualization.
        // 3. Upload the image to Web3.Storage.
        // 4. Call your smart contract's mint function with the image URI.
        
        console.log("Minting logic would start now...");
        // As a placeholder, we'll just simulate a successful mint after 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));
        setMintSuccessTx('0x123abc...placeholder_tx_hash');


    } catch (err: any) {
        console.error("Failed to mint:", err);
        setError(err.message || "An unknown error occurred during minting.");
    } finally {
        setIsMinting(false);
    }
  };

  // === JSX RENDER ===
  return (
    <div className="w-full min-h-screen bg-gray-900 text-white flex flex-col items-center p-4">
      <div className="w-full max-w-2xl mx-auto">
        
        {/* Header */}
        <header className="text-center my-8">
          <h1 className="text-5xl font-bold text-purple-400">Farcaster Circle</h1>
          <p className="text-gray-400 mt-2">Visualize your social circles and mint them onchain.</p>
          <p className="text-sm text-yellow-500 mt-1">Currently running on Base Sepolia testnet</p>
        </header>

        {/* Input and Generate Button */}
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

        {/* Display Area for Error, Loading, or Visualization */}
        <div className="w-full min-h-[300px] flex items-center justify-center">
          {error && <div className="bg-red-900 border border-red-700 text-red-300 p-4 rounded-lg">{error}</div>}
          {isLoading && !error && <div>Loading...</div>}
          {!isLoading && !error && data && <CircleVisualization data={data} />}
        </div>
        
        {/* Mint Button and Success Message */}
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
            <div className="mt-4 text-center p-3 bg-green-900 border border-green-700 rounded-lg">
                <p className="text-green-300">Mint successful! Transaction: {mintSuccessTx}</p>
            </div>
        )}

      </div>
    </div>
  );
}