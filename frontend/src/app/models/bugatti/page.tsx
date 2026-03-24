"use client";

import { useEffect, useRef } from "react";

export default function BugattiModelPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    let renderer: import("three").WebGLRenderer | null = null;
    let scene: import("three").Scene | null = null;
    let camera: import("three").PerspectiveCamera | null = null;
    let controls: import("three/addons/controls/OrbitControls.js").OrbitControls | null = null;
    let frameId = 0;

    const init = async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
      const { OBJLoader } = await import("three/addons/loaders/OBJLoader.js");
      const { MTLLoader } = await import("three/addons/loaders/MTLLoader.js");

      if (!mounted || !containerRef.current) return;

      scene = new THREE.Scene();
      scene.background = new THREE.Color("#0e1015");

      camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
      camera.position.set(3.5, 2.2, 6.5);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      containerRef.current.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.target.set(0, 0.8, 0);
      controls.update();

      const ambient = new THREE.AmbientLight(0xffffff, 0.45);
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
      keyLight.position.set(5, 8, 4);
      keyLight.castShadow = true;
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
      fillLight.position.set(-4, 3, -2);
      scene.add(ambient, keyLight, fillLight);

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshStandardMaterial({ color: 0x1c1f2a, roughness: 0.9 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      const mtlLoader = new MTLLoader();
      mtlLoader.setPath("/models/bugatti/");
      mtlLoader.load("bugatti.mtl", (materials) => {
        materials.preload();

        const objLoader = new OBJLoader();
        objLoader.setMaterials(materials);
        objLoader.setPath("/models/bugatti/");
        objLoader.load(
          "bugatti.obj",
          (object) => {
            object.traverse((child) => {
              const mesh = child as { isMesh?: boolean; castShadow?: boolean; receiveShadow?: boolean };
              if (mesh.isMesh) {
                mesh.castShadow = true;
                mesh.receiveShadow = true;
              }
            });

            object.scale.setScalar(0.012);
            scene?.add(object);
          },
          undefined,
          (error) => {
            console.error("Failed to load Bugatti model", error);
          }
        );
      });

      const onResize = () => {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };

      window.addEventListener("resize", onResize);

      const animate = () => {
        if (!renderer || !scene || !camera || !controls) return;
        controls.update();
        renderer.render(scene, camera);
        frameId = requestAnimationFrame(animate);
      };

      animate();

      return () => window.removeEventListener("resize", onResize);
    };

    init();

    return () => {
      mounted = false;
      if (frameId) cancelAnimationFrame(frameId);
      controls?.dispose();
      if (renderer && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer?.dispose();
    };
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <div className="absolute left-4 top-4 z-10 max-w-md rounded-lg bg-black/60 px-4 py-3 text-sm text-zinc-100 shadow">
        Bugatti OBJ/MTL preview. The raw .blend file must be converted to glTF/GLB for direct Three.js loading.
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </main>
  );
}
