// The prize pool - single source of truth, shared by the scattered loot in the
// Prizes section (Prizes.svelte) and the plain list page (/prizes). Per item:
//   src   image basename (/assets/prize_{src}.png)
//   alt   accessible label / what it actually is
//   name  short lowercase name used in the hover caption + the list page
//   c     accent colour (the muted-rainbow palette) used for the hover caption
//   s, r  scatter-only: bounding-box size (comp px, ×--scale) + tilt; ignored by /prizes
//   game  true if it's an indie game (you can pick GAME_PICK_COUNT games instead of one item)
//   href  where the prize links to (store page / product), if any
//   lead  overrides the "that's a"/"that's an" caption lead for names with an article
//   note  optional deemphasized trailing note (e.g. a condition)
//   shopOnly  in the /shop pool but kept out of the landing page scatter
//   blurb one-sentence description shown in the /shop item modal
export const PRIZES = [
  { src: 'shark',           alt: 'blahaj shark plush',    name: 'blahaj plushie',         c: '#db9591', s: 118, r: -9,  href: 'https://www.ikea.com/us/en/p/blahaj-soft-toy-shark-90373590/', blurb: 'the legendary ikea shark - a full meter of soft, floppy friend.' },
  { src: 'hollowknight',    alt: 'Hollow Knight',         name: 'hollow knight',          c: '#dbaf91', s: 94,  r: 7,   game: true, href: 'https://store.steampowered.com/app/367520/Hollow_Knight/', blurb: 'a hauntingly beautiful metroidvania about a very small bug knight.' },
  { src: 'controller',      alt: '8BitDo controller',      name: '8bitdo controller',      c: '#97db91', s: 102, r: 12,  lead: 'that’s an', href: 'https://www.8bitdo.com/64-controller/', blurb: 'a quality bluetooth controller for playtesting your games (and everyone else\'s).' },
  { src: 'steam',           alt: 'Steam gift card',        name: 'steam gift card',        c: '#91a4db', s: 74,  r: -15, href: 'https://store.steampowered.com/digitalgiftcards/', blurb: '$25 of steam wallet money to spend on whatever you like.' },
  { src: 'duck',            alt: '150 rubber ducks',       name: '150 rubber ducks',       c: '#b991db', s: 98,  r: -6,  lead: 'that’s', blurb: 'one hundred and fifty rubber ducks to debug with. yes, really.' },
  { src: 'pico8',           alt: 'PICO-8 license',         name: 'pico-8 license',         c: '#db9591', s: 120, r: 4,   href: 'https://www.lexaloffle.com/pico-8.php', blurb: 'the beloved fantasy console - make tiny games inside a tiny computer.' },
  { src: 'mascot',          alt: 'Godot plush',            name: 'godot plush',            c: '#dbaf91', s: 96,  r: 10,  href: 'https://www.makeship.com/products/godot-robot-v2-plushie', blurb: 'a plush of the godot robot to supervise your commits.' },
  { src: 'babaisyou',       alt: 'Baba Is You',            name: 'baba is you',            c: '#97db91', s: 92,  r: -8,  game: true, href: 'https://store.steampowered.com/app/736260/Baba_Is_You/', blurb: 'a puzzle game where you rewrite the rules by pushing words around.' },
  { src: 'celeste',         alt: 'Celeste',                name: 'celeste',                c: '#91a4db', s: 108, r: 9,   game: true, href: 'https://store.steampowered.com/app/504230/Celeste/', blurb: 'a tight platformer about climbing a mountain and being kind to yourself.' },
  { src: 'camera',          alt: 'Kodak Charmera',         name: 'kodak charmera',         c: '#db9591', s: 106, r: 6,   href: 'https://www.kodak.retopro.co/products/kodak-charmera-br-keychain-digital-camera-blind-box', blurb: 'a keychain-sized kodak camera that takes real (tiny) photos.' },
  { src: 'artofgamedesign', alt: 'The Art of Game Design', name: 'the art of game design', c: '#dbaf91', s: 92,  r: 13,  lead: 'that’s', href: 'https://schellgames.com/art-of-game-design', blurb: 'the classic design book - a lens for every problem your games will ever hit.' },
  { src: 'thumby',          alt: 'Thumby handheld',        name: 'thumby',                 c: '#97db91', s: 96,  r: -13, href: 'https://thumby.us/', blurb: 'a playable game console the size of your thumbnail, programmable in python.' },
  { src: 'aseprite',        alt: 'Aseprite license',       name: 'aseprite license',       c: '#91a4db', s: 86,  r: -5,  lead: 'that’s an', href: 'https://www.aseprite.org/', blurb: 'the pixel art editor - the one this site\'s art was drawn in.' },
  { src: 'balatro',         alt: 'Balatro',                name: 'balatro',                c: '#b991db', s: 90,  r: 8,   game: true, href: 'https://store.steampowered.com/app/2379780/Balatro/', blurb: 'poker, but it\'s a roguelike, and it will consume your evenings whole.' },
  { src: 'stardew',         alt: 'Stardew Valley',         name: 'stardew valley',         c: '#97db91', s: 92,  r: -10, game: true, href: 'https://store.steampowered.com/app/413150/Stardew_Valley/', blurb: 'the cozy farming rpg you\'ll accidentally play for 200 hours.' },
  { src: 'undertale',       alt: 'Undertale',              name: 'undertale',              c: '#db9591', s: 88,  r: 6,   game: true, href: 'https://store.steampowered.com/app/391540/Undertale/', blurb: 'the rpg where nobody has to die.' },
  { src: 'vampiresurvivors',alt: 'Vampire Survivors',      name: 'vampire survivors',      c: '#dbaf91', s: 90,  r: -7,  game: true, href: 'https://store.steampowered.com/app/1794680/Vampire_Survivors/', blurb: 'walk around, mow down thousands of monsters, lose track of time.' },
  { src: 'outerwilds',      alt: 'Outer Wilds',            name: 'outer wilds',            c: '#91a4db', s: 94,  r: 11,  game: true, href: 'https://store.steampowered.com/app/753640/Outer_Wilds/', blurb: 'a space mystery you can only experience once - go in blind, trust us.' },
  { src: 'papersplease',    alt: 'Papers, Please',         name: 'papers, please',         c: '#b991db', s: 88,  r: -12, game: true, href: 'https://store.steampowered.com/app/239030/Papers_Please/', blurb: 'a dystopian border-checkpoint thriller. glory to arstotzka.' },
  { src: 'pizzatower',      alt: 'Pizza Tower',            name: 'pizza tower',            c: '#97db91', s: 90,  r: 9,   game: true, href: 'https://store.steampowered.com/app/2231450/Pizza_Tower/', blurb: 'a deliriously fast platformer with cartoon energy off the charts.' },
  { src: 'tunic',           alt: 'TUNIC',                  name: 'tunic',                  c: '#db9591', s: 92,  r: -6,  game: true, href: 'https://store.steampowered.com/app/553420/TUNIC/', blurb: 'an isometric zelda-like starring a small fox with a mysterious manual.' },
  { src: 'pixelcomposer',   alt: 'Pixel Composer',         name: 'pixel composer',         c: '#dbaf91', s: 88,  r: -8,  lead: 'that’s', href: 'https://pixel-composer.com/', blurb: 'a node-based tool for pixel art effects and animation.' },
  { src: 'lethalcompany',   alt: 'Lethal Company',         name: 'lethal company',         c: '#97db91', s: 92,  r: 9,   game: true, href: 'https://store.steampowered.com/app/1966720/Lethal_Company/', blurb: 'a co-op horror comedy about collecting scrap and dying with friends.' },
  { src: 'ashorthike',      alt: 'A Short Hike',           name: 'a short hike',           c: '#dbaf91', s: 90,  r: -8,  game: true, shopOnly: true, href: 'https://store.steampowered.com/app/1055540/A_Short_Hike/', blurb: 'a gentle little island to wander until you find your way up the peak.' },
  { src: 'downwell',        alt: 'Downwell',               name: 'downwell',               c: '#91a4db', s: 88,  r: 10,  game: true, shopOnly: true, href: 'https://store.steampowered.com/app/360740/Downwell/', blurb: 'fall down a well, shoot with your boots - two colors of pure arcade.' },
  { src: 'inscryption',     alt: 'Inscryption',            name: 'inscryption',            c: '#b991db', s: 92,  r: -11, game: true, shopOnly: true, href: 'https://store.steampowered.com/app/1092790/Inscryption/', blurb: 'a creepy card game that keeps breaking its own rules.' },
  { src: 'animalwell',      alt: 'ANIMAL WELL',            name: 'animal well',            c: '#97db91', s: 90,  r: 7,   game: true, shopOnly: true, href: 'https://store.steampowered.com/app/813230/ANIMAL_WELL/', blurb: 'a dense, glowing labyrinth with secrets hiding under its secrets.' },
  { src: 'obradinn',        alt: 'Return of the Obra Dinn', name: 'return of the obra dinn', c: '#db9591', s: 92, r: -5,  game: true, shopOnly: true, href: 'https://store.steampowered.com/app/653530/Return_of_the_Obra_Dinn/', blurb: 'a 1-bit detective masterpiece - deduce the fate of a doomed crew.' },
  { src: 'thomaswasalone',  alt: 'Thomas Was Alone',       name: 'thomas was alone',       c: '#dbaf91', s: 90,  r: 6,   game: true, shopOnly: true, href: 'https://store.steampowered.com/app/220780/Thomas_Was_Alone/', blurb: 'a minimalist puzzler about jumping rectangles with more personality than most protagonists.' },
  { src: 'superhexagon',    alt: 'Super Hexagon',          name: 'super hexagon',          c: '#91a4db', s: 88,  r: -9,  game: true, shopOnly: true, href: 'https://store.steampowered.com/app/221640/Super_Hexagon/', blurb: 'six walls, one triangle, pure reflex. runs are measured in seconds.' },
  { src: 'hotlinemiami',    alt: 'Hotline Miami',          name: 'hotline miami',          c: '#b991db', s: 92,  r: 8,   game: true, shopOnly: true, href: 'https://store.steampowered.com/app/219150/Hotline_Miami/', blurb: 'a neon-soaked top-down rampage with an all-timer soundtrack.' },
  { src: 'supermeatboy',    alt: 'Super Meat Boy',         name: 'super meat boy',         c: '#db9591', s: 90,  r: -7,  game: true, shopOnly: true, href: 'https://store.steampowered.com/app/40800/Super_Meat_Boy/', blurb: 'the brutal precision platformer that defined brutal precision platformers.' },
  { src: 'crueltysquad',    alt: 'Cruelty Squad',          name: 'cruelty squad',          c: '#97db91', s: 92,  r: 11,  game: true, shopOnly: true, href: 'https://store.steampowered.com/app/1388770/Cruelty_Squad/', blurb: 'a gloriously hideous immersive sim. an acquired taste you might acquire.' },
  { src: 'po12',            alt: 'Teenage Engineering PO-12', name: 'teenage engineering po-12', c: '#91a4db', s: 90, r: -12, href: 'https://teenage.engineering/store/po-12', blurb: 'a pocket-sized drum machine - chiptune beats on a calculator.' },
  { src: 'wacom',           alt: 'Wacom drawing tablet',   name: 'basic wacom drawing tablet', c: '#b991db', s: 110, r: 6,  href: 'https://www.wacom.com/en-us/products/pen-tablets/wacom-intuos', blurb: 'a drawing tablet to level up your game art.' },
  { src: 'kenney',          alt: 'Kenney Game Assets All-in-1', name: 'kenney game asset bundle', c: '#db9591', s: 100, r: -7, lead: 'that’s the', href: 'https://kenney.itch.io/kenney-game-assets', blurb: 'thousands of ready-to-use game assets from the asset king himself.' },
  { src: 'nanokey2',        alt: 'Korg nanoKEY2',           name: 'korg nanokey2',          c: '#91a4db', s: 124, r: -6,  href: 'https://www.korg.com/us/products/computergear/nanokey2/', blurb: 'a slim midi keyboard for writing your game\'s soundtrack.' },
  { src: 'tshirt',          alt: 'Jame Gam t-shirt',        name: 'jame gam t-shirt',       c: '#97db91', s: 96,  r: 8,   note: ' (preorder, ships early aug)', blurb: 'the jame gam shirt! preorder - ships early august.' }
];

