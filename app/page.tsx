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
  const contractAddress = 'YOUR_CONTRACT_ADDRESS_HERE'; 
  
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
    if (!data || !circleRef.current) {
        setError("Please generate a circle first.");
        return;
    }
    
    if (!process.env.NEXT_PUBLIC_WEB3_STORAGE_TOKEN) {
        setError("Web3.Storage API token is not configured. Please add NEXT_PUBLIC_WEB3_STORAGE_TOKEN to your environment variables.");
        return;
    }

    if (contractAddress === 'YOUR_CONTRACT_ADDRESS_HERE' || !contractAddress) {
        setError("Please update the contract address in the code with your deployed contract address.");
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
            name: `Farcaster Circle for ${data.mainUser.display