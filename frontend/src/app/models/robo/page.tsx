"use client";

import { useEffect, useRef } from "react";

export default function ExamplePage() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    let renderer: import("three").WebGLRenderer | null = null;
    let scene: import("three").Scene | null = null;
    let camera: import("three").PerspectiveCamera | null = null;
    let stats: import("three/addons/libs/stats.module.js").default | null = null;
    let mixer: import("three").AnimationMixer | null = null;
    let clock: import("three").Clock | null = null;
    let model: import("three").Object3D | null = null;
    let skeleton: import("three").SkeletonHelper | null = null;
    let gui: import("lil-gui").GUI | null = null;
    const crossFadeControls: Array<import("lil-gui").Controller> = [];

    let idleAction: import("three").AnimationAction | null = null;
    let walkAction: import("three").AnimationAction | null = null;
    let runAction: import("three").AnimationAction | null = null;
    let actions: import("three").AnimationAction[] = [];
    let settings: Record<string, any> = {};
    let idleWeight = 0;
    let walkWeight = 0;
    let runWeight = 0;
    let singleStepMode = false;
    let sizeOfNextStep = 0;

    const init = async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const Stats = (await import("three/addons/libs/stats.module.js")).default;
      const { GUI } = await import("lil-gui");

      if (!containerRef.current || !mounted) return;

      camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 100);
      camera.position.set(1, 2, -3);
      camera.lookAt(0, 1, 0);

      clock = new THREE.Clock();

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0xa0a0a0);
      scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);

      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 3);
      hemiLight.position.set(0, 20, 0);
      scene.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 3);
      dirLight.position.set(-3, 10, -10);
      dirLight.castShadow = true;
      dirLight.shadow.camera.top = 2;
      dirLight.shadow.camera.bottom = -2;
      dirLight.shadow.camera.left = -2;
      dirLight.shadow.camera.right = 2;
      dirLight.shadow.camera.near = 0.1;
      dirLight.shadow.camera.far = 40;
      scene.add(dirLight);

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        new THREE.MeshPhongMaterial({ color: 0xcbcbcb, depthWrite: false })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      containerRef.current.appendChild(renderer.domElement);

      stats = new Stats();
      containerRef.current.appendChild(stats.dom);

      const loader = new GLTFLoader();
      loader.load("https://threejs.org/examples/models/gltf/Soldier.glb", (gltf) => {
        if (!scene || !renderer) return;

        model = gltf.scene;
        scene.add(model);

        model.traverse((object: import("three").Object3D) => {
          if ((object as import("three").Mesh).isMesh) {
            (object as import("three").Mesh).castShadow = true;
          }
        });

        skeleton = new THREE.SkeletonHelper(model);
        skeleton.visible = false;
        scene.add(skeleton);

        createPanel(GUI);

        const animations = gltf.animations;
        mixer = new THREE.AnimationMixer(model);
        idleAction = mixer.clipAction(animations[0]);
        walkAction = mixer.clipAction(animations[3]);
        runAction = mixer.clipAction(animations[1]);
        actions = [idleAction, walkAction, runAction];
        activateAllActions();

        renderer.setAnimationLoop(animate);
      });

      window.addEventListener("resize", onWindowResize);
    };

    const createPanel = (GUI: typeof import("lil-gui").GUI) => {
      gui = new GUI({ width: 310 });

      const folder1 = gui.addFolder("Visibility");
      const folder2 = gui.addFolder("Activation/Deactivation");
      const folder3 = gui.addFolder("Pausing/Stepping");
      const folder4 = gui.addFolder("Crossfading");
      const folder5 = gui.addFolder("Blend Weights");
      const folder6 = gui.addFolder("General Speed");

      settings = {
        "show model": true,
        "show skeleton": false,
        "deactivate all": deactivateAllActions,
        "activate all": activateAllActions,
        "pause/continue": pauseContinue,
        "make single step": toSingleStepMode,
        "modify step size": 0.05,
        "from walk to idle": () => prepareCrossFade(walkAction, idleAction, 1.0),
        "from idle to walk": () => prepareCrossFade(idleAction, walkAction, 0.5),
        "from walk to run": () => prepareCrossFade(walkAction, runAction, 2.5),
        "from run to walk": () => prepareCrossFade(runAction, walkAction, 5.0),
        "use default duration": true,
        "set custom duration": 3.5,
        "modify idle weight": 0.0,
        "modify walk weight": 1.0,
        "modify run weight": 0.0,
        "modify time scale": 1.0,
      };

      folder1.add(settings, "show model").onChange(showModel);
      folder1.add(settings, "show skeleton").onChange(showSkeleton);
      folder2.add(settings, "deactivate all");
      folder2.add(settings, "activate all");
      folder3.add(settings, "pause/continue");
      folder3.add(settings, "make single step");
      folder3.add(settings, "modify step size", 0.01, 0.1, 0.001);
      crossFadeControls.push(folder4.add(settings, "from walk to idle"));
      crossFadeControls.push(folder4.add(settings, "from idle to walk"));
      crossFadeControls.push(folder4.add(settings, "from walk to run"));
      crossFadeControls.push(folder4.add(settings, "from run to walk"));
      folder4.add(settings, "use default duration");
      folder4.add(settings, "set custom duration", 0, 10, 0.01);
      folder5
        .add(settings, "modify idle weight", 0.0, 1.0, 0.01)
        .listen()
        .onChange((weight: number) => setWeight(idleAction, weight));
      folder5
        .add(settings, "modify walk weight", 0.0, 1.0, 0.01)
        .listen()
        .onChange((weight: number) => setWeight(walkAction, weight));
      folder5
        .add(settings, "modify run weight", 0.0, 1.0, 0.01)
        .listen()
        .onChange((weight: number) => setWeight(runAction, weight));
      folder6.add(settings, "modify time scale", 0.0, 1.5, 0.01).onChange(modifyTimeScale);

      folder1.open();
      folder2.open();
      folder3.open();
      folder4.open();
      folder5.open();
      folder6.open();
    };

    const showModel = (visibility: boolean) => {
      if (model) model.visible = visibility;
    };

    const showSkeleton = (visibility: boolean) => {
      if (skeleton) skeleton.visible = visibility;
    };

    const modifyTimeScale = (speed: number) => {
      if (mixer) mixer.timeScale = speed;
    };

    const deactivateAllActions = () => {
      actions.forEach((action) => action.stop());
    };

    const activateAllActions = () => {
      setWeight(idleAction, settings["modify idle weight"]);
      setWeight(walkAction, settings["modify walk weight"]);
      setWeight(runAction, settings["modify run weight"]);
      actions.forEach((action) => action.play());
    };

    const pauseContinue = () => {
      if (singleStepMode) {
        singleStepMode = false;
        unPauseAllActions();
      } else if (idleAction?.paused) {
        unPauseAllActions();
      } else {
        pauseAllActions();
      }
    };

    const pauseAllActions = () => {
      actions.forEach((action) => {
        action.paused = true;
      });
    };

    const unPauseAllActions = () => {
      actions.forEach((action) => {
        action.paused = false;
      });
    };

    const toSingleStepMode = () => {
      unPauseAllActions();
      singleStepMode = true;
      sizeOfNextStep = settings["modify step size"];
    };

    const prepareCrossFade = (
      startAction: import("three").AnimationAction | null,
      endAction: import("three").AnimationAction | null,
      defaultDuration: number
    ) => {
      if (!startAction || !endAction || !mixer) return;
      const duration = setCrossFadeDuration(defaultDuration);
      singleStepMode = false;
      unPauseAllActions();

      if (startAction === idleAction) {
        executeCrossFade(startAction, endAction, duration);
      } else {
        synchronizeCrossFade(startAction, endAction, duration);
      }
    };

    const setCrossFadeDuration = (defaultDuration: number) => {
      if (settings["use default duration"]) return defaultDuration;
      return settings["set custom duration"];
    };

    const synchronizeCrossFade = (
      startAction: import("three").AnimationAction,
      endAction: import("three").AnimationAction,
      duration: number
    ) => {
      if (!mixer) return;
      const onLoopFinished = (event: { action: import("three").AnimationAction }) => {
        if (event.action === startAction) {
          mixer?.removeEventListener("loop", onLoopFinished);
          executeCrossFade(startAction, endAction, duration);
        }
      };

      mixer.addEventListener("loop", onLoopFinished);
    };

    const executeCrossFade = (
      startAction: import("three").AnimationAction,
      endAction: import("three").AnimationAction,
      duration: number
    ) => {
      setWeight(endAction, 1);
      endAction.time = 0;
      startAction.crossFadeTo(endAction, duration, true);
    };

    const setWeight = (action: import("three").AnimationAction | null, weight: number) => {
      if (!action) return;
      action.enabled = true;
      action.setEffectiveTimeScale(1);
      action.setEffectiveWeight(weight);
    };

    const updateWeightSliders = () => {
      settings["modify idle weight"] = idleWeight;
      settings["modify walk weight"] = walkWeight;
      settings["modify run weight"] = runWeight;
    };

    const updateCrossFadeControls = () => {
      if (idleWeight === 1 && walkWeight === 0 && runWeight === 0) {
        crossFadeControls[0].disable();
        crossFadeControls[1].enable();
        crossFadeControls[2].disable();
        crossFadeControls[3].disable();
      }

      if (idleWeight === 0 && walkWeight === 1 && runWeight === 0) {
        crossFadeControls[0].enable();
        crossFadeControls[1].disable();
        crossFadeControls[2].enable();
        crossFadeControls[3].disable();
      }

      if (idleWeight === 0 && walkWeight === 0 && runWeight === 1) {
        crossFadeControls[0].disable();
        crossFadeControls[1].disable();
        crossFadeControls[2].disable();
        crossFadeControls[3].enable();
      }
    };

    const onWindowResize = () => {
      if (!renderer || !camera) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const animate = () => {
      if (!renderer || !scene || !camera || !mixer || !clock) return;

      idleWeight = idleAction?.getEffectiveWeight() ?? 0;
      walkWeight = walkAction?.getEffectiveWeight() ?? 0;
      runWeight = runAction?.getEffectiveWeight() ?? 0;

      updateWeightSliders();
      updateCrossFadeControls();

      let mixerUpdateDelta = clock.getDelta();
      if (singleStepMode) {
        mixerUpdateDelta = sizeOfNextStep;
        sizeOfNextStep = 0;
      }

      mixer.update(mixerUpdateDelta);
      renderer.render(scene, camera);
      stats?.update();
    };

    init();

    return () => {
      mounted = false;
      window.removeEventListener("resize", onWindowResize);
      gui?.destroy();
      if (stats?.dom && stats.dom.parentNode) {
        stats.dom.parentNode.removeChild(stats.dom);
      }
      if (renderer?.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer?.dispose();
    };
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-zinc-900">
      <div className="absolute left-4 top-4 z-10 rounded-md bg-black/60 px-3 py-2 text-sm text-red-300">
        <a className="underline" href="https://threejs.org" target="_blank" rel="noopener">
          three.js
        </a>{" "}
        - Skeletal Animation Blending (model from{" "}
        <a className="underline" href="https://www.mixamo.com" target="_blank" rel="noopener">
          mixamo.com
        </a>
        )
        <br />
        Note: crossfades are possible with blend weights being set to (1,0,0), (0,1,0) or (0,0,1)
      </div>
      <div ref={containerRef} id="container" className="h-full w-full" />
    </main>
  );
}
