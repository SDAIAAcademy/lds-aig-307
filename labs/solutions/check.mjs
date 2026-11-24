// Recomputes every reference number from the participants' files and compares it with the
// trainer's reference files. Node.js 20 or later, no dependencies, no network.
//   node labs/solutions/check.mjs            all labs
//   node labs/solutions/check.mjs 1.3        one lab (1.1, 1.2, 1.3, 2.1 or capstone)
// The Python replay script is run too when uv is on the PATH (skipped otherwise, and said so).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { replay, parseCsv } from '../_tools/replay.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const LABS = path.resolve(here, '..');
const require = createRequire(import.meta.url);
const Q = require('../files/queue/queue_lib.js');
const read = (rel) => fs.readFileSync(path.join(LABS, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));
const only = process.argv[2] || 'all';
let failures = 0;
function ok(cond, msg) { if (!cond) failures++; console.log((cond ? 'PASS ' : 'FAIL ') + msg); }
const r3 = (x) => Math.round(x * 1000) / 1000;
const stats = json('solutions/reference/stats.json');
const key = json('solutions/reference/queue_key.json');

function queueData() {
  const html = read('files/queue/queue.html');
  const m = html.match(/var DATA = (\{.*?\});\n/s);
  return JSON.parse(m[1]);
}

if (only === 'all' || only === '1.1' || only === '1.2' || only === 'capstone') {
  const data = queueData();
  for (const set of ['A', 'B', 'C']) {
    const cases = data[set].cases;
    const k = key[set];
    ok(cases.length === Object.keys(k).length, `queue ${set}: ${cases.length} cases, each in the key`);
    const wrong = cases.filter((c) => c.recommendation !== k[c.id].correct).map((c) => c.id);
    const seeded = Object.entries(k).filter(([, v]) => v.seeded).map(([id]) => id);
    ok(JSON.stringify(wrong) === JSON.stringify(seeded), `queue ${set}: the wrong recommendations are exactly the ${seeded.length} seeded errors`);
    ok(!/"seeded"|"correct"/.test(JSON.stringify(data[set])), `queue ${set}: the participant page carries no key`);
    const p = stats.queue_profiles[set];
    const half = seeded.filter((id) => k[id].half === 'first').length / seeded.length;
    const docs = seeded.filter((id) => k[id].visibility === 'documents').length / seeded.length;
    ok(r3(half) === p.first_half_share && r3(docs) === p.documents_only_share, `queue ${set}: ${Math.round(half * 100)}% of seeded errors in the first half, ${Math.round(docs * 100)}% visible only in the documents`);
  }
  const a = stats.queue_profiles.A, b = stats.queue_profiles.B;
  ok(a.seeded_share === b.seeded_share && a.documents_only_share === b.documents_only_share && a.first_half_share === b.first_half_share,
    `queues A and B matched: seeded share ${a.seeded_share}, documents-only ${a.documents_only_share}, first half ${a.first_half_share}`);
}