// how many indie games you can take instead of one item from the pool
export const GAME_PICK_COUNT = 3;

// the indie games (you can pick GAME_PICK_COUNT of these instead of one physical
// prize) and everything else, split for the list page + shop. Order preserved.
export const PRIZE_GAMES = PRIZES.filter((p) => p.game);
export const PRIZE_STUFF = PRIZES.filter((p) => !p.game);

// srcs that have a prizehd_{src}.png - a 2x-pixel-grid version for the big
// spots (/shop modal, the your-pick card). Generated from the figma originals
// + steam art (pipeline: claude-workspace/prize-originals). Still missing:
// pico8, aseprite, pixelcomposer, po12, wacom, kenney, nanokey2, tshirt.
export const PRIZE_HD = new Set([
  'artofgamedesign', 'babaisyou', 'camera', 'celeste', 'controller', 'duck',
  'hollowknight', 'mascot', 'shark', 'steam', 'thumby',
  'balatro', 'stardew', 'pizzatower', 'vampiresurvivors', 'tunic',
  'outerwilds', 'papersplease', 'lethalcompany', 'undertale',
  'ashorthike', 'downwell', 'inscryption', 'animalwell', 'obradinn',
  'thomaswasalone', 'superhexagon', 'hotlinemiami', 'supermeatboy', 'crueltysquad'
]);
