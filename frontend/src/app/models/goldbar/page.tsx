"use client";

import { useEffect, useRef } from "react";

export default function GoldBarPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    let renderer: import("three").WebGLRenderer | null = null;
    let scene: import("three").Scene | null = null;
    let camera: import("three").PerspectiveCamera | null = null;
    let controls: import("three/addons/controls/OrbitControls.js").OrbitControls | null = null;
    let mixer: import("three").AnimationMixer | null = null;
    let clock: import("three").Clock | null = null;

    const init = async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");

      if (!containerRef.current || !mounted) return;

      scene = new THREE.Scene();
  scene.background = new THREE.Color("#f2efe8");

      camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 50);
      camera.position.set(2.6, 1.6, 3.2);

      clock = new THREE.Clock();

  const ambient = new THREE.AmbientLight(0xffffff, 1.05);
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
      key.position.set(5, 6, 4);
  const rim = new THREE.DirectionalLight(0xffffff, 0.9);
  rim.position.set(-4, 3, -2);
  const topLight = new THREE.DirectionalLight(0xffffff, 0.6);
  topLight.position.set(0, 6, 0);
  scene.add(ambient, key, rim, topLight);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      containerRef.current.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.minDistance = 1.2;
      controls.maxDistance = 8;
      controls.target.set(0, 0.4, 0);
      controls.update();

      const loader = new GLTFLoader();
      loader.load("/models/gold_bar_single/scene.gltf", (gltf) => {
        if (!scene || !camera || !controls) return;
        const model = gltf.scene;
        model.position.set(0, 0, 0);
        scene.add(model);


        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxSize = Math.max(size.x, size.y, size.z);
        const fitHeightDistance = maxSize / (2 * Math.atan((Math.PI * camera.fov) / 360));
        const distance = fitHeightDistance * 1.4;
        const direction = controls.target.clone().sub(camera.position).normalize().multiplyScalar(distance);

        controls.target.copy(center);
        controls.maxDistance = distance * 10;
        controls.minDistance = distance / 10;
        camera.near = distance / 100;
        camera.far = distance * 100;
        camera.updateProjectionMatrix();
        camera.position.copy(controls.target).sub(direction);
        controls.update();

        if (gltf.animations.length) {
          mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((clip) => mixer?.clipAction(clip).play());
        }
      });

      const onResize = () => {
        if (!renderer || !camera) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
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
      if (renderer && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer?.dispose();
    };
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <div className="absolute left-4 top-4 z-10 rounded-md bg-black/60 px-3 py-2 text-sm text-zinc-100">
        Gold Bar (glTF) preview
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </main>
  );
}
