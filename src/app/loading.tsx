import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-screen w-full bg-[#030303] flex flex-col items-center pt-24 px-6 sm:px-12 pb-12 overflow-hidden">
      <div className="w-full max-w-6xl flex flex-col gap-8 animate-pulse">
        {/* Header Skeleton */}
        <div>
          <div className="h-4 w-24 bg-zinc-800/80 rounded-md mb-2" />
          <div className="h-8 w-64 bg-zinc-800 rounded-md" />
        </div>

        {/* 3-Card Row Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 border border-zinc-800/60 bg-[#0A0A0A] rounded-xl p-6 flex flex-col justify-between">
              <div className="h-4 w-1/3 bg-zinc-800/80 rounded-md" />
              <div className="h-8 w-1/2 bg-zinc-800 rounded-md" />
              <div className="h-3 w-1/4 bg-zinc-800/60 rounded-md" />
            </div>
          ))}
        </div>

        {/* Content Block Skeleton */}
        <div className="border border-zinc-800/60 bg-[#0A0A0A] rounded-xl p-8 flex flex-col gap-4 mt-4 h-96">
          <div className="h-5 w-48 bg-zinc-800 rounded-md mb-4" />
          <div className="h-4 w-full bg-zinc-800/60 rounded-md" />
          <div className="h-4 w-[90%] bg-zinc-800/60 rounded-md" />
          <div className="h-4 w-[80%] bg-zinc-800/60 rounded-md" />
        </div>
      </div>
    </div>
  );
}
