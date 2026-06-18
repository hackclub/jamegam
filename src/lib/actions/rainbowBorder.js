/* ----------------------------------------------------------------------------
   rainbowBorder — dynamic sketchy rainbow border, rebuilt at any size.

   Usage:  <div class="rainbow-box" use:rainbowBorder></div>
           <div class="rainbow-box" use:rainbowBorder={{ notch: false }}></div>

   Recreates the Figma "Mask group": a tiling rainbow texture (set as the
   element's background in CSS) clipped by a hand-drawn outline. The outline is
   assembled at runtime from three pieces in /static/assets —

     • prize_line.png    a single straight line   (the four edges, stretched)
     • prize_corner.png  a single rounded corner  (flipped into all four)
     • prize_notch.png   a notch                  (dips over the title, centred)

   — composited into one SVG that's applied as the element's CSS mask. Corners
   and notch sit at a fixed pixel size while only the edges stretch, so the
   border stays crisp at any width/height. A ResizeObserver rebuilds it on any
   size change, so it's fully dynamic.

   The three pieces are fetched and inlined as base64 because external image
   refs don't load inside a data-URI mask — but the PNG files remain the source
   of truth, so editing them (then refreshing) updates the border live. They're
   tiny (~1.6KB total) and fetched once, shared across every border.
   ---------------------------------------------------------------------------- */

const PIECES = {
  line: '/assets/prize_line.png',
  corner: '/assets/prize_corner.png',
  notch: '/assets/prize_notch.png'
};

// native piece metrics (px), pulled straight from the Figma mask rects
const T = 13;   // line thickness
const LW = 722; // line native length (prize_line.png is 722px wide)
const CW = 58;  // corner width
const CH = 56;  // corner height
const NW = 200; // notch width (image is 200px wide)
const NH = 37;  // notch height

// fine-tuning (px). edges are nudged outward to sit flush with the corners,
// and the notch is nudged to line up with the (slightly left-of-centre) title.
const OV = 1;          // overlap between pieces, closes sub-pixel seams
const LEFT_DX = -6;    // shift the left edge line left (onto the corner stroke)
const BOTTOM_DY = 6;   // shift the bottom edge line down (onto the corners)
const NOTCH_DX = 0;    // notch centred — the "prizes" title is centred too
const NOTCH_DY = 2;    // shift the notch down (the "prizes" text moves down to match)

