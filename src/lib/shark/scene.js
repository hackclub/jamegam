// Shared blahaj scene — the SINGLE source of truth for both the live widget
// (SharkPrize.svelte) and the pre-baked poster image. Because the poster is
// rendered from this exact same pipeline at the same backing resolution and
// default pose, the static <img> and the first live 3D frame are pixel-
// identical: the swap from image to draggable 3D is invisible.
//
// Ported from the /shark experiment (shark/index.html). THREE + GLTFLoader are
// dependency-injected so this module stays framework- and bundler-agnostic
// (the widget passes the local npm `three`; the bake harness passes CDN three).

// Default resting pose (the exact angles the /shark experiment settles to — this
// is the pose the poster is baked at, so the model "wakes up" already in it).
export const DEFAULT_POSE = { rx: -19.08, ry: 98.59 };

// Framing: outer canvas tilt (deg) applied in 3D before rasterizing so the pixel
// grid stays screen-aligned, camera vertical aim, and a margin around the model's
// rotation sphere. The camera is positioned to fit the radius the shark actually
// sweeps through as it spins (max vertex distance from the pivot), so it never
// clips at any angle; `margin` adds a little breathing room past that.
export const FRAMING = { tiltDeg: -15, camYFactor: 0.18, margin: 1.05 };

// Backing resolution both the poster and the live canvas render at. The box is
// upscaled via CSS (image-rendering:pixelated), so this is the pixel-art grain.
// Identical for poster + widget ⇒ the static image and first 3D frame match.
// Sized (with the box in EmailSignup) so the shark keeps its apparent size even
// though the camera sits back far enough to never clip a spin.
export const BACKING = { w: 73, h: 64 };

// Flat-color quantizer: classify each textured fragment into the blahaj palette
// (body / belly / pink gills / ink eye + a one-pixel pupil catchlight). Lifted
// verbatim from /shark so the colors match the original art exactly.
function quantize(THREE, mat) {
  mat.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <dithering_fragment>',
`#include <dithering_fragment>
// dilate the eye: sample neighbor texels, keep the darkest, so the tiny
// dark eye survives even when one chunky pixel would otherwise miss it
float eb = gl_FragColor.b;
float r = 6.0 / 1024.0;
eb = min(eb, textureLod(map, vMapUv + vec2( r, 0.0), 0.0).b);
eb = min(eb, textureLod(map, vMapUv + vec2(-r, 0.0), 0.0).b);
eb = min(eb, textureLod(map, vMapUv + vec2(0.0,  r), 0.0).b);
eb = min(eb, textureLod(map, vMapUv + vec2(0.0, -r), 0.0).b);
eb = min(eb, textureLod(map, vMapUv + vec2( r,  r), 0.0).b);
eb = min(eb, textureLod(map, vMapUv + vec2(-r,  r), 0.0).b);
eb = min(eb, textureLod(map, vMapUv + vec2( r, -r), 0.0).b);
eb = min(eb, textureLod(map, vMapUv + vec2(-r, -r), 0.0).b);
// pupil catchlight: claim the ONE fragment whose pixel-sized UV cell
// contains the eye's highlight texel. exactly one pixel, drawn from the
// same surface sample as the eye so the two move in lockstep; auto-hides
// when the eye turns away since it's a front-face fragment like any other.
vec2 dX = dFdx(vMapUv), dY = dFdy(vMapUv);
float det = dX.x * dY.y - dX.y * dY.x;
vec2 d0 = vec2(0.2607, 0.8428) - vMapUv;
vec2 d1 = vec2(0.3887, 0.8428) - vMapUv;
float s0 = (d0.x * dY.y - dY.x * d0.y) / det, t0 = (dX.x * d0.y - d0.x * dX.y) / det;
float s1 = (d1.x * dY.y - dY.x * d1.y) / det, t1 = (dX.x * d1.y - d1.x * dX.y) / det;
bool catchlight = (abs(s0) < 0.5 && abs(t0) < 0.5) || (abs(s1) < 0.5 && abs(t1) < 0.5);
gl_FragColor.rgb = catchlight
  ? vec3(0.8510, 0.8314, 0.8471)   // #d9d4d8 pupil highlight
  : (gl_FragColor.b < 0.25 || eb < 0.06)
  ? vec3(0.3216, 0.3020, 0.2902)   // #524d4a eye
  : (gl_FragColor.b - gl_FragColor.r > 0.08)
    ? vec3(0.5686, 0.7059, 0.8588)   // #91b4db body
    : (gl_FragColor.r - gl_FragColor.b > 0.08)
      ? vec3(0.9020, 0.7294, 0.7176)   // #e6bab7 pink
      : vec3(0.8510, 0.8314, 0.8471);  // #d9d4d8 belly
`);
  };
}

