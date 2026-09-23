/* Shared VRM avatar runtime — used by the hero section and the
   avatar-tracking section.

   - Loads a VRM model and applies the relaxed standing pose (arms hanging
     straight down at the sides).
   - Optionally starts the webcam and drives head, facial expressions and
     torso from the feed. The camera stream is NEVER displayed: detection
     runs on an internal, hidden <video> element.
   - `frameUpperBody: true` frames the camera from the waist/stomach up
     instead of the full body.
   - `dance: true` adds a gentle bounce/sway while tracking is active.

   createAvatarRuntime(config) returns { start, stop, dispose, active }.

   config:
     canvas        (required) WebGL canvas
     modelUrl      (required) VRM model URL
     stage         optional element that gets the error class
     statusEl      optional element that receives status text
     cameraDistance number, full-body framing distance (default 1.4)
     relaxedPose   boolean (default true)
     armSpread     0..1 outward arm angle (default 0.12)
     faceCamera    rotate the model to face the camera (default true)
     poseTracking  enable body/torso tracking (default true)
     frameUpperBody boolean — frame waist-up instead of full body
     dance         boolean — bounce/sway while tracking
     strings       overrides for the status/error messages
     onDetect(face, body)      called every detection frame
     onActiveChange(active)    called when tracking starts/stops
     onReady()                 called when VRM model is loaded and ready
*/

/* MediaPipe + model endpoints. */
const MP_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20';
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

const DEFAULT_STRINGS = {
  statusLoading: 'Loading avatar…',
  statusReady: 'Avatar ready.',
  errorLoad: 'Could not load the avatar.',
  errorWebgl: 'WebGL is not available in this browser.',
  statusInitializing: 'Starting camera…',
  statusSearching: 'Show your face to the camera.',
  statusActive: 'Tracking you.',
  errorDenied: 'Camera permission was denied.',
  errorUnavailable: 'No camera is available.',
  errorCamera: 'Could not start tracking.',
};

/* Aims a humanoid bone so it points along a desired direction expressed
   in the VRM scene's local space. Works from any rest pose (T-pose,
   A-pose, …) because it measures the live world-space direction first. */
function aimHumanoidBone(vrm, THREE, boneName, childName, localDir) {
  const bone = vrm.humanoid.getNormalizedBoneNode(boneName);
  const child = childName ? vrm.humanoid.getNormalizedBoneNode(childName) : null;
  if (!bone || !bone.parent || !child) return;

  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  bone.getWorldPosition(from);
  child.getWorldPosition(to);
  const current = to.sub(from);
  if (current.lengthSq() < 1e-8) return;
  current.normalize();

  const sceneQuat = new THREE.Quaternion();
  vrm.scene.getWorldQuaternion(sceneQuat);
  const desired = localDir.clone().normalize().applyQuaternion(sceneQuat).normalize();

  const swing = new THREE.Quaternion().setFromUnitVectors(current, desired);

  const parentQuat = new THREE.Quaternion();
  bone.parent.getWorldQuaternion(parentQuat);
  bone.quaternion.copy(
    parentQuat.clone().invert().multiply(swing).multiply(parentQuat).multiply(bone.quaternion)
  );
  vrm.scene.updateMatrixWorld(true);
}

/* Straightens the elbow along the current upper-arm direction, so the arm
   reads as one straight limb whatever the shoulder is doing. */
function straightenArm(vrm, THREE, side) {
  if (!vrm || !vrm.humanoid) return;
  vrm.scene.updateMatrixWorld(true);
  const upper = vrm.humanoid.getNormalizedBoneNode(side + 'UpperArm');
  const lower = vrm.humanoid.getNormalizedBoneNode(side + 'LowerArm');
  const hand = vrm.humanoid.getNormalizedBoneNode(side + 'Hand');
  if (!upper || !lower || !hand) return;
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  upper.getWorldPosition(from);
  lower.getWorldPosition(to);
  const upperDir = to.sub(from);
  if (upperDir.lengthSq() < 1e-8) return;
  upperDir.normalize();
  const sceneQuat = new THREE.Quaternion();
  vrm.scene.getWorldQuaternion(sceneQuat);
  aimHumanoidBone(vrm, THREE, side + 'LowerArm', side + 'Hand', upperDir.applyQuaternion(sceneQuat.invert()));
}

