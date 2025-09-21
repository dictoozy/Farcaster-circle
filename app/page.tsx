// FINAL, VERCEL-READY VERSION: Fixes all syntax and linting errors.
'use-client';

import { useState, useRef } from 'react';
import { createPublicClient, createWalletClient, http, custom, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { Web3Storage } from 'web3.storage';
import { toPng } from 'html-to-image';
import Image from 'next/image';

declare global {
  interface Window {
    // This satisfies Vercel's strict type checker
    ethereum?: {
        request: (args: { method: string; }) => Promise<`0x${string}`[]>;
    };
  }
}

// --- Type Definitions for API data ---
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

// --- Main App Component ---
export default function HomePage() {
  const [fname, setFname] = useState('');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isMinting, setIsMinting] = useState(false);
  const [mintSuccessTx, setMintSuccessTx] = useState<string | null>(null);

  const circleRef = useRef<HTMLDivElement>(null);

  // CRITICAL: Remember to paste your deployed testnet contract address here
  const contractAddress = 'YOUR_DEPLOYED_CONTRACT_ADDRESS_HERE'; 
  
  const contractAbi = parseAbi([
      'function mint(string memory uri) external'
  ]);

  const generateCircle = async () => {
    if (!fname.trim()) {
      setError('Please enter a Farcaster username.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setData(null);
    setMintSuccessTx(null);

    const sanitizedFname = fname.startsWith('@') ? fname.substring(1) : fname;

    try {
      const response = await fetch('/api/followers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fname: sanitizedFname }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Something went wrong.');
      }

      const result: ApiResponse = await response.json();
      setData(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' });
            return createWalletClient({
                account: address as `0x${string}`,
                chain: base,
                transport: custom(window.ethereum)
            });
        } catch (_err) { // Error is intentionally unused
            setError("Failed to connect wallet. Please try again.");
            return null;
        }
    } else {
        setError("MetaMask is not installed. Please install it to continue.");
        return null;
    }
  };

  const handleMint = async () => {
    if (!data || !circleRef.current) {
        setError("Please generate a circle first.");
        return;
    }
     if (!process.env.NEXT_PUBLIC_WEB3_STORAGE_TOKEN) {
        setError("Web3.Storage API token is not configured.");
        return;
    }

    setIsMinting(true);
    setError(null);
    setMintSuccessTx(null);

    try {
        const walletClient = await connectWallet();
        if (!walletClient) {
          setIsMinting(false);
          return;
        };
        const [address] = await walletClient.getAddresses();

        const imageBlob = await toPng(circleRef.current, { cacheBust: true, backgroundColor: '#111827' });

        const storage = new Web3Storage({ token: process.env.NEXT_PUBLIC_WEB3_STORAGE_TOKEN });
        const imageName = `${data.mainUser.username}-circle.png`;
        const imageFile = new File([imageBlob], imageName, { type: 'image/png' });
        const imageCid = await storage.put([imageFile], { name: imageName });
        const imageUrl = `https://dweb.link/ipfs/${imageCid}/${imageName}`;

        const metadata = {
            name: `Farcaster Circle for ${data.mainUser.display_name}`,
            description: `A visualization of ${data.mainUser.username}'s Farcaster inner circle.`,
            image: imageUrl,
        };
        const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
        const metadataFile = new File([metadataBlob], 'metadata.json');
        const metadataCid = await storage.put([metadataFile], { name: 'metadata.json' });
        const metadataUrl = `https://dweb.link/ipfs/${metadataCid}/metadata.json`;

        const publicClient = createPublicClient({ chain: base, transport: http() });
        
        const { request } = await publicClient.simulateContract({
            address: contractAddress as `0x${string}`,
            abi: contractAbi,
            functionName: 'mint',
            args: [metadataUrl], 
            account: address,
        });
        const txHash = await walletClient.writeContract(request);
        setMintSuccessTx(txHash);

    } catch (err: unknown) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError("An unknown error occurred during minting.");
        }
    } finally {
        setIsMinting(false);
    }
  }; 

  return (
    <main className="bg-gray-900 min-h-screen text-white flex flex-col items-center justify-center p-4 font-sans selection:bg-purple-500/50">
      <div className="w-full max-w-3xl text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-500 text-transparent bg-clip-text">Farcaster Circle</h1>
        <p className="text-lg text-gray-400 mb-8">
          Visualize your social circles and mint them onchain.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center mb-8">
          <input
            type="text"
            value={fname}
            onChange={(e) => setFname(e.target.value)}
            placeholder="Enter Farcaster username (e.g., dwr)"
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
          <button
            onClick={generateCircle}
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900/50 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            {isLoading ? 'Generating...' : 'Generate Circles'}
          </button>
        </div>

        <div className="w-full min-h-[500px] flex items-center justify-center">
          {isLoading && <Spinner />}
          {error && <ErrorMessage message={error} />}
          {data && (
             <div className="flex flex-col items-center gap-6">
                <div ref={circleRef} className="p-8 bg-gray-800/50 rounded-2xl border border-gray-700 shadow-lg">
                    <CircleVisualization data={data} />
                </div>
                 {!mintSuccessTx && (
                    <button onClick={handleMint} disabled={isMinting} className="bg-pink-600 hover:bg-pink-700 disabled:bg-pink-900/50 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg transition-colors text-lg">
                        {isMinting ? 'Minting...' : 'Mint Your Circles'}
                    </button>
                 )}
             </div>
          )}
          {mintSuccessTx && <SuccessMessage txHash={mintSuccessTx} />}
        </div>
      </div>
    </main>
  );
}

