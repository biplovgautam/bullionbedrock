"use client";

import { useEffect, useRef } from "react";

export default function CryptoTickTestPage() {
  const priceRef = useRef<HTMLSpanElement | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const lastPriceRef = useRef<number | null>(null);
  const sentimentRef = useRef<HTMLImageElement | null>(null);
  const sentimentStateRef = useRef<"bull" | "bear" | null>("bull");

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY;
    if (!apiKey) {
      console.error(
        "Missing NEXT_PUBLIC_TWELVEDATA_API_KEY. Add it to frontend/.env.local."
      );
      return;
    }

    let ws: WebSocket | null = null;
    const wsUrl = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${apiKey}`;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws?.send(
          JSON.stringify({
            action: "subscribe",
            params: { symbols: "BTC/USD" },
          })
        );
      };

      ws.onmessage = (event) => {
        const timestamp = new Date();
        try {
          const data = JSON.parse(event.data);

          if (data?.price && priceRef.current) {
            const nextPrice = Number(data.price);
            const lastPrice = lastPriceRef.current;
            priceRef.current.innerText = `$${data.price}`;

            if (!Number.isNaN(nextPrice) && lastPrice !== null) {
              const isDown = nextPrice < lastPrice;
              priceRef.current.style.color = isDown ? "#ef4444" : "#22c55e";
              const nextSentiment = isDown ? "bear" : "bull";
              if (
                sentimentRef.current &&
                sentimentStateRef.current !== nextSentiment
              ) {
                sentimentRef.current.src = isDown
                  ? "/gifs/bit_bear.gif"
                  : "/gifs/bit_bull.gif";
                sentimentRef.current.alt = isDown
                  ? "Bearish market"
                  : "Bullish market";
                sentimentStateRef.current = nextSentiment;
              }
            }
            if (!Number.isNaN(nextPrice)) {
              lastPriceRef.current = nextPrice;
            }
            console.log(
              `[${timestamp.toISOString()}] ${timestamp.getMilliseconds()}ms`,
              data.price
            );
          } else {
            console.log("WS message", data);
          }
        } catch (error) {
          console.warn("Failed to parse tick message", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error", error);
      };

      ws.onclose = (event) => {
        console.warn("WebSocket closed", event.code, event.reason);
        if (reconnectTimeoutRef.current) {
          window.clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = window.setTimeout(connect, 1500);
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      ws?.close();
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black px-6 text-center text-white">
      <img
        ref={sentimentRef}
        src="/gifs/bit_bull.gif"
        alt="Bullish market"
        className="h-80 w-80 object-contain"
      />
      <h1 className="text-3xl font-semibold tracking-tight">
        Real-Time BTC/USD value
      </h1>
      <span
        ref={priceRef}
        className="text-6xl font-bold text-emerald-400"
      >
        Waiting for data...
      </span>
    </main>
  );
}