/* Rolls the hand about its own long axis until the thumb points forward and
   the palm faces the body — how a relaxed arm actually hangs at the side,
   instead of whatever the model's rest pose (usually a T-pose) left behind.
   Both the thumb position and the torso frame come from the avatar itself,
   so this needs no calibration and no handedness guess. */
function relaxHand(vrm, THREE, side) {
  if (!vrm || !vrm.humanoid) return;
  const boneNode = (name) => {
    try {
      return vrm.humanoid.getNormalizedBoneNode(name);
    } catch (boneError) {
      return null;
    }
  };
  vrm.scene.updateMatrixWorld(true);

  const hand = boneNode(side + 'Hand');
  const middleProx = boneNode(side + 'MiddleProximal');
  const thumb = boneNode(side + 'ThumbMetacarpal') || boneNode(side + 'ThumbProximal');
  const lShoulder = boneNode('leftShoulder') || boneNode('leftUpperArm');
  const rShoulder = boneNode('rightShoulder') || boneNode('rightUpperArm');
  const chest = boneNode('chest') || boneNode('spine');
  const hips = boneNode('hips');
  if (!hand || !middleProx || !thumb || !lShoulder || !rShoulder) return;

  const posOf = (bone) => {
    const pos = new THREE.Vector3();
    bone.getWorldPosition(pos);
    return pos;
  };
  const handPos = posOf(hand);
  const axis = posOf(middleProx).sub(handPos);
  const thumbDir = posOf(thumb).sub(handPos);
  if (axis.lengthSq() < 1e-10 || thumbDir.lengthSq() < 1e-10) return;
  axis.normalize();

  /* The avatar's forward is up x (right shoulder - left shoulder). */
  let up = chest && hips ? posOf(chest).sub(posOf(hips)) : new THREE.Vector3(0, 1, 0);
  if (up.lengthSq() < 1e-10) up = new THREE.Vector3(0, 1, 0);
  up.normalize();
  const shoulderLine = posOf(rShoulder).sub(posOf(lShoulder));
  if (shoulderLine.lengthSq() < 1e-10) return;
  const forward = new THREE.Vector3().crossVectors(up, shoulderLine.normalize());
  if (forward.lengthSq() < 1e-10) return;
  forward.normalize();

  const project = (vector) => {
    const projected = vector.clone().sub(axis.clone().multiplyScalar(vector.dot(axis)));
    return projected.lengthSq() < 1e-10 ? null : projected.normalize();
  };
  const from = project(thumbDir);
  const to = project(forward);
  if (!from || !to) return;

  const angle = Math.atan2(
    new THREE.Vector3().crossVectors(from, to).dot(axis),
    Math.min(1, Math.max(-1, from.dot(to)))
  );
  if (!Number.isFinite(angle)) return;

  const localAxis = axis.clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()).invert());
  if (localAxis.lengthSq() < 1e-10) return;
  hand.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(localAxis.normalize(), angle));
  vrm.scene.updateMatrixWorld(true);
}

/* Hangs one arm alongside the torso with a slight outward angle. The
   outward direction comes from the model's own shoulder line measured in
   world space, so the arms never flip inward when the scene is rotated
   (e.g. the face-to-camera PI turn) — they always end up at the sides,
   hanging down. */
