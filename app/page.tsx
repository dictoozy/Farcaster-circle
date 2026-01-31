'use client';

import { useState, useRef } from 'react';
import { toPng } from 'html-to-image';

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

export default function FarcasterCircles() {
  const [username, setUsername] = useState('');
  const [data, setData] = useState<CircleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const circleRef = useRef<HTMLDivElement>(null);

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
        backgroundColor: '#1a1a2e',
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

    // Create share text
    const text = encodeURIComponent(
      `My Farcaster Circle 🟣\n\nTop friends: ${data.innerCircle.slice(0, 3).map(u => `@${u.username}`).join(', ')}\n\nGenerate yours 👇`
    );
    
    // Warpcast compose URL
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
      alert('Image copied! Paste it in Warpcast');
    } catch {
      // Fallback: download
      downloadImage();
    }
  };

  return (
    <main className="min-h-screen bg-[#0f0f1a] text-white">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl">
            🟣
          </div>
          <span className="text-xl font-bold">Farcaster Circles</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Input */}
        <div className="max-w-md mx-auto mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generateCircle()}
              placeholder="Enter username (e.g. dwr)"
              className="flex-1 px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={generateCircle}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-semibold disabled:opacity-50 hover:opacity-90 transition"
            >
              {loading ? '...' : 'Generate'}
            </button>
          </div>
          
          {error && (
            <p className="mt-3 text-red-400 text-sm text-center">{error}</p>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Circle Visualization */}
        {data && (
          <div className="flex flex-col items-center">
            <div
              ref={circleRef}
              className="p-8 bg-gradient-to-br from-[#1a1a2e] to-[#16162a] rounded-2xl"
            >
              <CircleViz data={data} />
            </div>

            {/* Stats */}
            <div className="mt-4 text-center text-white/60 text-sm">
              Based on {data.stats.totalInteractions} interactions
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              <button
                onClick={shareToFarcaster}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold flex items-center gap-2 transition"
              >
                <span>🟣</span> Share on Farcaster
              </button>
              
              <button
                onClick={copyImageToClipboard}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-semibold flex items-center gap-2 transition"
              >
                📋 Copy Image
              </button>
              
              <button
                onClick={downloadImage}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-semibold flex items-center gap-2 transition"
              >
                ⬇️ Download
              </button>
            </div>
          </div>
        )}

        {/* Info */}
        {!data && !loading && (
          <div className="text-center text-white/50 mt-8">
            <p>See who you interact with most on Farcaster</p>
            <p className="text-sm mt-2">3 circles: closest friends → acquaintances</p>
          </div>
        )}
      </div>
    </main>
  );
}

// Circle Visualization Component
function CircleViz({ data }: { data: CircleData }) {
  const size = 420;
  const center = size / 2;

  // Circle radii
  const innerRadius = 80;
  const middleRadius = 140;
  const outerRadius = 195;

  // Avatar sizes
  const centerSize = 70;
  const innerSize = 44;
  const middleSize = 38;
  const outerSize = 32;

  const placeInCircle = (users: User[], radius: number, avatarSize: number, startAngle = -Math.PI / 2) => {
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
            width={avatarSize}
            height={avatarSize}
            className="rounded-full border-2 border-white/30 hover:border-purple-400 transition-all hover:scale-110"
            style={{ width: avatarSize, height: avatarSize }}
            onError={(e) => {
              e.currentTarget.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${user.username}`;
            }}
          />
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none">
            @{user.username}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Circle rings */}
      <svg className="absolute inset-0" width={size} height={size}>
        <circle cx={center} cy={center} r={outerRadius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <circle cx={center} cy={center} r={middleRadius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <circle cx={center} cy={center} r={innerRadius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      </svg>

      {/* Outer circle (acquaintances) */}
      {placeInCircle(data.outerCircle, outerRadius, outerSize)}
      
      {/* Middle circle (good friends) */}
      {placeInCircle(data.middleCircle, middleRadius, middleSize)}
      
      {/* Inner circle (closest friends) */}
      {placeInCircle(data.innerCircle, innerRadius, innerSize)}

      {/* Center user */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
        <img
          src={data.mainUser.pfp_url}
          alt={data.mainUser.username}
          width={centerSize}
          height={centerSize}
          className="rounded-full border-4 border-purple-500 shadow-lg shadow-purple-500/30"
          style={{ width: centerSize, height: centerSize }}
          onError={(e) => {
            e.currentTarget.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${data.mainUser.username}`;
          }}
        />
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-center">
          <span className="text-sm font-semibold text-white">@{data.mainUser.username}</span>
        </div>
      </div>
    </div>
  );
}
