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
//   sized  apparel: ordering it requires picking a size (TSHIRT_SIZES)
//   fresh  added this cycle: /prizes shows a little "new!" tag (clear these when the next batch lands)
//   blurb one-sentence description shown in the /shop item modal
export const PRIZES = [
  { src: 'shark',           alt: 'blahaj shark plush',    name: 'blahaj plushie',         c: '#db9591', s: 118, r: -9,  href: 'https://www.ikea.com/us/en/p/blahaj-soft-toy-shark-90373590/', blurb: 'a full meter of friend (the large version)' },
  { src: 'hollowknight',    alt: 'Hollow Knight',         name: 'hollow knight',          c: '#dbaf91', s: 94,  r: 7,   game: true, href: 'https://store.steampowered.com/app/367520/Hollow_Knight/' },
  { src: 'silksong',        alt: 'Hollow Knight: Silksong', name: 'hollow knight: silksong', c: '#b991db', s: 92, r: -8,  game: true, shopOnly: true, href: 'https://store.steampowered.com/app/1030300/Hollow_Knight_Silksong/' },
  { src: 'ceiling',         alt: 'Chubby blob seal plush', name: 'ceiling',                c: '#97db91', s: 104, r: 6,   fresh: true, href: 'https://www.amazon.com/MerryXD-Chubby-Pillow-Stuffed-Cotton/dp/B08241CJN9', blurb: 'its name is ceiling!! see more at ceiling.hackclub.com' },
  { src: 'controller',      alt: '8BitDo controller',      name: '8bitdo controller',      c: '#97db91', s: 102, r: 12,  lead: 'that’s an', href: 'https://www.8bitdo.com/64-controller/', blurb: 'a nice bluetooth controller for pc, switch, and android' },
  { src: 'steam',           alt: 'Steam gift card',        name: 'steam gift card',        c: '#91a4db', s: 74,  r: -15, href: 'https://store.steampowered.com/digitalgiftcards/', blurb: '$25 of steam wallet money to spend on whatever you like' },
  { src: 'fangamer',        alt: 'Fangamer gift card',     name: 'fangamer gift card',     c: '#db9591', s: 90,  r: -7,  fresh: true, shopOnly: true, href: 'https://www.fangamer.com/', blurb: '$25 for merch from your favorite games' },
  { src: 'babaisyou',       alt: 'Baba Is You',            name: 'baba is you',            c: '#97db91', s: 92,  r: -8,  game: true, href: 'https://store.steampowered.com/app/736260/Baba_Is_You/', blurb: '(one of my favorite games)' },
  { src: 'celeste',         alt: 'Celeste',                name: 'celeste',                c: '#91a4db', s: 108, r: 9,   game: true, href: 'https://store.steampowered.com/app/504230/Celeste/', blurb: '(one of my favorite games)' },
  { src: 'terraria',        alt: 'Terraria',               name: 'terraria',               c: '#97db91', s: 90,  r: 7,   fresh: true, game: true, shopOnly: true, href: 'https://store.steampowered.com/app/105600/Terraria/', blurb: '(one of my favorite games)' },
  { src: 'duck',            alt: '150 rubber ducks',       name: '150 rubber ducks',       c: '#b991db', s: 98,  r: -6,  lead: 'that’s', blurb: 'one hundred and fifty rubber ducks. yes, really' },
  { src: 'pico8',           alt: 'PICO-8 license',         name: 'pico-8 license',         c: '#db9591', s: 120, r: 4,   href: 'https://www.lexaloffle.com/pico-8.php', blurb: 'a virtual fantasy console for making and playing tiny games, with built-in code, sprite, map, and music editors' },
  { src: 'minecraft',       alt: 'Minecraft: Java & Bedrock Edition', name: 'minecraft',   c: '#dbaf91', s: 86,  r: 8,   fresh: true, shopOnly: true, href: 'https://www.minecraft.net/en-us/store/minecraft-java-bedrock-edition-pc', blurb: 'java + bedrock for pc. in case you somehow do not have it yet' },
  { src: 'mascot',          alt: 'Godot plush',            name: 'godot plush',            c: '#dbaf91', s: 96,  r: 10,  href: 'https://www.makeship.com/products/godot-robot-v2-plushie', blurb: 'a plush of the godot robot. to supervise your game objects' },
  { src: 'balatro',         alt: 'Balatro',                name: 'balatro',                c: '#b991db', s: 90,  r: 8,   game: true, href: 'https://store.steampowered.com/app/2379780/Balatro/', blurb: '(one of my favorite games)'},
  { src: 'stardew',         alt: 'Stardew Valley',         name: 'stardew valley',         c: '#97db91', s: 92,  r: -10, game: true, shopOnly: true, href: 'https://store.steampowered.com/app/413150/Stardew_Valley/' },
  { src: 'undertale',       alt: 'Undertale',              name: 'undertale',              c: '#db9591', s: 88,  r: 6,   game: true, href: 'https://store.steampowered.com/app/391540/Undertale/', blurb: '(my favorite game)' },
  { src: 'deltarune',       alt: 'DELTARUNE',              name: 'deltarune',              c: '#91a4db', s: 90,  r: -7,  fresh: true, game: true, shopOnly: true, href: 'https://store.steampowered.com/app/1671210/DELTARUNE/', blurb: '(chapters 1+2 are free! this gets you the whole thing)' },
  { src: 'camera',          alt: 'Kodak Charmera',         name: 'kodak charmera',         c: '#db9591', s: 106, r: 6,   href: 'https://www.kodak.retopro.co/products/kodak-charmera-br-keychain-digital-camera-blind-box', blurb: 'a keychain-sized digital camera from kodak! takes real photos' },
  { src: 'artofgamedesign', alt: 'The Art of Game Design', name: 'the art of game design', c: '#dbaf91', s: 92,  r: 13,  lead: 'that’s', href: 'https://schellgames.com/art-of-game-design', blurb: 'a classic game design textbook, built around 100+ "lenses" for examining your gameplay' },
  { src: 'magazine',        alt: 'Hack Club magazine',     name: 'hack club magazine',     c: '#dbaf91', s: 92,  r: 9,   fresh: true, shopOnly: true, href: 'https://magazine.hackclub.com/', blurb: 'the official hack club magazine! 150+ of the coolest projects hack clubbers made in 2025' },
  { src: 'vampiresurvivors',alt: 'Vampire Survivors',      name: 'vampire survivors',      c: '#dbaf91', s: 90,  r: -7,  game: true, href: 'https://store.steampowered.com/app/1794680/Vampire_Survivors/' },
  { src: 'megabonk',        alt: 'Megabonk',               name: 'megabonk',               c: '#97db91', s: 90,  r: 8,   fresh: true, game: true, shopOnly: true, href: 'https://store.steampowered.com/app/3405340/Megabonk/', blurb: '(bonk)' },
  { src: 'thumby',          alt: 'Thumby handheld',        name: 'thumby',                 c: '#97db91', s: 96,  r: -13, href: 'https://thumby.us/', blurb: 'a playable game console the size of your thumbnail, programmable in python' },
  { src: 'aseprite',        alt: 'Aseprite license',       name: 'aseprite license',       c: '#91a4db', s: 86,  r: -5,  lead: 'that’s an', href: 'https://www.aseprite.org/', blurb: 'the industry-standard pixel art and animation editor (i used it to draw this website)' },
  { src: 'outerwilds',      alt: 'Outer Wilds',            name: 'outer wilds',            c: '#91a4db', s: 94,  r: 11,  game: true, href: 'https://store.steampowered.com/app/753640/Outer_Wilds/' },
  { src: 'papersplease',    alt: 'Papers, Please',         name: 'papers, please',         c: '#b991db', s: 88,  r: -12, game: true, href: 'https://store.steampowered.com/app/239030/Papers_Please/' },
  { src: 'pizzatower',      alt: 'Pizza Tower',            name: 'pizza tower',            c: '#97db91', s: 90,  r: 9,   game: true, href: 'https://store.steampowered.com/app/2231450/Pizza_Tower/' },
  { src: 'tunic',           alt: 'TUNIC',                  name: 'tunic',                  c: '#db9591', s: 92,  r: -6,  game: true, shopOnly: true, href: 'https://store.steampowered.com/app/553420/TUNIC/' },
  { src: 'omori',           alt: 'OMORI',                  name: 'omori',                  c: '#db9591', s: 90,  r: -6,  fresh: true, game: true, shopOnly: true, href: 'https://store.steampowered.com/app/1150690/OMORI/' },
  { src: 'pixelcomposer',   alt: 'Pixel Composer',         name: 'pixel composer',         c: '#dbaf91', s: 88,  r: -8,  lead: 'that’s', href: 'https://pixel-composer.com/', blurb: 'a node-based tool for pixel art effects and animation' },
  { src: 'otamatone',       alt: 'Otamatone',              name: 'otamatone',              c: '#b991db', s: 96,  r: -12, fresh: true, lead: 'that’s an', href: 'https://hamee.com/collections/otamatone', blurb: 'the famous singing synth' },
  { src: 'po12',            alt: 'Teenage Engineering PO-12', name: 'teenage engineering po-12', c: '#91a4db', s: 90, r: -12, href: 'https://teenage.engineering/store/po-12', blurb: 'a calculator-sized drum machine: 16 sounds, a 16-step sequencer, and a built-in speaker' },
  { src: 'lethalcompany',   alt: 'Lethal Company',         name: 'lethal company',         c: '#97db91', s: 92,  r: 9,   game: true, href: 'https://store.steampowered.com/app/1966720/Lethal_Company/', blurb: '(one of my favorite games)' },
  { src: 'ashorthike',      alt: 'A Short Hike',           name: 'a short hike',           c: '#dbaf91', s: 90,  r: -8,  game: true, shopOnly: true, href: 'https://store.steampowered.com/app/1055540/A_Short_Hike/' },
  { src: 'downwell',        alt: 'Downwell',               name: 'downwell',               c: '#91a4db', s: 88,  r: 10,  game: true, shopOnly: true, href: 'https://store.steampowered.com/app/360740/Downwell/' },
  { src: 'oneshot',         alt: 'OneShot',                name: 'oneshot',                c: '#dbaf91', s: 90,  r: 9,   fresh: true, game: true, shopOnly: true, href: 'https://store.steampowered.com/app/420530/OneShot/' },
  { src: 'inscryption',     alt: 'Inscryption',            name: 'inscryption',            c: '#b991db', s: 92,  r: -11, game: true, shopOnly: true, href: 'https://store.steampowered.com/app/1092790/Inscryption/' },
  { src: 'animalwell',      alt: 'ANIMAL WELL',            name: 'animal well',            c: '#97db91', s: 90,  r: 7,   game: true, shopOnly: true, href: 'https://store.steampowered.com/app/813230/ANIMAL_WELL/', blurb: '(one of my favorite games of all time)' },
  { src: 'obradinn',        alt: 'Return of the Obra Dinn', name: 'return of the obra dinn', c: '#db9591', s: 92, r: -5,  game: true, shopOnly: true, href: 'https://store.steampowered.com/app/653530/Return_of_the_Obra_Dinn/' },
  { src: 'wacom',           alt: 'Wacom drawing tablet',   name: 'basic wacom drawing tablet', c: '#b991db', s: 110, r: 6,  href: 'https://www.wacom.com/en-us/products/pen-tablets/wacom-intuos', blurb: 'an entry-level intuos drawing tablet, with a battery-free pressure-sensitive pen' },
  { src: 'kenney',          alt: 'Kenney Game Assets All-in-1', name: 'kenney game asset bundle', c: '#db9591', s: 100, r: -7, lead: 'that’s the', shopOnly: true, href: 'https://kenney.itch.io/kenney-game-assets', blurb: 'an all-in-1 game asset bundle: tens of thousands of 2d, 3d, audio, and ui game assets' },
  { src: 'nektar',          alt: 'Nektar SE25 midi keyboard', name: 'nektar se25',          c: '#91a4db', s: 118, r: -6,  fresh: true, href: 'https://nektartech.com/se25-midi-controller/', blurb: 'a slim 25-key usb midi keyboard, for making your game some music' },
  { src: 'stylophone',      alt: 'Stylophone S-1',         name: 'stylophone s-1',         c: '#dbaf91', s: 96,  r: 9,   fresh: true, href: 'https://stylophone.com/product/stylophone-s-1/', blurb: 'the pocket synth you play with a stylus. an icon since 1968' },
  { src: 'bandcamp',        alt: 'Bandcamp gift card',     name: 'bandcamp gift card',     c: '#91a4db', s: 90,  r: 6,   fresh: true, shopOnly: true, href: 'https://bandcamp.com/gift_cards', blurb: '$20 for music from independent artists' },
  { src: 'thomaswasalone',  alt: 'Thomas Was Alone',       name: 'thomas was alone',       c: '#dbaf91', s: 90,  r: 6,   game: true, shopOnly: true, href: 'https://store.steampowered.com/app/220780/Thomas_Was_Alone/' },
  { src: 'superhexagon',    alt: 'Super Hexagon',          name: 'super hexagon',          c: '#91a4db', s: 88,  r: -9,  game: true, shopOnly: true, href: 'https://store.steampowered.com/app/221640/Super_Hexagon/' },
  { src: 'hotlinemiami',    alt: 'Hotline Miami',          name: 'hotline miami',          c: '#b991db', s: 92,  r: 8,   game: true, shopOnly: true, href: 'https://store.steampowered.com/app/219150/Hotline_Miami/' },
  { src: 'supermeatboy',    alt: 'Super Meat Boy',         name: 'super meat boy',         c: '#db9591', s: 90,  r: -7,  game: true, shopOnly: true, href: 'https://store.steampowered.com/app/40800/Super_Meat_Boy/' },
  { src: 'crueltysquad',    alt: 'Cruelty Squad',          name: 'cruelty squad',          c: '#97db91', s: 92,  r: 11,  game: true, shopOnly: true, href: 'https://store.steampowered.com/app/1388770/Cruelty_Squad/' },
  { src: 'gmtkhoodie',      alt: 'GMTK 200th hoodie',      name: 'gmtk hoodie',            c: '#91a4db', s: 108, r: -8,  fresh: true, sized: true, href: 'https://game-makers-toolkit.creator-spring.com/listing/gmtk-200th?product=212', blurb: 'the official gmtk hoodie! this one will only be here for a month' },
  { src: 'tshirt',          alt: 'Jame Gam t-shirt',        name: 'jame gam t-shirt',       c: '#97db91', s: 96,  r: 8,   sized: true, note: ' (preorder, ships early aug)', blurb: 'official jame gam shirt! preorder - ships early august. the design shown is a placeholder, not the real one' }
];