// fetch each piece once, inline as a base64 data URI (shared across all borders)
let assetsPromise = null;
function loadAssets() {
  if (assetsPromise) return assetsPromise;
  const toDataUri = async (src) => {
    const bytes = new Uint8Array(await (await fetch(src)).arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return 'data:image/png;base64,' + btoa(bin);
  };
  assetsPromise = Promise.all([toDataUri(PIECES.line), toDataUri(PIECES.corner), toDataUri(PIECES.notch)])
    .then(([line, corner, notch]) => ({ line, corner, notch }));
  return assetsPromise;
}

const img = (href, x, y, w, h) =>
  `<image href='${href}' x='${x}' y='${y}' width='${Math.max(0, w)}' height='${h}' preserveAspectRatio='none' image-rendering='pixelated'/>`;

// crop-then-stretch a slice of the line texture into a target rect. Instead of
// squishing the whole 722px texture into a short top-edge half (very noticeable
// at the notch), only the source range [sx, sx+sw] is shown, stretched to fill
// (x,y,w,h) and clipped to it. The two top halves pull *different* slices so the
// same wiggle pattern doesn't visibly repeat across the notch (matches Figma).
// `defs` collects the per-slice clipPath; returns the drawable <g>.
const lineSlice = (defs, href, x, y, w, h, sx, sw) => {
  const id = `ls${defs.length}`;
  const scale = (w <= 0 ? 0 : w) / sw;     // map source slice width -> target width
  const imgW = LW * scale;                  // full texture scaled by that factor
  const imgX = x - sx * scale;              // shifted so slice start lands at x
  defs.push(`<clipPath id='${id}'><rect x='${x}' y='${y}' width='${Math.max(0, w)}' height='${h}'/></clipPath>`);
  return `<g clip-path='url(#${id})'>${img(href, imgX, y, imgW, h)}</g>`;
};

function buildMask(el, opts, a) {
  const fullW = Math.round(el.clientWidth);
  const fullH = Math.round(el.clientHeight);
  if (!fullW || !fullH) return;

  // `bleed` px of transparent margin on every side: the element is grown by
  // that much (see Prizes.svelte) so edges nudged outward aren't cropped. The
  // border is drawn into the inner box and shifted in by `bleed`, so its
  // on-screen position is unchanged.
  const B = Math.max(0, Math.round(opts.bleed || 0));
  const W = fullW - 2 * B;
  const H = fullH - 2 * B;
  if (W <= 0 || H <= 0) return;

  const notch = opts.notch !== false;
  const nw = notch ? NW : 0;
  const nx = Math.round((W - nw) / 2) + (notch ? NOTCH_DX : 0); // centred, nudged to the title

  // edges overlap the corners (and notch) by OV so there are no seams between
  // pieces. corners + notch are drawn last, so they paint over the overlap.
  const defs = [];
  const HALF = LW / 2; // crop each top half to ~half the texture (Figma behaviour)
  const parts = [
    // bottom edge (nudged down)
    img(a.line, CW - OV, H - T + BOTTOM_DY, W - 2 * CW + 2 * OV, T),
    // top edge — split around the notch when present. Each half shows only a
    // half-length slice of the texture (stretched), so it squishes far less;
    // the left half pulls the texture's first half, the right its second half,
    // so the wiggle doesn't repeat across the notch.
    notch
      ? lineSlice(defs, a.line, CW - OV, 0, nx - CW + 2 * OV, T, 0, HALF) +
        lineSlice(defs, a.line, nx + nw - OV, 0, W - CW - (nx + nw) + 2 * OV, T, HALF, HALF)
      : img(a.line, CW - OV, 0, W - 2 * CW + 2 * OV, T),
    // left (nudged left) + right edges (the line rotated 90°)
    `<g transform='translate(${T + LEFT_DX},${CH - OV}) rotate(90)'>${img(a.line, 0, 0, H - 2 * CH + 2 * OV, T)}</g>`,
    `<g transform='translate(${W},${CH - OV}) rotate(90)'>${img(a.line, 0, 0, H - 2 * CH + 2 * OV, T)}</g>`,
    // four corners — one piece flipped into each position
    img(a.corner, 0, 0, CW, CH),
    `<g transform='translate(${W},0) scale(-1,1)'>${img(a.corner, 0, 0, CW, CH)}</g>`,
    `<g transform='translate(0,${H}) scale(1,-1)'>${img(a.corner, 0, 0, CW, CH)}</g>`,
    `<g transform='translate(${W},${H}) scale(-1,-1)'>${img(a.corner, 0, 0, CW, CH)}</g>`
  ];
  if (notch) parts.push(img(a.notch, nx, NOTCH_DY, nw, NH));

  // clipPath rects are authored in the un-bled coordinate space, so the <defs>
  // and the parts both live inside the bleed translate (clip-path refs resolve
  // by id regardless of where defs sit, but keeping coords consistent is clearer).
  const inner = (defs.length ? `<defs>${defs.join('')}</defs>` : '') + parts.join('');
  const body = B ? `<g transform='translate(${B},${B})'>${inner}</g>` : inner;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${fullW}' height='${fullH}' viewBox='0 0 ${fullW} ${fullH}'>` +
    body +
    '</svg>';
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  el.style.webkitMaskImage = url;
  el.style.maskImage = url;
}

/** Svelte action: paint a dynamic rainbow border, rebuilding on resize. */
export function rainbowBorder(node, options = {}) {
  let opts = options;
  let assets = null;
  const draw = () => { if (assets) buildMask(node, opts, assets); };

  loadAssets().then((a) => { assets = a; draw(); });
  const ro = new ResizeObserver(draw);
  ro.observe(node);

  return {
    update(next = {}) { opts = next; draw(); },
    destroy() { ro.disconnect(); }
  };
}
