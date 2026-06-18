// Best-effort in-memory IP limiter. On Vercel each warm instance keeps its own
// map, so this only throttles bursts within one instance - NOT a hard global
// cap. The real launch backstops are the honeypot + Airtable email-dedupe; the
// upgrade path if abused is Upstash Redis.
const HITS = new Map(); // ip -> { count, resetAt }
const WINDOW_MS = 60_000;
const MAX = 5;

export function rateLimit(ip) {
  const now = Date.now();
  const rec = HITS.get(ip);
  if (!rec || now > rec.resetAt) {
    HITS.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (rec.count >= MAX) return false;
  rec.count++;
  return true;
}
