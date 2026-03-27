"use client";

import { useEffect, useRef } from "react";
import type { Object3D } from "three";

export default function CryptoTickTestPage() {
  const modelRef = useRef<HTMLDivElement | null>(null);
  const modelObjectRef = useRef<Object3D | null>(null);
  const baseScaleRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const scaleControlRef = useRef<HTMLInputElement | null>(null);
  const priceRef = useRef<HTMLSpanElement | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const lastPriceRef = useRef<number | null>(null);
  const basePriceRef = useRef<number | null>(null);
  const sentimentRef = useRef<HTMLImageElement | null>(null);
  const sentimentStateRef = useRef<"bull" | "bear" | null>("bull");

  const applyScaleMultiplier = (multiplier: number) => {
    if (!modelObjectRef.current || !baseScaleRef.current) return;
    modelObjectRef.current.scale.set(
      baseScaleRef.current.x * multiplier,
      baseScaleRef.current.y * multiplier,
      baseScaleRef.current.z * multiplier
    );
  };

  useEffect(() => {
    let mounted = true;
    let renderer: import("three").WebGLRenderer | null = null;
    let scene: import("three").Scene | null = null;
    let camera: import("three").PerspectiveCamera | null = null;
    let controls: import("three/addons/controls/OrbitControls.js").OrbitControls | null = null;
    let mixer: import("three").AnimationMixer | null = null;
    let clock: import("three").Clock | null = null;
  let pmremGenerator: import("three").PMREMGenerator | null = null;

    const init = async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import(
        "three/addons/controls/OrbitControls.js"
      );
      const { GLTFLoader } = await import(
        "three/addons/loaders/GLTFLoader.js"
      );
      const { RoomEnvironment } = await import(
        "three/addons/environments/RoomEnvironment.js"
      );

      if (!modelRef.current || !mounted) return;

      const container = modelRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;

      scene = new THREE.Scene();
  scene.background = new THREE.Color("#0f172a");
      camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
      camera.position.set(0.9, 0.6, 1.4);

      clock = new THREE.Clock();

      const ambient = new THREE.AmbientLight(0xffffff, 1.2);
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(4, 4, 3);
      const rim = new THREE.DirectionalLight(0xffffff, 0.6);
      rim.position.set(-3, 2, -2);
      scene.add(ambient, key, rim);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.appendChild(renderer.domElement);

      pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator
        .fromScene(new RoomEnvironment(), 0.04)
        .texture;

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.1;

      const loader = new GLTFLoader();
      loader.load("/models/bitcoin/scene.gltf", (gltf) => {
        if (!scene || !camera || !controls) return;
        const model = gltf.scene;
        model.position.set(0, 0, 0);
        model.rotation.set(0.35, -0.6, 0);
        scene.add(model);
        modelObjectRef.current = model;
        baseScaleRef.current = {
          x: model.scale.x,
          y: model.scale.y,
          z: model.scale.z,
        };
        const sliderValue = Number(scaleControlRef.current?.value ?? 1);
        if (!Number.isNaN(sliderValue)) {
          applyScaleMultiplier(sliderValue);
        }

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxSize = Math.max(size.x, size.y, size.z);
        const fitHeightDistance =
          maxSize / (2 * Math.atan((Math.PI * camera.fov) / 360));
        const distance = fitHeightDistance * 1.6;

        controls.target.copy(center);
        camera.near = distance / 100;
        camera.far = distance * 100;
        camera.updateProjectionMatrix();
        camera.position
          .copy(controls.target)
          .add(new THREE.Vector3(0, 0.1, distance));
        controls.update();

        if (gltf.animations.length) {
          mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((clip) => mixer?.clipAction(clip).play());
        }
      });

      const onResize = () => {
        if (!renderer || !camera || !modelRef.current) return;
        const nextWidth = modelRef.current.clientWidth;
        const nextHeight = modelRef.current.clientHeight;
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(nextWidth, nextHeight);
      };

      const render = () => {
        if (!renderer || !scene || !camera || !controls) return;
        controls.update();
        if (mixer && clock) mixer.update(clock.getDelta());
        renderer.render(scene, camera);
      };

      renderer.setAnimationLoop(render);
      window.addEventListener("resize", onResize);

      return () => {
        window.removeEventListener("resize", onResize);
      };
    };

    const cleanupPromise = init();

    return () => {
      mounted = false;
      cleanupPromise?.then?.((cleanup) => cleanup?.());
      controls?.dispose();
      pmremGenerator?.dispose();
      if (renderer && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer?.dispose();
    };
  }, []);

  useEffect(() => {
    const slider = scaleControlRef.current;
    if (!slider) return;

    const handleInput = () => {
      const nextValue = Number(slider.value);
      if (!Number.isNaN(nextValue)) {
        applyScaleMultiplier(nextValue);
      }
    };

    handleInput();
    slider.addEventListener("input", handleInput);

    return () => {
      slider.removeEventListener("input", handleInput);
    };
  }, []);

  useEffect(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_BACKEND_WS_URL ??
      (typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:4000/ws/stream`
        : "");

    if (!wsUrl) return;

    let ws: WebSocket | null = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("Connected to backend price stream");
      };

      ws.onmessage = (event) => {
        const timestamp = new Date();
        try {
          const data = JSON.parse(event.data);
          let price: string | null = null;
          let symbol: string | null = null;

          // Handle standard price update
          if (data.symbol === "BTC/USD" && data.price) {
            price = data.price;
            symbol = data.symbol;
          } 
          // Handle poll fallback format
          else if (data.event === "poll" && data.symbol === "BTC/USD" && data.data?.price) {
            price = data.data.price;
            symbol = data.symbol;
          }

          if (price && priceRef.current) {
            const nextPrice = Number(price);
            const lastPrice = lastPriceRef.current;
            priceRef.current.innerText = `$${price}`;

            if (!Number.isNaN(nextPrice)) {
              if (basePriceRef.current === null) {
                basePriceRef.current = nextPrice;
              }
              const basePrice = basePriceRef.current ?? nextPrice;
              const ratio = (nextPrice - basePrice) / basePrice;
              const clamped = Math.max(-0.08, Math.min(0.08, ratio));
              const scaleValue = 1 + clamped * 2.2;
              applyScaleMultiplier(scaleValue);
              if (scaleControlRef.current) {
                scaleControlRef.current.value = scaleValue.toFixed(2);
              }
            }

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
              price
            );
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
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-black px-6 text-center text-white lg:flex-row">
      {/* <div
        ref={modelRef}
        className="h-80 w-80 rounded-2xl bg-black/30 sm:h-96 sm:w-96"
      /> */}
      <div className="flex flex-col items-center gap-6">
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
        {/* <div className="flex w-full max-w-xs flex-col gap-2 text-sm text-slate-300">
          <label htmlFor="coin-scale" className="font-medium text-slate-200">
            Coin scale playground
          </label>
          <input
            ref={scaleControlRef}
            id="coin-scale"
            type="range"
            min="0.6"
            max="1.6"
            step="0.02"
            defaultValue="1"
            className="w-full"
            disabled
          />
        </div> */}
      </div>
    </main>
  );
}
