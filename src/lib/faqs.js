// the FAQ list. single source of truth, imported by both the visible accordion
// (Questions.svelte) and the FAQPage JSON-LD in +page.svelte, so the two can't
// drift. answers stay in the site's lowercase, friendly voice.
export const FAQS = [
  {
    q: 'what\'s the catch? is this legit?',
    a: 'yes! jame gam is run by <a href="https://hackclub.com" target="_blank" rel="noopener">Hack Club</a>, a 501(c)(3) nonprofit. Hack Club is supported by partners like GitHub, AMD, NASA, FUTO, Proton, and more. <a href="https://gamedev.hackclub.com" target="_blank" rel="noopener">click here</a> to see some of the game jams we\'ve run in the past!'
  },
  {
    q: "i'm not experienced :p",
    a: "perfect, that's kinda the point :)  the best way to get good at making games is to do game jams! we'll point you at tools and you figure out the rest as you go."
  },
  {
    q: "i'm too busy :(",
    a: "we run jams every month! if you can't make this one, you're still welcome in the community, and we'd love to see you at the next one. most of the jams we join are 4-8 days long, so you can also join in the middle!"
  },
  {
    q: 'what if my game is bad?',
    a: "good. everyone who puts in effort gets a prize, that's the whole point :)"
  },
  {
    q: "i'm not in the us...",
    a: "not a problem, jame gam is international & i'll ship you stickers wherever you live"
  },
  {
    q: "i don't know anyone! do i need a team?",
    a: 'nope, but if you want one, you can find one in the <a href="https://slack.hackclub.com/" target="_blank" rel="noopener">hack club slack</a>!'
  },
  {
    q: 'can i use premade asset packs?',
    a: "if you want, yes! just make sure you credit everything you didn't make yourself in your game's description :)"
  },
  {
    q: 'can i use ai?',
    a: 'you <span class="faq-em">may not</span> use generative ai for art or audio. you can use ai to help you code, but it\'s mildly discouraged :p'
  },
  {
    q: "i'm 12 / i'm 19, can i join?",
    a: "sorry! jame gam is only open to those between the ages of 13 and 18 :("
  },
  {
    q: 'do i need to use hackatime to track my time?',
    a: '<a href="https://hackatime.hackclub.com/" target="_blank" rel="noopener">hackatime</a> is optional for jame gam, but if you track your time, you\'ll get sent a special bonus sticker! <span class="faq-dim">this is a test, so this might change in the future</span>'
  },
  {
    q: "what is this glorious font?",
    a: 'i drew it just for this, you can download it <a href="/fonts/augiepixel.ttf" download>here</a>'
  },
  {
    q: 'what did you use to make this site?',
    a: 'this site was built using <a href="https://svelte.dev" target="_blank" rel="noopener">sveltekit 5</a>. i drew all the art by hand using <a href="https://www.aseprite.org" target="_blank" rel="noopener">aseprite</a>. the doodles on the edges were drawn by <a href="https://github.com/bucketfish/" target="_blank" rel="noopener">tongyu</a> and <a href="https://www.instagram.com/willdoesbuild" target="_blank" rel="noopener">willsbuilds</a>, and the original 3d shark model is by <a href="https://github.com/bucketfish/" target="_blank" rel="noopener">tongyu</a>. the font for the email input is <a href="https://elements.envato.com/marylin-pixel-4A7XPCT" target="_blank" rel="noopener">cs marylin pixel</a>.'
  },
  {
    q: 'i have more questions! i wanna talk to you!',
    a: 'reach out to me at <a class="email-obf" data-u="eigua" data-d="moc.bulckcah">augie on hackclub.com</a>! if you\'re in the hack club slack, you can also message me <a href="https://hackclub.enterprise.slack.com/team/U07FCRNHS1J" target="_blank" rel="noopener">@augie</a>, or just send a message in <a href="https://hackclub.enterprise.slack.com/archives/C0BBFQASBV2" target="_blank" rel="noopener">#jame-gam</a>!'
  }
];
