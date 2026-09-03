// The winners-bracket picture frames. Each bracket item hangs in its own frame
// (see `frame` in prizes.js), so the tier reads as a gallery wall rather than
// eleven copies of one prop.
//
// Sources + the build script live in claude-workspace/prize-originals/frames/
// (build-frames.sh -> static/assets/frameN.png, analyze.py measures the numbers
// below). Per frame:
//   ar    the art's own width/height. The tile is locked to it, so the gilt is
//         never stretched - no frame is cropped or squashed to fit a cell.
//   pad   the inner opening as [top, right, bottom, left] percentages of the
//         frame's own box, measured off the source rather than eyeballed.
// Frames are photos, so they keep their real orientation: portrait ones stay
// portrait. Items are matched to a frame that suits their shape in prizes.js.
export const FRAMES = {
  // ornate rococo, wide crest along the top
  gilt: { src: 'frame1', ar: 1719 / 1600, pad: [17.9, 15.0, 18.2, 14.7] },
  // tall carved acanthus
  acanthus: { src: 'frame2', ar: 880 / 1240, pad: [12.9, 17.0, 13.5, 18.5] },
  // heavy scrollwork, very deep moulding
  scroll: { src: 'frame3', ar: 1578 / 1436, pad: [23.5, 20.7, 24.0, 23.3] },
  // the widest one, egg-and-dart inner lip
  salon: { src: 'frame4', ar: 1935 / 1554, pad: [19.9, 15.7, 19.0, 16.3] },
  // ROUND OPENING: pad is the ellipse's bounding box, not its inscribed
  // rectangle, so round artwork fills it properly. Only hang round art here -
  // a square picture's corners would poke out over the gilt.
  oval: { src: 'frame5', ar: 1344 / 1600, pad: [14.6, 18.3, 14.7, 17.1], round: true },
  // plain slim portrait
  slim: { src: 'frame6', ar: 565 / 756, pad: [9.4, 14.2, 9.5, 14.0] },
  // beaded portrait
  beaded: { src: 'frame7', ar: 636 / 802, pad: [13.5, 16.4, 13.2, 16.4] },
  // carved corners and centres, nearly square
  ornate: { src: 'frame8', ar: 298 / 348, pad: [17.2, 19.1, 15.8, 19.1] },
  // the plainest one: a bare stepped moulding, no carving at all
  plain: { src: 'frame9', ar: 226 / 291, pad: [10.3, 12.4, 11.0, 14.2] },
  // ROUND OPENING - see the note on `oval`. Round art only.
  round: { src: 'frame10', ar: 1666 / 1924, pad: [16.6, 21.4, 19.8, 19.8], round: true },
  // square-ish, and the only one that keeps its own drop shadow
  shadowed: { src: 'frame11', ar: 832 / 969, pad: [13.2, 12.7, 13.7, 14.5] }
};

// Every frame is sized to the same AREA, not the same height or the same
// opening: a tall portrait and a wide landscape then read as equally big
// pictures on the wall, which is what "roughly the same size" means for frames
// that aren't the same shape. This is the height multiplier - sqrt(1/ar) - and
// the CSS multiplies it by sqrt(the target area).
export const frameHeightMul = (f) => Math.sqrt(1 / f.ar);

/** the inline custom properties a framed tile needs */
export function frameVars(name) {
  const f = FRAMES[name] ?? FRAMES.gilt;
  const [t, r, b, l] = f.pad;
  return (
    `--fr:url('/assets/${f.src}.png');--fr-ar:${f.ar};` +
    `--fr-h:${frameHeightMul(f).toFixed(4)};` +
    `--fr-pt:${t}%;--fr-pr:${r}%;--fr-pb:${b}%;--fr-pl:${l}%`
  );
}
