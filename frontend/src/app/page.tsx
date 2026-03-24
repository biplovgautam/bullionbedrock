"use client";

import dynamic from "next/dynamic";

const BullionCanvas = dynamic(() => import("@/components/canvas/BullionCanvas"), {
  ssr: false,
});

export default function HomePage() {
  return (
    <main className="min-h-screen p-6 md:p-10">
      <section className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-semibold tracking-tight">3D Bullion Visualizer</h1>
        <p className="mt-2 text-zinc-400">
          Real-time Gold/Silver stream-ready frontend scaffold with Three.js.
        </p>
        <div className="mt-6 h-[70vh] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <BullionCanvas />
        </div>
      </section>
    </main>
  );
}