function relaxArm(vrm, THREE, side, spread) {
  if (!vrm || !vrm.humanoid) return;
  vrm.scene.updateMatrixWorld(true);
  const bone = (name, fallback) =>
    vrm.humanoid.getNormalizedBoneNode(name) || vrm.humanoid.getNormalizedBoneNode(fallback);
  const lShoulder = bone('leftShoulder', 'leftUpperArm');
  const rShoulder = bone('rightShoulder', 'rightUpperArm');
  if (!lShoulder || !rShoulder) return;

  const lPos = new THREE.Vector3();
  const rPos = new THREE.Vector3();
  lShoulder.getWorldPosition(lPos);
  rShoulder.getWorldPosition(rPos);
  /* World-space direction pointing to that arm's own side. */
  const outward = side === 'left' ? lPos.sub(rPos) : rPos.sub(lPos);
  outward.y = 0;
  if (outward.lengthSq() < 1e-10) outward.set(side === 'left' ? 1 : -1, 0, 0);
  outward.normalize();

  const sceneQuat = new THREE.Quaternion();
  vrm.scene.getWorldQuaternion(sceneQuat);
  /* Hands forward-at-side: offset toward camera with forward component */
  const desiredWorld = new THREE.Vector3(0, -1.5, 1)
    .addScaledVector(outward, Math.max(0, spread || 0))
    .normalize();
  const localDir = desiredWorld.applyQuaternion(sceneQuat.clone().invert());

  aimHumanoidBone(vrm, THREE, side + 'UpperArm', side + 'LowerArm', localDir);
  straightenArm(vrm, THREE, side);
  relaxHand(vrm, THREE, side);
}

/* Relaxed standing pose: arms hang alongside the body with a slight
   outward angle instead of the model's rest pose (T-pose / A-pose).
   `spread` controls how far the arms sit from the torso. */
function applyRelaxedPose(vrm, THREE, spread) {
  if (!vrm || !vrm.humanoid) return;
  vrm.scene.updateMatrixWorld(true);
  relaxArm(vrm, THREE, 'left', spread);
  relaxArm(vrm, THREE, 'right', spread);
}

function buildOrthoFrame(right, up) {
  if (right.lengthSq() < 1e-8 || up.lengthSq() < 1e-8) return null;
  const r = right.clone().normalize();
  const f = new THREE.Vector3().crossVectors(r, up);
  if (f.lengthSq() < 1e-8) return null;
  f.normalize();
  const u = new THREE.Vector3().crossVectors(f, r).normalize();
  return { r, u, f };
}