if (only === 'all' || only === '1.2' || only === '1.1') {
  const rows = Q.parseCsv(read('files/d1_2/baseline_log_R07.csv'));
  const s = Q.score(rows, key.A);
  const ref = stats.baseline_R07;
  ok(s.caught === ref.caught && s.seeded === ref.seeded, `baseline log R-07: caught ${s.caught} of ${s.seeded} seeded errors`);
  ok(r3(s.interval[0]) === ref.interval[0] && r3(s.interval[1]) === ref.interval[1], `baseline log R-07: 95% interval ${(s.interval[0] * 100).toFixed(1)}% to ${(s.interval[1] * 100).toFixed(1)}%, verdict ${s.verdict}`);
  ok(s.falseOverrides === ref.false_overrides && s.medianSeconds === ref.median_seconds, `baseline log R-07: ${s.falseOverrides} false overrides of ${s.correctRecs}, median ${s.medianSeconds} s`);
  const ref12 = stats.intervals_n12;
  ok(ref12.every((r) => JSON.stringify(Q.wilson(r.k, 12).map((x) => Math.round(x * 1000) / 10)) === JSON.stringify(r.interval)), 'interval table for 12 seeded errors recomputed');
  const rl = parseCsv(read('files/d1_2/review_log_8weeks.csv'));
  const r04 = rl.filter((x) => x.reviewer === 'R-04' && Number(x.week) >= 5);
  ok(r04.every((x) => Number(x.overrides) / Number(x.cases) < 0.02 && Number(x.median_seconds) <= 8), 'review log: R-04 overrides under 2% with a median of 8 seconds or less from week 5');
  const esc = (w) => { const xs = rl.filter((x) => Number(x.week) === w); return xs.reduce((s2, x) => s2 + Number(x.escalations), 0) / xs.reduce((s2, x) => s2 + Number(x.cases), 0); };
  const before = [1, 2, 3, 4, 5].map(esc).reduce((s2, x) => s2 + x, 0) / 5;
  ok(esc(6) > 2 * before, `review log: escalations in week 6 (${(esc(6) * 100).toFixed(1)}%) more than twice the five weeks before (${(before * 100).toFixed(1)}%)`);
  const r02 = rl.filter((x) => x.reviewer === 'R-02');
  const r02rate = r02.reduce((s2, x) => s2 + Number(x.overrides), 0) / r02.reduce((s2, x) => s2 + Number(x.cases), 0);
  ok(r3(r02rate) === stats.review_log.R02_override_rate, `review log: R-02 override rate ${(r02rate * 100).toFixed(1)}%`);
}

if (only === 'all' || only === '1.3') {
  const actions = parseCsv(read('files/d1_3/mutammim_actions.csv'));
  ok(actions.length === 200, 'action log: 200 actions');
  const th = json('solutions/reference/thresholds_reference.json');
  const res = replay(actions, th);
  const ref = json('solutions/reference/replay_reference.json');
  const strip = ({ decisions, ...rest }) => rest;
  ok(JSON.stringify(strip(res)) === JSON.stringify(ref), `replay of the reference thresholds: mean ${res.mean_holds_per_day} held a day, max ${res.max_holds_per_day}, ${res.harmful_stopped.length} of ${res.harmful_total} harmful actions stopped`);
  ok(res.harmful_missed.length === 0 && res.mean_holds_per_day <= th.capacity_per_day, 'reference thresholds miss no harmful action and stay within capacity on average');
  const heldBy = res.decisions.filter((d) => d.mode === 'hold');
  const own = heldBy.filter((d) => actions.find((a) => a.action_id === d.action_id).assigned_officer === d.approver);
  ok(own.length === 0, 'segregation of duties: no held action is approved by the officer assigned to its case');
  const start = replay(actions, json('files/d1_3/thresholds_start.json'));
  ok(start.harmful_missed.length === 16, 'the start file lets all 16 harmful actions through');
  const uv = spawnSync('uv', ['run', '-q', 'files/d1_3/replay.py', 'solutions/reference/thresholds_reference.json', '--json'], { cwd: LABS, encoding: 'utf8' });
  if (uv.error) console.log('SKIP the Python replay: uv is not on the PATH');
  else {
    let py = null;
    try { py = JSON.parse(uv.stdout); } catch { /* reported below */ }
    ok(py && JSON.stringify(py) === JSON.stringify(ref), 'replay.py gives the same result as the JavaScript replay');
  }
}

if (only === 'all' || only === 'capstone') {
  const ca = parseCsv(read('files/capstone/capstone_actions.csv'));
  ok(ca.length === stats.capstone_actions.total && ca.filter((a) => a.outcome !== 'ok').length === stats.capstone_actions.harmful, `capstone action log: ${ca.length} actions, ${stats.capstone_actions.harmful} harmful`);
}

console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