// bench (want, but too pricey for now): raspberry pi 5 (~$80 for the 8gb board,
// more like ~$100 landed with a psu + sd card)

// how many indie games you can take instead of one item from the pool
export const GAME_PICK_COUNT = 3;

// the indie games (you can pick GAME_PICK_COUNT of these instead of one physical
// prize) and everything else, split for the list page + shop. Order preserved.
export const PRIZE_GAMES = PRIZES.filter((p) => p.game);
export const PRIZE_STUFF = PRIZES.filter((p) => !p.game);

// srcs that have a prizehd_{src}.png - a 2x-pixel-grid version for the big
// spots (/shop modal, the your-pick card). Generated from the figma originals
// + steam art (pipeline: claude-workspace/prize-originals). Still missing:
// pico8, aseprite, pixelcomposer, po12, wacom, kenney.
export const PRIZE_HD = new Set([
  'artofgamedesign', 'babaisyou', 'camera', 'celeste', 'controller', 'duck',
  'hollowknight', 'mascot', 'shark', 'steam', 'thumby',
  'balatro', 'stardew', 'pizzatower', 'vampiresurvivors', 'tunic',
  'outerwilds', 'papersplease', 'lethalcompany', 'undertale',
  'ashorthike', 'downwell', 'inscryption', 'animalwell', 'obradinn',
  'thomaswasalone', 'superhexagon', 'hotlinemiami', 'supermeatboy', 'crueltysquad',
  'silksong',
  'deltarune', 'megabonk', 'otamatone', 'ceiling', 'minecraft', 'gmtkhoodie',
  'fangamer', 'magazine',
  'terraria', 'omori', 'oneshot', 'bandcamp', 'tshirt', 'nektar', 'stylophone'
]);
