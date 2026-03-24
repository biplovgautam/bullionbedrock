"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef } from "react";

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
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr,0.7fr]">
          <div className="h-[70vh] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
            <BullionCanvas />
          </div>
          <LivePriceDisplay />
        </div>
      </section>
    </main>
  );
}

function LivePriceDisplay() {
  const priceRef = useRef<HTMLSpanElement>(null);
  const symbolRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const lastPriceRef = useRef<number | null>(null);

  const wsUrl = useMemo(
    () =>
      process.env.NEXT_PUBLIC_BACKEND_WS_URL ??
      (typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:4000/ws/stream`
        : ""),
    []
  );

  useEffect(() => {
    if (!wsUrl) return;
    const ws = new WebSocket(wsUrl);

    if (statusRef.current) {
      statusRef.current.innerText = "connecting";
    }

    ws.onopen = () => {
      if (statusRef.current) {
        statusRef.current.innerText = "connected";
      }
    };
    ws.onclose = () => {
      if (statusRef.current) {
        statusRef.current.innerText = "disconnected";
      }
    };
    ws.onerror = () => {
      if (statusRef.current) {
        statusRef.current.innerText = "error";
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === "poll" && data.data) {
          const nextPrice = Number(data.data.price);
          if (priceRef.current) {
            priceRef.current.innerText = data.data.price ? `$${data.data.price}` : "--";
            if (!Number.isNaN(nextPrice) && lastPriceRef.current !== null) {
              priceRef.current.style.color = nextPrice >= lastPriceRef.current ? "#22c55e" : "#ef4444";
            }
          }
          if (!Number.isNaN(nextPrice)) {
            lastPriceRef.current = nextPrice;
          }
          if (symbolRef.current) {
            symbolRef.current.innerText = data.symbol ?? "--";
          }
          if (timeRef.current) {
            timeRef.current.innerText = data.data.datetime ?? data.data.timestamp ?? "";
          }
          return;
        }
        if (data.symbol && data.price) {
          const nextPrice = Number(data.price);
          if (priceRef.current) {
            priceRef.current.innerText = `$${data.price}`;
            if (!Number.isNaN(nextPrice) && lastPriceRef.current !== null) {
              priceRef.current.style.color = nextPrice >= lastPriceRef.current ? "#22c55e" : "#ef4444";
            }
          }
          if (!Number.isNaN(nextPrice)) {
            lastPriceRef.current = nextPrice;
          }
          if (symbolRef.current) {
            symbolRef.current.innerText = data.symbol;
          }
          if (timeRef.current) {
            timeRef.current.innerText = data.timestamp ?? data.datetime ?? "";
          }
        }
      } catch {
        // ignore malformed payloads
      }
    };

    return () => ws.close();
  }, [wsUrl]);

  return (
    <aside className="flex h-[70vh] flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-zinc-500">Live Price</p>
        <h2 className="mt-2 text-3xl font-semibold text-zinc-100">
          <span ref={priceRef}>--</span>
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          <span ref={symbolRef}>Waiting for stream</span>
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          <span ref={timeRef}>No updates yet</span>
        </p>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-300">
        <p className="font-medium">Stream status</p>
        <p className="mt-1 capitalize text-zinc-400">
          <span ref={statusRef}>connecting</span>
        </p>
        <p className="mt-3 text-xs text-zinc-500">Source: Redis → Fastify WebSocket</p>
      </div>
    </aside>
  );
}
