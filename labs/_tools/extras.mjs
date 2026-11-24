// Numbers quoted in the stretch answers, the slides and the bank that build.mjs does not write.
// Run from the course root after build.mjs:  node labs/_tools/extras.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const REF = path.resolve(here, '..', 'solutions', 'reference');
const require = createRequire(import.meta.url);
const Q0 = require("../files/queue/queue_lib.js");
const Q = { wilson: (k, n) => { const [lo, hi] = Q0.wilson(k, n); return { lo, hi }; }, verdict: Q0.verdict };
const pct = (x) => Math.round(x * 1000) / 10;
const stats = JSON.parse(fs.readFileSync(path.join(REF, 'stats.json'), 'utf8'));
const rep = JSON.parse(fs.readFileSync(path.join(REF, 'replay_reference.json'), 'utf8'));

// Stretch 1.2: seeded errors per month so that observed 85% and observed 70% give intervals that do not overlap
let nSep = null;
for (let n = 4; n <= 400; n++) {
  const hi = Q.wilson(Math.round(0.85 * n), n);
  const lo = Q.wilson(Math.round(0.70 * n), n);
  if (Math.round(0.85 * n) / n >= 0.849 && Math.round(0.70 * n) / n <= 0.701 && lo.hi < hi.lo) { nSep = { n, at85: [pct(hi.lo), pct(hi.hi)], at70: [pct(lo.lo), pct(lo.hi)] }; break; }
}

// Stretch 1.3: headroom under the approvers' capacity with the reference thresholds
const ref = rep.reference || rep;
const cap = 10;
const headroom = { mean_holds_per_day: ref.mean_holds_per_day, capacity: cap, mean_headroom: Math.round((cap - ref.mean_holds_per_day) * 10) / 10, busiest_day_holds: ref.max_holds_per_day };

// Slide example (signage department, parallel to lab 1.1): 7 of 10 caught
const sign = Q.wilson(7, 10);
// Bank items: worked numbers used in questions (different from every lab number)
const bank = {
  k9_n15: (() => { const w = Q.wilson(9, 15); return [pct(w.lo), pct(w.hi), Q.verdict(w.lo, w.hi)]; })(),
  k38_n40: (() => { const w = Q.wilson(38, 40); return [pct(w.lo), pct(w.hi), Q.verdict(w.lo, w.hi)]; })(),
  k95_n100: (() => { const w = Q.wilson(95, 100); return [pct(w.lo), pct(w.hi), Q.verdict(w.lo, w.hi)]; })(),
  k14_n30: (() => { const w = Q.wilson(14, 30); return [pct(w.lo), pct(w.hi), Q.verdict(w.lo, w.hi)]; })(),
};

// Dossier A (lab 2.1): 6 of 200 audited renewals wrong; 410 renewals a year would enter the fast lane
const da = Q.wilson(6, 200);
const dossierA = { audit: [6, 200], rate_interval: [pct(da.lo), pct(da.hi)], per_year: Math.round(410 * 6 / 200 * 10) / 10, per_year_range: [Math.round(410 * da.lo), Math.round(410 * da.hi)] };
// Dossier B: 396 of 1800 inspections found a violation
const db = Q.wilson(396, 1800);
const dossierB = { base: [396, 1800], rate_interval: [pct(db.lo), pct(db.hi)] };

// Checkpoint 2 (day 1): 4 of 10 before, 7 of 10 after, in another organisation
const cp2 = { before: (() => { const w = Q.wilson(4, 10); return [pct(w.lo), pct(w.hi)]; })(), after: (() => { const w = Q.wilson(7, 10); return [pct(w.lo), pct(w.hi)]; })() };
cp2.overlap = cp2.before[1] >= cp2.after[0];

const out = { checkpoint_day1_2: cp2, dossier_A: dossierA, dossier_B: dossierB, generated_by: 'labs/_tools/extras.mjs', stretch_1_2_separation: nSep, stretch_1_3_headroom: headroom, slide_signage_7_of_10: [pct(sign.lo), pct(sign.hi), Q.verdict(sign.lo, sign.hi)], bank, check_seeded_needed_at_90: stats.seeded_needed_at_90 };
fs.writeFileSync(path.join(REF, 'extras.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out));
