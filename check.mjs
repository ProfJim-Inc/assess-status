/**
 * One round of checks (run every five minutes by .github/workflows/check.yml): each target in
 * checks.json is fetched without following redirects; it is up when the status is one it expects.
 * A miss is retried once after 10 seconds, so one dropped request is not an outage. A target with a
 * `fallback` uses it only when the main URL is 404 (a health endpoint not deployed yet).
 * Results go to site/data/summary.json: per target, a tally per day (90 days) and the last 288 checks.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const targets = JSON.parse(readFileSync('checks.json', 'utf8'));
const file = 'site/data/summary.json';
let summary;
try {
  summary = JSON.parse(readFileSync(file, 'utf8'));
} catch {
  summary = { targets: {} };
}

async function once(url, expect) {
  const start = performance.now();
  try {
    const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000), headers: { 'user-agent': 'creatium-assess-status (+https://status.assess.creatium.com)' } });
    return { ok: expect.includes(r.status), status: r.status, ms: Math.round(performance.now() - start) };
  } catch (error) {
    return { ok: false, status: 0, ms: Math.round(performance.now() - start), error: String(error?.cause?.code ?? error?.name ?? error) };
  }
}

async function probe(t) {
  const attempt = async () => {
    const r = await once(t.url, t.expect);
    return !r.ok && r.status === 404 && t.fallback ? once(t.fallback.url, t.fallback.expect) : r;
  };
  const first = await attempt();
  if (first.ok) {return first;}
  await new Promise((done) => setTimeout(done, 10_000));
  return attempt();
}

const now = new Date();
const day = now.toISOString().slice(0, 10);
const oldest = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);
const results = await Promise.all(targets.map(probe));
targets.forEach((t, i) => {
  const r = results[i];
  const s = (summary.targets[t.id] ??= { days: {}, recent: [] });
  Object.assign(s, { name: t.name, group: t.group });
  const d = (s.days[day] ??= { checks: 0, up: 0, ms: 0 });
  d.checks += 1;
  d.up += r.ok ? 1 : 0;
  d.ms += r.ms;
  s.recent = [...s.recent, { at: now.toISOString(), ok: r.ok, status: r.status, ms: r.ms }].slice(-288);
  for (const k of Object.keys(s.days)) {if (k < oldest) {delete s.days[k];}}
  console.log(`${r.ok ? 'up  ' : 'DOWN'} ${t.name}: ${r.status} in ${r.ms} ms${r.error ? ` (${r.error})` : ''}`);
});
for (const id of Object.keys(summary.targets)) {if (!targets.some((t) => t.id === id)) {delete summary.targets[id];}}
summary.order = targets.map((t) => t.id);
summary.checkedAt = now.toISOString();
writeFileSync(file, `${JSON.stringify(summary)}\n`);
