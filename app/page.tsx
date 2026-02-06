'use client';

import { useState, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { parseAbi, encodeFunctionData } from 'viem';
import sdk from '@farcaster/frame-sdk';

interface User {
  pfp_url: string;
  username: string;
  display_name: string;
  score?: number;
}

interface CircleData {
  mainUser: User;
  innerCircle: User[];
  middleCircle: User[];
  outerCircle: User[];
  stats: {
    totalInteractions: number;
    topScore: number;
  };
}

// Your deployed contract on Base Mainnet
const CONTRACT_ADDRESS = '0x277f895914FE1e98c22dA7cE19DBD31361372e04';
const CONTRACT_ABI = parseAbi(['function mintCircle(string memory uri) external']);

export default function FarcasterCircles() {
  const [username, setUsername] = useState('');
  const [data, setData] = useState<CircleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [mintSuccess, setMintSuccess] = useState<string | null>(null);
  const [appReady, setAppReady] = useState(false);
  const circleRef = useRef<HTMLDivElement>(null);

  // Initialize app and dismiss Farcaster splash screen
  useEffect(() => {
    const init = async () => {
      // Small delay for smooth transition
      await new Promise(r => setTimeout(r, 500));
      sdk.actions.ready();
      setAppReady(true);
    };
    init();
  }, []);

  // Show loading screen while app initializes
  if (!appReady) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center">
        <div className="text-4xl mb-4">🟣</div>
        <div className="text-lg font-semibold text-zinc-700">Farcaster Circle</div>
        <div className="mt-4 w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const generateCircle = async () => {
    if (!username.trim()) {
      setError('Enter a Farcaster username');
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);
    setImageUrl(null);

    try {
      const res = await fetch('/api/followers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fname: username.replace('@', '') }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to fetch');
      }

      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const captureImage = async (): Promise<string | null> => {
    if (!circleRef.current) return null;

    try {
      const dataUrl = await toPng(circleRef.current, {
        backgroundColor: '#E0E7FF',  // indigo-100
        pixelRatio: 2,
      });
      setImageUrl(dataUrl);
      return dataUrl;
    } catch (err) {
      console.error('Failed to capture image:', err);
      return null;
    }
  };

  const downloadImage = async () => {
    const url = imageUrl || await captureImage();
    if (!url) return;

    const link = document.createElement('a');
    link.download = `farcaster-circle-${data?.mainUser.username || 'unknown'}.png`;
    link.href = url;
    link.click();
  };

  const shareToFarcaster = async () => {
    const url = imageUrl || await captureImage();
    if (!url || !data) return;

    const text = encodeURIComponent(
      `My Farcaster Circle\n\nTop friends: ${data.innerCircle.slice(0, 3).map(u => `@${u.username}`).join(', ')}\n\nGenerate yours:`
    );

    const warpcastUrl = `https://warpcast.com/~/compose?text=${text}`;
    window.open(warpcastUrl, '_blank');
  };

  const copyImageToClipboard = async () => {
    const url = imageUrl || await captureImage();
    if (!url) return;

    try {
      const blob = await (await fetch(url)).blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      downloadImage();
    }
  };

  // Mint NFT using Farcaster wallet (for mini apps)
  const mintCircle = async () => {
    if (!data || !circleRef.current) {
      setError('Generate a circle first');
      return;
    }

    setIsMinting(true);
    setError(null);
    setMintSuccess(null);

    try {
      // Get Farcaster context
      const context = await sdk.context;
      
      if (!context?.user?.fid) {
        setError('Please open this in Warpcast');
        setIsMinting(false);
        return;
      }

      // Capture the circle as image
      const circleImage = await captureImage();
      if (!circleImage) {
        setError('Failed to capture image');
        setIsMinting(false);
        return;
      }

      // Upload image and create metadata
      const metadata = {
        name: `Farcaster Circle - @${data.mainUser.username}`,
        description: `Social circle visualization for @${data.mainUser.username} on Farcaster`,
        attributes: [
          { trait_type: 'Username', value: data.mainUser.username },
          { trait_type: 'Inner Circle', value: data.innerCircle.length },
          { trait_type: 'Middle Circle', value: data.middleCircle.length },
          { trait_type: 'Outer Circle', value: data.outerCircle.length },
        ],
      };

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: circleImage, metadata }),
      });

      if (!uploadRes.ok) {
        setError('Failed to upload image');
        setIsMinting(false);
        return;
      }

      const { metadataUri } = await uploadRes.json();

      // Get Farcaster wallet provider
      const provider = sdk.wallet.ethProvider;
      
      // Request accounts
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      const address = accounts[0] as `0x${string}`;

      // Encode function call
      const txData = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'mintCircle',
        args: [metadataUri],
      });

      // Send transaction via Farcaster wallet
      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: CONTRACT_ADDRESS,
          data: txData,
        }],
      }) as string;
      
      setMintSuccess(hash);
      
    } catch (err) {
      console.error('Mint error:', err);
      setError(err instanceof Error ? err.message : 'Minting failed');
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      {/* Minimal Header for Mini App */}
      <header className="bg-white">
        <div className="px-3 py-2 flex items-center justify-center">
          <span className="text-base font-semibold text-zinc-900">🟣 Farcaster Circle</span>
        </div>
      </header>

      <div className="px-3 py-2">
        {/* Hero Section - Compact for Mini App */}
        {!data && !loading && (
          <div className="text-center mb-4 animate-fade-up">
            <h1 className="text-2xl font-bold text-zinc-900 mb-2">
              Your Farcaster Circle
            </h1>
            <p className="text-sm text-zinc-500">
              See who you interact with most
            </p>
          </div>
        )}

        {/* Input Section - Compact */}
        <div className="mb-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-medium text-sm">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generateCircle()}
                placeholder="username"
                className="w-full pl-7 pr-3 py-2.5 bg-white border-2 border-zinc-200 rounded-xl text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 transition-colors font-medium text-sm"
              />
            </div>
            <button
              onClick={generateCircle}
              disabled={loading}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold disabled:opacity-50 transition-colors text-sm"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Loading
                </span>
              ) : 'Generate'}
            </button>
          </div>

          {error && (
            <p className="mt-4 text-red-500 text-sm text-center font-medium animate-fade-up">{error}</p>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center py-16 animate-fade-up">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border-4 border-zinc-200" />
              <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
              <div className="absolute inset-4 rounded-full border-4 border-zinc-200" />
              <div className="absolute inset-4 rounded-full border-4 border-indigo-400 border-t-transparent animate-spin" style={{ animationDuration: '1.5s' }} />
              <div className="absolute inset-8 rounded-full border-4 border-zinc-200" />
              <div className="absolute inset-8 rounded-full border-4 border-indigo-300 border-t-transparent animate-spin" style={{ animationDuration: '2s' }} />
            </div>
            <p className="mt-6 text-zinc-500 font-medium">Mapping your orbit...</p>
          </div>
        )}

        {/* Circle Visualization */}
        {data && (
          <div className="flex flex-col items-center animate-scale-in">
            <div
              ref={circleRef}
              className="p-5 bg-indigo-100 rounded-2xl"
            >
              <CircleViz data={data} />
            </div>

            {/* Legend */}
            <div className="mt-6 flex items-center gap-6 text-sm">
              {[
                { title: 'Besties', ring: 'bg-indigo-600' },
                { title: 'Close friends', ring: 'bg-indigo-400' },
                { title: 'Homies', ring: 'bg-indigo-200' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-zinc-500">
                  <div className={`w-2 h-2 rounded-full ${item.ring}`} />
                  <span>{item.title}</span>
                </div>
              ))}
            </div>

            {/* Action Buttons - Compact for Mini App */}
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <button
                onClick={shareToFarcaster}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-1.5 transition-colors text-sm"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3V2z" />
                </svg>
                Share
              </button>

              <button
                onClick={copyImageToClipboard}
                className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg font-medium flex items-center gap-1.5 transition-colors text-sm"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>

              <button
                onClick={mintCircle}
                disabled={isMinting}
                className="px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg font-medium flex items-center gap-1.5 transition-colors text-sm disabled:opacity-50"
              >
                {isMinting ? 'Minting...' : '🎨 Mint'}
              </button>
            </div>

            {/* Mint Success Message */}
            {mintSuccess && (
              <div className="mt-4 p-4 bg-green-100 border border-green-300 rounded-xl text-green-800 text-sm">
                ✅ Minted! <a href={`https://basescan.org/tx/${mintSuccess}`} target="_blank" rel="noopener noreferrer" className="underline">View on BaseScan</a>
              </div>
            )}

            {/* Generate Another */}
            <button
              onClick={() => {
                setData(null);
                setUsername('');
                setImageUrl(null);
              }}
              className="mt-8 text-zinc-500 hover:text-indigo-600 font-medium transition-colors"
            >
              ← Generate another
            </button>
          </div>
        )}

        {/* Footer Info */}
        {!data && !loading && (
          <div className="mt-16 flex justify-center gap-8 animate-fade-up stagger-4">
            {[
              { title: 'Besties', ring: 'bg-indigo-600' },
              { title: 'Close friends', ring: 'bg-indigo-400' },
              { title: 'Homies', ring: 'bg-indigo-200' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${item.ring}`} />
                <span className="text-sm text-zinc-600 font-medium">{item.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-200 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center text-sm text-zinc-500">
          Built for the Farcaster community
        </div>
      </footer>
    </main>
  );
}

// Circle Visualization - Compact for Mini App
function CircleViz({ data }: { data: CircleData }) {
  // Small size for mini app viewport
  const size = 300;
  const center = size / 2;
  
  // Center avatar
  const centerSize = 48;
  
  // Ring radii - same positions
  const innerRadius = 42;    // 7 avatars
  const middleRadius = 76;   // 11 avatars
  const outerRadius = 120;   // 18 avatars
  
  // Avatar sizes - outer ring slightly bigger
  const innerAvatarSize = 34;
  const middleAvatarSize = 30;
  const outerAvatarSize = 32;  // Just outer ring bigger

  const placeInCircle = (users: User[], radius: number, avatarSz: number, startAngle = -Math.PI / 2) => {
    return users.map((user, i) => {
      const angle = startAngle + (i / users.length) * 2 * Math.PI;
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);

      return (
        <div
          key={user.username}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
          style={{ left: x, top: y }}
        >
          <img
            src={user.pfp_url}
            alt={user.username}
            className="rounded-full border-2 border-white shadow-sm object-cover"
            style={{ width: avatarSz, height: avatarSz, minWidth: avatarSz, minHeight: avatarSz, aspectRatio: '1/1' }}
            onError={(e) => {
              e.currentTarget.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${user.username}`;
            }}
          />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-900 text-white rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            @{user.username}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Outer circle - offset by half to stagger */}
      {placeInCircle(data.outerCircle, outerRadius, outerAvatarSize, -Math.PI/2 + Math.PI/Math.max(data.outerCircle.length, 1))}

      {/* Middle circle - no offset */}
      {placeInCircle(data.middleCircle, middleRadius, middleAvatarSize, -Math.PI/2)}

      {/* Inner circle - offset by half to stagger */}
      {placeInCircle(data.innerCircle, innerRadius, innerAvatarSize, -Math.PI/2 + Math.PI/Math.max(data.innerCircle.length, 1))}

      {/* Center user */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
        <img
          src={data.mainUser.pfp_url}
          alt={data.mainUser.username}
          className="rounded-full border-4 border-white shadow-lg"
          style={{ width: centerSize, height: centerSize }}
          onError={(e) => {
            e.currentTarget.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${data.mainUser.username}`;
          }}
        />
      </div>
    </div>
  );
}
