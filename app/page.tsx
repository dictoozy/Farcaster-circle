// FINAL, VERCEL-READY VERSION: Fixes all TypeScript linting errors.
'use client';

import { useState, useRef } from 'react';
import { createPublicClient, createWalletClient, http, custom, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { Web3Storage } from 'web3.storage';
import { toPng } from 'html-to-image';
import Image from 'next/image';

declare global {
  interface Window {
    ethereum?: any;
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
  const [mintSuccessTx, setMintSuccessTx] = useState<string | null>(null);

  const circleRef = useRef<HTMLDivElement>(null);

  // ==============================================================================
  // CRITICAL: You must paste your real deployed testnet contract address here
  // ==============================================================================
  const contractAddress = 'YOUR_DEPLOYED_CONTRACT_ADDRESS_HERE'; 
  
  const contractAbi = parseAbi([
      // This must match the function in your final deployed contract
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
        } catch (_err) { // FIX: The error variable is now correctly handled
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