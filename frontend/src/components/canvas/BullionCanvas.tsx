"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

function BullionBar() {
  const meshRef = useRef<THREE.Mesh>(null);
  const baseColorTexture = useLoader(
    THREE.TextureLoader,
    "/models/gold_bar_single/textures/standardSurface1_baseColor.png"
  );
  const engravingTexture = useLoader(THREE.TextureLoader, "/models/gold_bar_single/textures/standardSurface1_normal.png");

  const geometry = useMemo(() => {
    const bottomWidth = 4.2;
    const topWidth = 3.5;
    const height = 0.45;
    const depth = 1.4;
    const halfBottom = bottomWidth / 2;
    const halfTop = topWidth / 2;

    const shape = new THREE.Shape();
    shape.moveTo(-halfBottom, -height / 2);
    shape.lineTo(halfBottom, -height / 2);
    shape.lineTo(halfTop, height / 2);
    shape.lineTo(-halfTop, height / 2);
    shape.lineTo(-halfBottom, -height / 2);

    const extrude = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.1,
      bevelSegments: 8,
      curveSegments: 12,
    });
    extrude.translate(0, 0, -depth / 2);
    extrude.computeVertexNormals();
    return extrude;
  }, []);

  useEffect(() => {
    baseColorTexture.colorSpace = THREE.SRGBColorSpace;
    baseColorTexture.wrapS = THREE.ClampToEdgeWrapping;
    baseColorTexture.wrapT = THREE.ClampToEdgeWrapping;
    baseColorTexture.repeat.set(1, 1);
    baseColorTexture.offset.set(0, 0);
    baseColorTexture.center.set(0.5, 0.5);
    baseColorTexture.flipY = false;

    engravingTexture.colorSpace = THREE.NoColorSpace;
    engravingTexture.wrapS = THREE.ClampToEdgeWrapping;
    engravingTexture.wrapT = THREE.ClampToEdgeWrapping;
    engravingTexture.repeat.set(1, 1);
    engravingTexture.offset.set(0, 0);
    engravingTexture.center.set(0.5, 0.5);
    engravingTexture.flipY = false;
  }, [baseColorTexture, engravingTexture]);

  const materials = useMemo(() => {
    const baseParams = {
      color: new THREE.Color("#FFD700"),
      metalness: 1,
      roughness: 0.4,
      clearcoat: 0.2,
      clearcoatRoughness: 0.2,
      envMapIntensity: 1.6,
      map: baseColorTexture,
    };

    const topMaterial = new THREE.MeshPhysicalMaterial({
      ...baseParams,
      normalMap: engravingTexture,
      normalScale: new THREE.Vector2(0.45, 0.45),
    });

    const sideMaterial = new THREE.MeshPhysicalMaterial(baseParams);

    return [topMaterial, sideMaterial];
  }, [baseColorTexture, engravingTexture]);

  useEffect(() => {
    return () => {
      materials.forEach((material) => material.dispose());
    };
  }, [materials]);

  return <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow material={materials} />;
}

function EnvironmentSetup() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = new RoomEnvironment();
    const texture = pmrem.fromScene(env, 0.02).texture;
    scene.environment = texture;
    scene.background = new THREE.Color("#141414");
    return () => {
      texture.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#151515" roughness={0.9} metalness={0} />
    </mesh>
  );
}

function KeyLight() {
  const lightRef = useRef<THREE.RectAreaLight>(null);

  useFrame(() => {
    if (lightRef.current) {
      lightRef.current.lookAt(0, 0, 0);
    }
  });

  return (
    <rectAreaLight ref={lightRef} position={[0, 2.5, 1.5]} intensity={6} width={3} height={2} color="#fff2c2" />
  );
}

export default function BullionCanvas() {
  return (
    <Canvas camera={{ position: [3.4, 2.2, 3.6], fov: 40 }} shadows>
      <EnvironmentSetup />
      <ambientLight intensity={0.2} />
      <directionalLight
        position={[4, 6, 3]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <KeyLight />
      <BullionBar />
      <Floor />
      <OrbitControls enableDamping autoRotate autoRotateSpeed={1.0} minPolarAngle={0.4} maxPolarAngle={Math.PI / 2.1} />
    </Canvas>
  );
}
