/* ----------------------------------------------------------------------------
   Viewport / zoom shim.

   The site used to be a fixed 1280 comp scaled down with transform:scale(), and
   this module owned that scale factor (`ZOOM`). The site is now a real responsive
   flow with NO page scaling, so the zoom is always 1. The jiggle action and the
   logo engine still call getZoom()/fit(), so we keep those as cheap stubs:
   getZoom() === 1 makes all their `* ZOOM` / `/ ZOOM` terms identities, and their
   physics already works in real viewport coordinates (getBoundingClientRect).

   #noise height is now handled in CSS (position:absolute; height:100%), so
   initFit() no longer needs to size anything — it stays for API compatibility.
   ---------------------------------------------------------------------------- */

export function getZoom() {
  return 1;
}

export function fit() {
  // no-op: the page no longer scales. Kept because logo/engine.js calls it.
}

export function initFit() {
  // no-op: nothing to fit or bind anymore. Returns a cleanup for API parity.
  return () => {};
}
