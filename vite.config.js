import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// When tunneling the dev server over bore, set TUNNEL_HMR to the public host
// (e.g. bore.gus.ink) so HMR's websocket phones home through the TLS endpoint
// on 443 instead of localhost:<devport>. Unset for normal local dev.
const tunnelHost = process.env.TUNNEL_HMR;

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    allowedHosts: ['bore.gus.ink', 'bore2.gus.ink', 'gus.ink'],
    ...(tunnelHost
      ? { hmr: { host: tunnelHost, protocol: 'wss', clientPort: 443 } }
      : {})
  }
});