// Build the scene. Returns a handle with render()/setRotation() plus a `ready`
// promise that resolves once the glb is loaded and the first frame is drawn.
// alpha:true + transparent clear so the shark composites onto the page (the
// faded-doodle look comes from CSS opacity on the canvas, matching the poster).
export function createSharkScene({ THREE, GLTFLoader, canvas, glbUrl, backing, framing = FRAMING, pose = DEFAULT_POSE, preserveDrawingBuffer = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);            // transparent paper
  renderer.setSize(backing.w, backing.h, false);  // backing resolution; CSS upscales (pixelated)

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, backing.w / backing.h, 0.1, 100);

  // outer tilt — applied in 3D before rasterization so the pixel grid and drag
  // axes stay screen-aligned (same trick as /shark).
  const tilt = new THREE.Group();
  tilt.rotation.z = framing.tiltDeg * Math.PI / 180;
  scene.add(tilt);
  const rig = new THREE.Group();
  tilt.add(rig);
  rig.rotation.set(pose.rx, pose.ry, 0);

  const state = { rx: pose.rx, ry: pose.ry, loaded: false };

  function render() {
    rig.rotation.set(state.rx, state.ry, 0);
    renderer.render(scene, camera);
  }

  const ready = new Promise((resolve, reject) => {
    new GLTFLoader().load(glbUrl, (g) => {
      const m = g.scene;
      const box = new THREE.Box3().setFromObject(m);        // world matrices are valid here
      const center = box.getCenter(new THREE.Vector3());    // = the rotation pivot

      // Radius the shark actually sweeps through as it spins = farthest VISIBLE
      // vertex from the pivot. The AABB is hugely inflated because the model sits
      // diagonally in local space, so we measure real vertices of the textured
      // mesh instead — otherwise we'd zoom way too far out. (Measured BEFORE
      // recentering, so the world matrices are the valid ones setFromObject just
      // computed — measuring after the move read a stale matrix and over-zoomed.)
      let maxSq = 0;
      const v = new THREE.Vector3();
      m.traverse((o) => {
        if (!o.isMesh || !o.material || !o.material.map) return;   // skip the hidden outline hull
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const d2 = v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).distanceToSquared(center);
          if (d2 > maxSq) maxSq = d2;
        }
      });
      const radius = Math.sqrt(maxSq) * framing.margin;

      m.position.sub(center);                               // recenter the pivot at the origin for rendering

      // Fit that sphere in the tighter half-FOV (vertical when the canvas aspect
      // ≥ 1), so no rotation ever pushes a vertex past the frame edge.
      const half = camera.fov * Math.PI / 360;
      const dist = radius / Math.tan(half) / Math.min(1, camera.aspect);
      camera.position.set(0, radius * framing.camYFactor, dist);
      camera.lookAt(0, 0, 0);
      // unlit flat colors: textured body gets the two-tone split + eye; the
      // inverted-hull outline mesh (no map) is hidden.
      m.traverse((o) => {
        if (!o.isMesh) return;
        if (o.material.map) {
          const tex = o.material.map;
          tex.generateMipmaps = false;            // keep the eye full-res for the shader taps
          tex.minFilter = THREE.LinearFilter;
          tex.needsUpdate = true;
          o.material = new THREE.MeshBasicMaterial({ map: tex });
          quantize(THREE, o.material);
        } else {
          o.visible = false;
        }
      });
      rig.add(m);
      state.loaded = true;
      render();
      resolve(api);
    }, undefined, reject);
  });

  function resize(w, h) {
    backing.w = w; backing.h = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    renderer.dispose();
  }

  const api = { render, resize, dispose, state, renderer, get ready() { return ready; } };
  return api;
}