const Spinner = () => <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>;
const ErrorMessage = ({ message }: { message: string }) => <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg max-w-md"><p className="font-semibold">Error:</p><p className="text-sm">{message}</p></div>;

const SuccessMessage = ({ txHash }: { txHash: string }) => {
    const farcasterShareUrl = `https://warpcast.com/~/compose?text=I%20just%20minted%20my%20Farcaster%20Circles%20on%20Base!%20Check%20out%20the%20app%20to%20create%20your%20own.&embeds[]=https://basescan.org/tx/${txHash}`;
    return (
        <div className="bg-green-900/50 border border-green-700 text-green-300 px-6 py-4 rounded-lg flex flex-col items-center gap-4">
            <p className="font-bold text-lg">Mint Successful!</p>
            <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-sm underline hover:text-white">View on Basescan</a>
            <a href={farcasterShareUrl} target="_blank" rel="noopener noreferrer" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg">
                Share on Farcaster
            </a>
        </div>
    );
};

const CircleVisualization = ({ data }: { data: ApiResponse }) => {
    const totalSize = 450;
    const centerPfpSize = 80;
    const innerCirclePfpSize = 50;
    const innerRadius = 120;
    const outerCirclePfpSize = 40;
    const outerRadius = 200;

    return (
        <div className="relative" style={{ width: `${totalSize}px`, height: `${totalSize}px` }}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                <Image
                    src={data.mainUser.pfp_url}
                    alt={data.mainUser.display_name}
                    width={centerPfpSize}
                    height={centerPfpSize}
                    className="rounded-full border-4 border-purple-500"
                    priority
                />
            </div>
            {data.innerCircle.map((follower, index) => {
                const angle = (index / data.innerCircle.length) * 2 * Math.PI - Math.PI / 2;
                const x = innerRadius * Math.cos(angle) + totalSize / 2;
                const y = innerRadius * Math.sin(angle) + totalSize / 2;
                return <Pfp key={follower.username} user={follower} size={innerCirclePfpSize} x={x} y={y} />;
            })}
            {data.outerCircle.map((follower, index) => {
                const angle = (index / data.outerCircle.length) * 2 * Math.PI - Math.PI / 2;
                const x = outerRadius * Math.cos(angle) + totalSize / 2;
                const y = outerRadius * Math.sin(angle) + totalSize / 2;
                return <Pfp key={follower.username} user={follower} size={outerCirclePfpSize} x={x} y={y} />;
            })}
        </div>
    );
};

const Pfp = ({ user, size, x, y }: { user: User, size: number, x: number, y: number }) => (
    <div
        className="absolute z-10"
        style={{
            width: `${size}px`,
            height: `${size}px`,
            left: `${x}px`,
            top: `${y}px`,
            transform: 'translate(-50%, -50%)'
        }}
    >
        <Image
            src={user.pfp_url}
            alt={user.username}
            width={size}
            height={size}
            title={user.display_name}
            className="rounded-full border-2 border-gray-600"
        />
    </div>
);