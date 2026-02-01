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
  const [copied, setCopied] = useState(false);
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
        backgroundColor: '#FFFFFF',
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

  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="border-b border-zinc-200">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3 animate-fade-up stagger-1">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
                <circle cx="12" cy="12" r="3" fill="currentColor" />
                <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5" />
                <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.25" />
              </svg>
            </div>
            <span className="text-xl font-semibold text-zinc-900">Farcaster Circle</span>
          </div>
          <a
            href="https://warpcast.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-500 hover:text-indigo-600 transition-colors animate-fade-up stagger-2"
          >
            Open Warpcast →
          </a>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero Section */}
        {!data && !loading && (
          <div className="text-center mb-12 animate-fade-up">
            <h1 className="text-4xl sm:text-5xl font-bold text-zinc-900 mb-4 tracking-tight">
              Your social orbit
            </h1>
            <p className="text-lg text-zinc-500 max-w-md mx-auto">
              See who you interact with most on Farcaster, visualized in concentric circles.
            </p>
          </div>
        )}

        {/* Input Section */}
        <div className="max-w-md mx-auto mb-10 animate-fade-up stagger-2">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-medium">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generateCircle()}
                placeholder="username"
                className="w-full pl-9 pr-4 py-3.5 bg-white border-2 border-zinc-200 rounded-xl text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 transition-colors font-medium"
              />
            </div>
            <button
              onClick={generateCircle}
              disabled={loading}
              className="px-7 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold disabled:opacity-50 transition-colors btn-press"
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
              className="p-10 bg-white rounded-3xl shadow-sm border border-zinc-100"
            >
              <CircleViz data={data} />
            </div>

            {/* Stats */}
            <div className="mt-6 flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2 text-zinc-500">
                <div className="w-2 h-2 rounded-full bg-indigo-600" />
                <span>{data.stats.totalInteractions} interactions analyzed</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-500">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <span>{data.innerCircle.length + data.middleCircle.length + data.outerCircle.length} connections</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <button
                onClick={shareToFarcaster}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center gap-2 transition-colors btn-press"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3V2z" />
                </svg>
                Share on Warpcast
              </button>

              <button
                onClick={copyImageToClipboard}
                className="px-6 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-semibold flex items-center gap-2 transition-colors btn-press"
              >
                {copied ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy Image
                  </>
                )}
              </button>

              <button
                onClick={downloadImage}
                className="px-6 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-semibold flex items-center gap-2 transition-colors btn-press"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download
              </button>
            </div>

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
          <div className="mt-16 grid sm:grid-cols-3 gap-6 animate-fade-up stagger-4">
            {[
              { title: 'Inner Circle', desc: 'Your closest 5 connections', ring: 'bg-indigo-600' },
              { title: 'Middle Ring', desc: 'Strong connections (5-12)', ring: 'bg-indigo-400' },
              { title: 'Outer Ring', desc: 'Regular interactions (12-20)', ring: 'bg-indigo-200' },
            ].map((item, i) => (
              <div key={i} className="text-center p-6 bg-white rounded-2xl border border-zinc-100">
                <div className={`w-4 h-4 rounded-full ${item.ring} mx-auto mb-3`} />
                <h3 className="font-semibold text-zinc-900 mb-1">{item.title}</h3>
                <p className="text-sm text-zinc-500">{item.desc}</p>
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

// Circle Visualization Component
function CircleViz({ data }: { data: CircleData }) {
  const size = 440;
  const center = size / 2;

  const innerRadius = 85;
  const middleRadius = 150;
  const outerRadius = 205;

  const centerSize = 76;
  const innerSize = 48;
  const middleSize = 42;
  const outerSize = 36;

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
            className="rounded-full border-2 border-white shadow-md avatar-hover"
            style={{ width: avatarSize, height: avatarSize }}
            onError={(e) => {
              e.currentTarget.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${user.username}`;
            }}
          />
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
            @{user.username}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-900" />
          </div>
        </div>
      );
    });
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Orbital rings */}
      <svg className="absolute inset-0" width={size} height={size}>
        {/* Outer ring */}
        <circle
          cx={center}
          cy={center}
          r={outerRadius}
          fill="none"
          stroke="#E4E4E7"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          className="animate-pulse-ring"
        />
        {/* Middle ring */}
        <circle
          cx={center}
          cy={center}
          r={middleRadius}
          fill="none"
          stroke="#D4D4D8"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          className="animate-pulse-ring"
          style={{ animationDelay: '0.5s' }}
        />
        {/* Inner ring */}
        <circle
          cx={center}
          cy={center}
          r={innerRadius}
          fill="none"
          stroke="#A1A1AA"
          strokeWidth="2"
          strokeDasharray="4 4"
          className="animate-pulse-ring"
          style={{ animationDelay: '1s' }}
        />
      </svg>

      {/* Outer circle (acquaintances) */}
      {placeInCircle(data.outerCircle, outerRadius, outerSize)}

      {/* Middle circle (good friends) */}
      {placeInCircle(data.middleCircle, middleRadius, middleSize)}

      {/* Inner circle (closest friends) */}
      {placeInCircle(data.innerCircle, innerRadius, innerSize)}

      {/* Center user */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="relative">
          <img
            src={data.mainUser.pfp_url}
            alt={data.mainUser.username}
            width={centerSize}
            height={centerSize}
            className="rounded-full border-4 border-indigo-600 orbital-glow"
            style={{ width: centerSize, height: centerSize }}
            onError={(e) => {
              e.currentTarget.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${data.mainUser.username}`;
            }}
          />
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
            <span className="text-sm font-semibold text-zinc-900 bg-white px-2 py-1 rounded-full shadow-sm border border-zinc-100">
              @{data.mainUser.username}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
