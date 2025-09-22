// FINAL VERSION: Based on Claude's code with ChatGPT's specific linting fixes applied.
'use client';

import { useState, useRef } from 'react';
import { createPublicClient, createWalletClient, http, custom, parseAbi, EIP1193Provider } from 'viem';
// FIX: Removed 'base' from the import as it's unused.
import { baseSepolia } from 'viem/chains';
import { Web3Storage } from 'web3.storage';
import { toPng } from 'html-to-image';
import Image from 'next/image';

declare global {
  interface Window {
    // FIX: Replaced 'any' with the specific EIP1193Provider type to satisfy the Vercel linter.
    ethereum?: EIP1193Provider;
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

  // REPLACE WITH YOUR ACTUAL DEPLOYED CONTRACT ADDRESS
  const contractAddress = '0xD7c7d560De9C40E0bADfC68B8a9F9A9e1F31F67E'; 
  
  // ABI matches your contract's mintCircle function
  const contractAbi = parseAbi([
      'function mintCircle(string memory uri) external'
  ]);

  const targetChain = baseSepolia;
  const explorerUrl = 'https://sepolia.basescan.org';

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

  const checkNetwork = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const targetChainId = `0x${targetChain.id.toString(16)}`;
        
        if (chainId !== targetChainId) {
          throw new Error(`Please switch to Base Sepolia testnet in MetaMask`);
        }
        return true;
      } catch (networkError) {
        if (networkError instanceof Error) {
          setError(networkError.message);
        }
        return false;
      }
    }
    return false;
  };
  
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const networkOk = await checkNetwork();
            if (!networkOk) return null;

            const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' });
            return createWalletClient({
                account: address as `0x${string}`,
                chain: targetChain,
                transport: custom(window.ethereum)
            });
        } catch { // FIX: Removed the unused '_err' variable completely.
            setError("Failed to connect wallet. Please try again.");
            return null;
        }
    } else {
        setError("MetaMask is not installed. Please install it to continue.");
        return null;
    }
  };

  const handleMint = async () => {
    const handleMint = async () => {
  console.log("Attempting to mint. Token found:", process.env.NEXT_PUBLIC_WEB3_STORAGE_TOKEN);

  // ... the rest of the function's code
};
    if (!data || !circleRef.current) {
        setError("Please generate a circle first.");
        return;
    }
    
    if (!process.env.NEXT_PUBLIC_WEB3_STORAGE_TOKEN) {
        setError("Web3.Storage API token is not configured. Please add NEXT_PUBLIC_WEB3_STORAGE_TOKEN to your environment variables.");
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
        }
        const [address] = await walletClient.getAddresses();

        const imageBlob = await toPng(circleRef.current, { 
            cacheBust: true, 
            backgroundColor: '#111827',
            width: 600,
            height: 600,
            pixelRatio: 2
        });

        const storage = new Web3Storage({ token: process.env.NEXT_PUBLIC_WEB3_STORAGE_TOKEN });
        const imageName = `${data.mainUser.username}-circle.png`;
        const imageFile = new File([imageBlob], imageName, { type: 'image/png' });
        const imageCid = await storage.put([imageFile], { name: imageName });
        const imageUrl = `https://dweb.link/ipfs/${imageCid}/${imageName}`;

        const metadata = {
            name: `Farcaster Circle for ${data.mainUser.display_name}`,
            description: `A visualization of ${data.mainUser.username}'s Farcaster inner circle. Generated on Base.`,
            image: imageUrl,
            attributes: [
                {
                    trait_type: "Inner Circle Size",
                    value: data.innerCircle.length
                },
                {
                    trait_type: "Outer Circle Size", 
                    value: data.outerCircle.length
                },
                {
                    trait_type: "Username",
                    value: data.mainUser.username
                }
            ]
        };

        const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
        const metadataFile = new File([metadataBlob], 'metadata.json');
        const metadataCid = await storage.put([metadataFile], { name: 'metadata.json' });
        const metadataUrl = `https://dweb.link/ipfs/${metadataCid}/metadata.json`;

        const publicClient = createPublicClient({ chain: targetChain, transport: http() });
        
        const { request } = await publicClient.simulateContract({
            address: contractAddress as `0x${string}`,
            abi: contractAbi,
            functionName: 'mintCircle',
            args: [metadataUrl], 
            account: address,
        });
        
        const txHash = await walletClient.writeContract(request);
        setMintSuccessTx(txHash);

    } catch (err: unknown) {
        if (err instanceof Error) {
            setError(`Minting failed: ${err.message}`);
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
        <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-500 text-transparent bg-clip-text">
          Farcaster Circle
        </h1>
        <p className="text-lg text-gray-400 mb-2">
          Visualize your social circles and mint them onchain.
        </p>
        <p className="text-sm text-yellow-400 mb-8">
          Currently running on Base Sepolia testnet
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
                    <button 
                        onClick={handleMint} 
                        disabled={isMinting} 
                        className="bg-pink-600 hover:bg-pink-700 disabled:bg-pink-900/50 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg transition-colors text-lg"
                    >
                        {isMinting ? 'Minting to Base Sepolia...' : 'Mint Your Circles (Testnet)'}
                    </button>
                 )}
             </div>
          )}
          {mintSuccessTx && <SuccessMessage txHash={mintSuccessTx} explorerUrl={explorerUrl} />}
        </div>
      </div>
    </main>
  );
}

const Spinner = () => <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>;

const ErrorMessage = ({ message }: { message: string }) => (
    <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg max-w-md">
        <p className="font-semibold">Error:</p>
        <p className="text-sm">{message}</p>
    </div>
);

const SuccessMessage = ({ txHash, explorerUrl }: { txHash: string, explorerUrl: string }) => {
    const farcasterShareUrl = `https://warpcast.com/~/compose?text=I%20just%20minted%20my%20Farcaster%20Circles%20on%20Base%20Sepolia!%20Check%20out%20the%20app%20to%20create%20your%20own.&embeds[]=${explorerUrl}/tx/${txHash}`;
    
    return (
        <div className="bg-green-900/50 border border-green-700 text-green-300 px-6 py-4 rounded-lg flex flex-col items-center gap-4">
            <p className="font-bold text-lg">Mint Successful on Base Sepolia!</p>
            <a 
                href={`${explorerUrl}/tx/${txHash}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-sm underline hover:text-white"
            >
                View on Basescan
            </a>
            <a 
                href={farcasterShareUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg"
            >
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
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjMzc0MTUxIi8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMzIiIHI9IjEyIiBmaWxsPSIjOUM5Qzk3Ii8+CjxwYXRoIGQ9Ik0yMCA1NkMyMCA0OCAzMiA0MiA0MCA0MkM0OCA0MiA2MCA0OCA2MCA1NiIgZmlsbD0iIzlDOUM5NyIvPgo8L3N2Zz4K';
                    }}
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
            onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMzc0MTUxIi8+CjxjaXJjbGUgY3g9IjIwIiBjeT0iMTYiIHI9IjYiIGZpbGw9IiM5Qzk5OTciLz4KPHBhdGggZD0iTTEwIDI4QzEwIDI0IDE2IDIxIDIwIDIxQzI0IDIxIDMwIDI0IDMwIDI4IiBmaWxsPSIjOUM5Qzk3Ii8+Cjwvc3ZnPgo=';
            }}
        />
    </div>
);