export function createAvatarRuntime(cfg) {
  const canvas = cfg.canvas;
  const stage = cfg.stage || null;
  const statusEl = cfg.statusEl || null;
  const onDetect = typeof cfg.onDetect === 'function' ? cfg.onDetect : null;
  const onActiveChange = typeof cfg.onActiveChange === 'function' ? cfg.onActiveChange : null;
  const onReady = typeof cfg.onReady === 'function' ? cfg.onReady : null;
  const cameraDistance = cfg.cameraDistance || 1.4;
  const armSpread = typeof cfg.armSpread === 'number' ? cfg.armSpread : 0.12;
  const relaxedPose = cfg.relaxedPose !== false;
  const faceCamera = cfg.faceCamera !== false;
  const poseEnabled = cfg.poseTracking !== false;
  const frameUpperBody = cfg.frameUpperBody === true;
  const danceEnabled = cfg.dance === true;

  const strings = Object.assign({}, DEFAULT_STRINGS);
  if (cfg.strings) {
    Object.keys(DEFAULT_STRINGS).forEach((key) => {
      if (cfg.strings[key]) strings[key] = cfg.strings[key];
    });
  }

  const tracker = {
    active: false,
    busy: false,
    stream: null,
    visionApi: null,
    visionFileset: null,
    landmarker: null,
    poseLandmarker: null,
    poseEnabled,
    poseZSign: -1,
    frameCount: 0,
    lastVideoTime: -1,
    lastDetectPerf: 0,
    headNode: null,
    restHeadQuat: null,
    calibQuat: null,
    smoothedQuat: null,
    expressionNames: new Set(),
    usedExpressions: [],
    chestNode: null,
    restChestQuat: null,
    smoothedTorsoQuat: null,
    torsoNeutral: null,
  };

  let THREE = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let vrm = null;
  let VRMUtils = null;
  let video = null;
  let resizeObserver = null;
  let disposed = false;
  let failed = false;
  let danceTime = 0;
  let basePos = null;
  let baseRot = null;
  const clock = { last: 0 };

  const setStatus = (message, hide) => {
    if (!statusEl) return;
    statusEl.textContent = message;
    if (hide) statusEl.setAttribute('hidden', '');
    else statusEl.removeAttribute('hidden');
  };

  const setStageError = (on) => {
    if (stage) stage.classList.toggle('avatar-tracking__stage--error', !!on);
  };

  /* Hidden element that feeds MediaPipe. It is never displayed — the
     camera preview was deliberately removed. */
  const ensureVideo = () => {
    if (video) return video;
    video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    video.hidden = true;
    document.body.appendChild(video);
    return video;
  };

  const ready = (async () => {
    setStatus(strings.statusLoading, false);

    let GLTFLoader;
    let VRMLoaderPlugin;
    try {
      THREE = await import('three');
      ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'));
      ({ VRMLoaderPlugin, VRMUtils } = await import('@pixiv/three-vrm'));
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (error) {
      console.error('[avatar-tracking] WebGL unavailable:', error);
      setStageError(true);
      setStatus(strings.errorWebgl, false);
      failed = true;
      return;
    }
    if (disposed) return;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(2, 4, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
    rimLight.position.set(-3, 2, -4);
    scene.add(rimLight);

    const resize = () => {
      const width = canvas.clientWidth || 1;
      const height = canvas.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    resizeObserver = new ResizeObserver(resize);
    /* Observing the canvas itself keeps working when the canvas is moved
       between responsive parent slots (hero desktop/mobile). */
    resizeObserver.observe(canvas);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    try {
      const gltf = await loader.loadAsync(cfg.modelUrl);
      if (disposed) return;
      vrm = gltf.userData.vrm;

      if (!vrm) throw new Error('No VRM data found in model.');

      VRMUtils.removeUnnecessaryVertices(vrm.scene);
      scene.add(vrm.scene);

      /* Some VRM files are authored facing -Z; turn the model so its
         front faces the camera. Disable per-model via the setting. */
      if (faceCamera) {
        vrm.scene.rotation.y += Math.PI;
      }

      /* Relaxed pose runs last so the arms finish hanging straight down at
         the sides in the model's final orientation. */
      if (relaxedPose) {
        applyRelaxedPose(vrm, THREE, armSpread);
      }

      basePos = vrm.scene.position.clone();
      baseRot = { x: vrm.scene.rotation.x, y: vrm.scene.rotation.y, z: vrm.scene.rotation.z };

      frameVrm(vrm.scene);
      resize();

      console.log('[avatar-tracking] vrm:', vrm);
      console.log('[avatar-tracking] humanoid:', vrm.humanoid);
      console.log('[avatar-tracking] expressionManager:', vrm.expressionManager);
      if (vrm.meta) console.log('[avatar-tracking] meta:', vrm.meta);

      setStatus(strings.statusReady, true);
      if (onReady) {
        try {
          onReady();
        } catch (error) {
          console.error('[avatar-tracking] onReady callback error:', error);
        }
      }
      animate();
    } catch (error) {
      if (disposed) return;
      console.error('[avatar-tracking] Failed to load VRM:', error);
      setStageError(true);
      setStatus(strings.errorLoad, false);
      failed = true;
    }
  })();

  const clamp01 = (value) => Math.min(1, Math.max(0, value || 0));

  const setExpression = (name, weight) => {
    if (!vrm || !tracker.expressionNames.has(name)) return;
    try {
      vrm.expressionManager.setValue(name, clamp01(weight));
    } catch (error) {
      tracker.expressionNames.delete(name);
    }
  };

  const blendScore = (blends, name) => {
    const found = blends.find((item) => item.categoryName === name);
    return found ? found.score : 0;
  };

  const applyFaceResult = (result, alpha) => {
    const matrices = result.facialTransformationMatrixes;
    const blendshapes = result.faceBlendshapes;
    if (!matrices || matrices.length === 0 || !blendshapes || blendshapes.length === 0 || !matrices[0].data) {
      return false;
    }

    /* Matrix data is column-major, consumed directly by three.js. */
    const faceQuat = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().fromArray(matrices[0].data)
    );
    /* Front-camera mirror: negate pitch (X) and yaw (Y) for correct direction. */
    faceQuat.x *= -1;
    faceQuat.y *= -1;
    faceQuat.z *= 1;

    /* The first detected face becomes the neutral reference pose.
       Remove roll (Z tilt) to ensure default position is straight. */
    if (!tracker.calibQuat) {
      const euler = new THREE.Euler().setFromQuaternion(faceQuat, 'YXZ');
      euler.z = 0;
      tracker.calibQuat = new THREE.Quaternion().setFromEuler(euler);
    }

    const relative = tracker.calibQuat.clone().invert().multiply(faceQuat);
    tracker.smoothedQuat.slerp(relative, alpha);
    if (tracker.headNode && tracker.restHeadQuat) {
      tracker.headNode.quaternion.copy(tracker.restHeadQuat).multiply(tracker.smoothedQuat);
    }

    const blends = blendshapes[0].categories || [];
    const avg = (...names) => names.reduce((sum, name) => sum + blendScore(blends, name), 0) / names.length;

    if (tracker.expressionNames.has('blinkLeft')) {
      setExpression('blinkLeft', blendScore(blends, 'eyeBlinkLeft'));
      setExpression('blinkRight', blendScore(blends, 'eyeBlinkRight'));
    } else {
      setExpression(
        'blink',
        Math.max(blendScore(blends, 'eyeBlinkLeft'), blendScore(blends, 'eyeBlinkRight'))
      );
    }
    setExpression('aa', blendScore(blends, 'jawOpen'));
    setExpression('happy', avg('mouthSmileLeft', 'mouthSmileRight'));
    setExpression('angry', avg('browDownLeft', 'browDownRight'));
    setExpression('sad', avg('mouthFrownLeft', 'mouthFrownRight'));

    tracker.usedExpressions = ['blinkLeft', 'blinkRight', 'blink', 'aa', 'happy', 'angry', 'sad'].filter(
      (name) => tracker.expressionNames.has(name)
    );

    return true;
  };

  /* Pose detection runs but body stays still. Head/face follow is handled
     by face tracking only. */
  const applyPoseResult = (result, alpha) => {
    if (!tracker.poseEnabled) return false;
    const lists = result.landmarks;
    if (!lists || lists.length === 0) return false;
    const lm = lists[0];
    const seen = (i) => lm[i] && (lm[i].visibility === undefined || lm[i].visibility > 0.3);
    if (!seen(11) || !seen(12)) return false;
    /* Body stays in rest pose — no torso movement. Just return true to
       signal we detected a pose (for status messages). */
    return true;
  };

  const stopStream = () => {
    if (tracker.stream) {
      tracker.stream.getTracks().forEach((track) => track.stop());
      tracker.stream = null;
    }
    if (video) video.srcObject = null;
  };

  const resetPose = () => {
    if (tracker.headNode && tracker.restHeadQuat) {
      tracker.headNode.quaternion.copy(tracker.restHeadQuat);
    }
    tracker.usedExpressions.forEach((name) => setExpression(name, 0));
    tracker.calibQuat = null;
    tracker.smoothedQuat = new THREE.Quaternion();
    if (tracker.chestNode && tracker.restChestQuat) {
      tracker.chestNode.quaternion.copy(tracker.restChestQuat);
    }
    tracker.torsoNeutral = null;
    tracker.smoothedTorsoQuat = new THREE.Quaternion();
    if (vrm && relaxedPose) {
      applyRelaxedPose(vrm, THREE, armSpread);
    }
    if (vrm && basePos && baseRot) {
      vrm.scene.position.copy(basePos);
      vrm.scene.rotation.set(baseRot.x, baseRot.y, baseRot.z);
    }
    danceTime = 0;
  };

  const getVision = async () => {
    if (!tracker.visionApi) tracker.visionApi = await import('@mediapipe/tasks-vision');
    if (!tracker.visionFileset) {
      tracker.visionFileset = await tracker.visionApi.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
    }
    return tracker.visionApi;
  };

  const createLandmarker = async (kind, modelAssetPath, extraOptions) => {
    const vision = await getVision();
    const base = { runningMode: 'VIDEO', ...extraOptions };
    try {
      return await vision[kind].createFromOptions(tracker.visionFileset, {
        ...base,
        baseOptions: { modelAssetPath, delegate: 'GPU' },
      });
    } catch (gpuError) {
      console.warn('[avatar-tracking] GPU delegate failed, falling back to CPU:', gpuError);
      return vision[kind].createFromOptions(tracker.visionFileset, {
        ...base,
        baseOptions: { modelAssetPath, delegate: 'CPU' },
      });
    }
  };

  const closeLandmarker = (key) => {
    if (!tracker[key]) return;
    try {
      tracker[key].close();
    } catch (closeError) {
      console.warn('[avatar-tracking] Failed to close landmarker:', closeError);
    }
    tracker[key] = null;
  };

  const frameVrm = (object) => {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    if (frameUpperBody) {
      /* Show from head down to upper stomach/waist. Cut below stomach. */
      const topPad = typeof cfg.frameTopPad === 'number' ? cfg.frameTopPad : 0.02;
      const topY = box.max.y + size.y * topPad;
      const bottomY = box.min.y + size.y * 0.70; /* Cut at ~70% to show only perut up */
      const centerY = (topY + bottomY) / 2;
      const visibleH = topY - bottomY;
      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const distance = visibleH / 2 / Math.tan(vFov / 2);
      console.log('[avatar-tracking] upper frame:', {
        sizeX: +size.x.toFixed(3),
        sizeY: +size.y.toFixed(3),
        visibleH: +visibleH.toFixed(3),
        distance: +distance.toFixed(3),
        aspect: +camera.aspect.toFixed(3),
      });
      camera.position.set(center.x, centerY, center.z + distance);
      camera.lookAt(center.x, centerY, center.z);
      return;
    }

    const maxSize = Math.max(size.x, size.y, size.z) || 1;
    const distance = (maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) * cameraDistance;
    camera.position.set(center.x, center.y + maxSize * 0.08, center.z + distance);
    camera.lookAt(center.x, center.y, center.z);
  };

  const runDetection = () => {
    if (!tracker.active || !tracker.landmarker || !video || video.readyState < 2) return;
    if (video.currentTime === tracker.lastVideoTime) return;
    tracker.lastVideoTime = video.currentTime;
    try {
      const now = performance.now();
      const dt = Math.max((now - tracker.lastDetectPerf) / 1000, 0.001);
      tracker.lastDetectPerf = now;
      /* Smooth head tracking - not too fast, not too slow */
      const alpha = 1 - Math.exp(-8 * dt);
      const faceFound = applyFaceResult(tracker.landmarker.detectForVideo(video, now), alpha);
      /* Body detection runs on alternate frames to keep CPU usage in check. */
      tracker.frameCount += 1;
      let bodyFound = false;
      if (tracker.poseLandmarker && tracker.frameCount % 2 === 1) {
        try {
          bodyFound = applyPoseResult(tracker.poseLandmarker.detectForVideo(video, now), alpha);
        } catch (poseError) {
          console.error('[avatar-tracking] Pose detection failed:', poseError);
        }
      } else if (tracker.poseLandmarker) {
        bodyFound = !!tracker.torsoNeutral;
      }
      if (faceFound || bodyFound) {
        setStatus(strings.statusActive, true);
      } else {
        setStatus(strings.statusSearching, false);
      }
      if (onDetect) onDetect(faceFound, bodyFound);
    } catch (error) {
      console.error('[avatar-tracking] Detection failed:', error);
    }
  };

  /* Avatar stays in place during dance. Movement comes from pose tracking
     (user's body movement), not from animation. */
  const applyDance = (delta) => {
    if (!danceEnabled || !tracker.active || !vrm || !basePos || !baseRot) return;
    vrm.scene.position.copy(basePos);
    vrm.scene.rotation.set(
      baseRot.x,
      baseRot.y,
      baseRot.z
    );
  };

  let frameIdRef = { id: 0 };
  const animate = () => {
    if (disposed) return;
    frameIdRef.id = requestAnimationFrame(animate);
    const now = performance.now();
    const delta = Math.min(clock.last ? (now - clock.last) / 1000 : 0.016, 0.1);
    clock.last = now;
    if (vrm) {
      runDetection();
      applyDance(delta);
      vrm.update(delta);
    }
    renderer.render(scene, camera);
  };

  const start = async () => {
    if (tracker.active || tracker.busy || failed || disposed) return false;
    tracker.busy = true;
    try {
      await ready;
    } catch (readyError) {
      /* ready never rejects — it records failures itself. */
    }
    if (disposed || failed || !vrm) {
      tracker.busy = false;
      return false;
    }
    setStageError(false);
    setStatus(strings.statusInitializing, false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('unavailable');
      }

      if (!tracker.landmarker) {
        tracker.landmarker = await createLandmarker('FaceLandmarker', FACE_MODEL_URL, {
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });
      }
      if (tracker.poseEnabled && !tracker.poseLandmarker) {
        tracker.poseLandmarker = await createLandmarker('PoseLandmarker', POSE_MODEL_URL, {
          numPoses: 1,
        });
      }
      if (disposed) throw new Error('disposed');

      ensureVideo();
      tracker.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      video.srcObject = tracker.stream;
      await video.play();

      if (disposed) throw new Error('disposed');

      tracker.headNode = vrm.humanoid.getNormalizedBoneNode('head');
      tracker.restHeadQuat = tracker.headNode ? tracker.headNode.quaternion.clone() : null;
      tracker.smoothedQuat = new THREE.Quaternion();
      tracker.calibQuat = null;
      tracker.chestNode =
        vrm.humanoid.getNormalizedBoneNode('chest') || vrm.humanoid.getNormalizedBoneNode('spine');
      tracker.restChestQuat = tracker.chestNode ? tracker.chestNode.quaternion.clone() : null;
      tracker.smoothedTorsoQuat = new THREE.Quaternion();
      tracker.torsoNeutral = null;
      tracker.lastVideoTime = -1;
      tracker.lastDetectPerf = performance.now();
      tracker.frameCount = 0;
      try {
        tracker.expressionNames = new Set(Object.keys(vrm.expressionManager.expressionMap || {}));
      } catch (mapError) {
        tracker.expressionNames = new Set();
      }

      tracker.active = true;
      setStatus(strings.statusSearching, false);
      if (onActiveChange) onActiveChange(true);
      return true;
    } catch (error) {
      console.error('[avatar-tracking] Failed to start tracking:', error);
      let message;
      if (error && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
        message = strings.errorDenied;
      } else if (error && error.message === 'unavailable') {
        message = strings.errorUnavailable;
      } else {
        message = strings.errorCamera;
      }
      if (error && error.message !== 'disposed') {
        setStageError(true);
        setStatus(message, false);
      }
      stopStream();
      tracker.active = false;
      return false;
    } finally {
      tracker.busy = false;
    }
  };

  const stop = () => {
    const wasActive = tracker.active;
    tracker.active = false;
    stopStream();
    resetPose();
    if (vrm) setStatus(strings.statusReady, true);
    if (wasActive && onActiveChange) onActiveChange(false);
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    tracker.active = false;
    cancelAnimationFrame(frameIdRef.id);
    if (resizeObserver) resizeObserver.disconnect();
    stopStream();
    closeLandmarker('landmarker');
    closeLandmarker('poseLandmarker');
    if (vrm && renderer && VRMUtils) {
      scene.remove(vrm.scene);
      VRMUtils.deepDispose(vrm.scene);
      vrm = null;
    }
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
    if (video) {
      video.srcObject = null;
      video.remove();
      video = null;
    }
  };

  return {
    start,
    stop,
    dispose,
    get active() {
      return tracker.active;
    },
    get ready() {
      return ready;
    },
  };
}
