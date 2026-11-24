// Writes the case study's data files, the queue page and the trainer's reference files.
// Run from the course root:  node labs/_tools/build.mjs
// Fixed seeds: the output is the same on every run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  DECISIONS, ACTIVITIES, RULES, ERROR_TYPES, PLAN, C_DECISIONS, C_RULES, C_ERROR_TYPES, C_PLAN,
  MINOR_FINDINGS, MAJOR_FINDINGS, ACTION_TYPES, OFFICERS, DAYS, C_ACTION_TYPES,
} from './case.mjs';
import { replay } from './replay.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const LABS = path.resolve(here, '..');
const FILES = path.join(LABS, 'files');
const REF = path.join(LABS, 'solutions', 'reference');
const require = createRequire(import.meta.url);
const Q = require('../files/queue/queue_lib.js');

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
function write(rel, text) {
  const p = path.join(LABS, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text.endsWith('\n') ? text : text + '\n');
}
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCsv = (cols, rows) => [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';
const r3 = (x) => Math.round(x * 1000) / 1000;

// ---------------------------------------------------------------- permit queue (sets A, B)
function decide(c) {
  if (c.activityCat === 'notHome') return ['refuse', 'R1'];
  if (c.violation && c.violation.sameAddress && !c.violation.settled) return ['refuse', 'R6'];
  const limit = c.home === 'شقة' ? 5 : 15;
  if (c.visitors > limit) return ['refuse', 'R4'];
  if (c.activityCat === 'food' && (!c.cert || c.cert.expiry < c.appDate)) return ['request', 'R2'];
  if (c.tenure === 'إيجار' && !c.consent) return ['request', 'R3'];
  if (c.idExpiry < c.appDate) return ['request', 'R5'];
  return ['approve', ''];
}

function reasonFor(decision, rule, c) {
  if (decision === 'approve') return 'النشاط مسموح، والمستندات المطلوبة مكتملة، ولا مخالفة على العنوان';
  return {
    R1: `النشاط «${c.activity}» غير مسموح منزليًا (R1)`,
    R6: 'مخالفة غير مسوّاة على العنوان خلال 12 شهرًا (R6)',
    R4: `الزوار المتوقعون ${c.visitors} يوميًا فوق حد ${c.home === 'شقة' ? 'الشقة' : 'السكن'} (R4)`,
    R2: 'الشهادة الصحية غير مرفقة أو منتهية في تاريخ الطلب (R2)',
    R3: 'خطاب موافقة المالك غير مرفق (R3)',
    R5: 'الهوية منتهية في تاريخ الطلب (R5)',
  }[rule];
}

function baseCase(r, target) {
  // target: 'approve' or a rule id that must decide the case
  const c = {};
  c.kind = r() < 0.7 ? 'جديد' : 'تجديد';
  c.home = r() < 0.45 ? 'شقة' : r() < 0.75 ? 'فيلا' : 'دور مستقل';
  c.tenure = r() < 0.55 ? 'ملك' : 'إيجار';
  c.appDate = addDays('2027-02-21', int(r, 0, 10));
  c.idExpiry = addDays(c.appDate, int(r, 200, 1800));
  c.activityCat = r() < 0.3 ? 'food' : 'permitted';
  c.activity = pick(r, ACTIVITIES[c.activityCat]);
  c.visitors = c.home === 'شقة' ? int(r, 0, 5) : int(r, 0, 15);
  c.cert = c.activityCat === 'food' ? { no: 'HC-' + int(r, 10000, 99999), expiry: addDays(c.appDate, int(r, 30, 700)) } : null;
  c.consent = c.tenure === 'إيجار';
  c.building = int(r, 1, 98);
  c.unit = c.home === 'شقة' ? String(int(r, 1, 12)) : '';
  c.violation = r() < 0.1 ? { sameAddress: true, settled: true, date: addDays(c.appDate, -int(r, 30, 300)) } : null;
  c.lang = r() < 0.2 ? 'en' : 'ar';
  c.channel = r() < 0.65 ? 'الموقع' : 'مركز الخدمة';
  c.applicant = 'A-' + int(r, 10000, 99999);
  switch (target) {
    case 'R1': c.activityCat = 'notHome'; c.activity = pick(r, ACTIVITIES.notHome); c.cert = null; break;
    case 'R6': c.violation = { sameAddress: true, settled: false, date: addDays(c.appDate, -int(r, 20, 330)) }; break;
    case 'R4': c.visitors = c.home === 'شقة' ? int(r, 7, 12) : int(r, 18, 25); break;
    case 'R2':
      c.activityCat = 'food'; c.activity = pick(r, ACTIVITIES.food);
      c.cert = r() < 0.5 ? null : { no: 'HC-' + int(r, 10000, 99999), expiry: addDays(c.appDate, -int(r, 10, 200)) };
      break;
    case 'R3': c.tenure = 'إيجار'; c.consent = false; break;
    case 'R5': c.idExpiry = addDays(c.appDate, -int(r, 5, 120)); break;
    default: break;
  }
  return c;
}

function seededCase(r, type) {
  let c;
  const ok = () => decide(c)[0];
  // build until the true decision is the intended one
  for (;;) {
    c = baseCase(r, 'approve');
    c.shown = {};
    if (type === 'T1') {
      c.activityCat = 'food'; c.activity = pick(r, ACTIVITIES.food);
      c.cert = { no: 'HC-' + int(r, 10000, 99999), expiry: addDays(c.appDate, -int(r, 15, 120)) };
      c.shown.certExpiry = addDays(c.cert.expiry, 365);
      if (decide(c).join() === 'request,R2') return finish(c, 'approve', type);
    } else if (type === 'T2') {
      c.tenure = 'إيجار'; c.consent = false; c.shown.consent = true;
      if (decide(c).join() === 'request,R3') return finish(c, 'approve', type);
    } else if (type === 'T3') {
      c.activityCat = 'permitted'; c.activity = pick(r, ['تصميم داخلي على الحاسب', 'إعداد مخططات هندسية على الحاسب']); c.cert = null;
      if (ok() === 'approve') return finish(c, 'refuse', type);
    } else if (type === 'T4') {
      c.home = 'شقة'; c.unit = String(int(r, 1, 12)); c.visitors = int(r, 8, 10);
      if (decide(c).join() === 'refuse,R4') return finish(c, 'approve', type);
    } else if (type === 'T5') {
      const b = c.building;
      const other = Number(String(b).padStart(2, '0').split('').reverse().join(''));
      if (other === b || other < 1) continue;
      c.violation = { sameAddress: false, settled: false, date: addDays(c.appDate, -int(r, 20, 300)), building: other };
      c.shown.violationOpen = true;
      if (ok() === 'approve') return finish(c, 'refuse', type);
    } else if (type === 'T6') {
      c.idExpiry = addDays(c.appDate, -int(r, 5, 90));
      if (decide(c).join() === 'request,R5') return finish(c, 'approve', type);
    }
  }
  function finish(cs, rec, t) { cs.rec = rec; cs.errorType = t; return cs; }
}

function render(c) {
  const [correct, rule] = decide(c);
  const certShown = c.cert ? (c.shown?.certExpiry ?? c.cert.expiry) : null;
  const consentShown = c.tenure === 'إيجار' ? (c.shown?.consent ?? c.consent) : null;
  const violOpenShown = c.shown?.violationOpen ?? (c.violation && c.violation.sameAddress && !c.violation.settled);
  const address = `المبنى ${c.building}` + (c.unit ? `، الوحدة ${c.unit}` : '');
  const summary = [
    ['نوع الطلب', c.kind],
    ['النشاط', c.activity],
    ['نوع السكن', c.home],
    ['الحيازة', c.tenure],
    ['العنوان', address],
    ['الزوار المتوقعون يوميًا', String(c.visitors)],
    ['تاريخ الطلب', c.appDate],
    ['انتهاء الهوية', c.idExpiry],
  ];
  if (c.tenure === 'إيجار') summary.push(['موافقة المالك', consentShown ? 'مرفقة' : 'غير مرفقة']);
  if (c.activityCat === 'food') summary.push(['الشهادة الصحية', c.cert ? `${c.cert.no}، تنتهي ${certShown}` : 'غير مرفقة']);
  summary.push(['مخالفات على العنوان', violOpenShown ? 'مخالفة غير مسوّاة' : c.violation ? 'مخالفة سابقة مسوّاة' : 'لا توجد']);
  summary.push(['لغة التواصل', c.lang === 'en' ? 'الإنجليزية' : 'العربية']);
  summary.push(['قناة التقديم', c.channel]);
  const docs = [];
  docs.push({ title: 'نموذج الطلب', lines: [`مقدم الطلب: ${c.applicant}`, `النشاط كما كتبه مقدم الطلب: ${c.activity}`, `العنوان: ${address}`, `عدد الزوار المتوقع يوميًا: ${c.visitors}`] });
  docs.push({ title: 'الهوية', lines: [`تاريخ الانتهاء: ${c.idExpiry}`] });
  docs.push({ title: c.tenure === 'ملك' ? 'صك الملكية' : 'عقد الإيجار', lines: [`العنوان: ${address}`, c.tenure === 'ملك' ? 'المالك: مقدم الطلب' : `مدة العقد: سنة تبدأ ${addDays(c.appDate, -int(rng(c.building), 20, 200))}`] });
  if (c.tenure === 'إيجار') docs.push(c.consent ? { title: 'خطاب موافقة المالك', lines: ['يوافق المالك على مزاولة النشاط في الوحدة.'] } : { title: 'المرفقات', lines: ['لم يُرفق خطاب موافقة المالك. الملف المرفق باسمه صورة ثانية لعقد الإيجار.'] });
  if (c.activityCat === 'food') docs.push(c.cert ? { title: 'الشهادة الصحية', lines: [`الرقم: ${c.cert.no}`, `تاريخ الانتهاء: ${c.cert.expiry}`] } : { title: 'الشهادة الصحية', lines: ['لم تُرفق.'] });
  if (c.violation) {
    const vb = c.violation.building ?? c.building;
    docs.push({ title: 'سجل المخالفات', lines: [`المخالفة على: المبنى ${vb}` + (c.unit ? `، الوحدة ${c.unit}` : ''), `التاريخ: ${c.violation.date}`, `الحالة: ${c.violation.settled ? 'مسوّاة' : 'غير مسوّاة'}`] });
  }
  const recRule = c.errorType === 'T3' ? 'R1' : c.errorType === 'T5' ? 'R6' : rule;
  const reason = c.errorType === 'T3'
    ? `النشاط مصنف ضمن «أعمال إنشائية في الموقع» غير المسموحة منزليًا (R1)`
    : c.errorType === 'T5' ? 'مخالفة غير مسوّاة على العنوان خلال 12 شهرًا (R6)'
      : c.errorType ? reasonFor('approve', '', c) : reasonFor(correct, rule, c);
  return { summary, docs, rec: c.rec ?? correct, reason, correct, rule, recRule };
}

function buildSet(name) {
  const plan = PLAN[name];
  const r = rng(plan.seed);
  const cases = [];
  const key = {};
  for (let pos = 1; pos <= plan.size; pos++) {
    const type = plan.errors[pos];
    let c;
    if (type) c = seededCase(r, type);
    else {
      const u = r();
      const target = u < 0.55 ? 'approve' : u < 0.8 ? pick(r, ['R2', 'R3', 'R5']) : pick(r, ['R1', 'R4', 'R6']);
      c = baseCase(r, target);
    }
    const v = render(c);
    const id = `${name}-${String(pos).padStart(2, '0')}`;
    const conf = type ? 0.58 + r() * 0.28 : 0.72 + r() * 0.26;
    cases.push({ id, position: pos, summary: v.summary, documents: v.docs, recommendation: v.rec, reason: v.reason, confidence: Math.round(conf * 100) / 100, lang: c.lang });
    key[id] = { correct: v.correct, seeded: Boolean(type), type: type || '', visibility: type ? ERROR_TYPES[type].visibility : '', direction: type ? ERROR_TYPES[type].direction : '', half: pos <= plan.size / 2 ? 'first' : 'second', rule: v.rule };
    if (!type && v.rec !== v.correct) throw new Error('unseeded case with a wrong recommendation: ' + id);
    if (type && v.rec === v.correct) throw new Error('seeded case with a right recommendation: ' + id);
  }
  return { cases, key };
}

// ---------------------------------------------------------------- capstone queue C
function buildC() {
  const r = rng(C_PLAN.seed);
  const cases = []; const key = {};
  for (let pos = 1; pos <= C_PLAN.size; pos++) {
    const type = C_PLAN.errors[pos];
    let major = r() < 0.3, photo = r() < 0.85, corrected = r() < 0.12, prior = r() < 0.2;
    if (type === 'C1') { major = false; photo = true; corrected = false; prior = false; }
    if (type === 'C2') { major = false; photo = true; corrected = false; prior = true; }
    if (type === 'C3') { photo = true; corrected = true; }
    if (type === 'C4') { major = true; photo = true; corrected = false; }
    const finding = major ? pick(r, MAJOR_FINDINGS) : pick(r, MINOR_FINDINGS);
    const correct = !photo ? 'none' : corrected ? 'none' : (major || prior) ? 'fine' : 'warning';
    const rule = !photo ? 'V1' : corrected ? 'V2' : (major || prior) ? 'V3' : 'V4';
    const rec = type === 'C1' ? 'fine' : type === 'C2' ? 'warning' : type === 'C3' ? (major ? 'fine' : 'warning') : type === 'C4' ? 'warning' : correct;
    const priorShown = type === 'C2' ? false : prior;
    const id = `C-${String(pos).padStart(2, '0')}`;
    const permit = 'HBP-' + int(r, 1000, 9999);
    const visit = addDays('2027-04-04', int(r, 0, 9));
    const priorDate = addDays(visit, -int(r, 30, 160));
    const summary = [
      ['رقم التصريح', permit], ['تاريخ المعاينة', visit], ['الملاحظة', finding],
      ['درجة الملاحظة', major ? 'جسيمة' : 'بسيطة'], ['صورة أو قراءة مرفقة', photo ? 'نعم' : 'لا'],
      ['صُححت أثناء الزيارة', 'لا'], ['ملاحظات سابقة على التصريح خلال 6 أشهر', priorShown ? 'واحدة' : 'لا توجد'],
    ];
    const docs = [
      { title: 'تقرير المعاينة', lines: [`الملاحظة: ${finding}`, photo ? 'أُرفقت صورتان.' : 'لم تُرفق صورة ولا قراءة.', corrected ? 'ملاحظة المراقب: صحّح صاحب التصريح الملاحظة أثناء الزيارة وتحققتُ من ذلك.' : 'ملاحظة المراقب: لا شيء.'] },
      { title: 'سجل التصريح', lines: [prior ? `${priorDate}: ${finding}، إنذار` : 'لا ملاحظات سابقة خلال 6 أشهر.'] },
    ];
    const recReason = { none: 'لا تسند الملاحظةَ صورةٌ أو صُححت (V1، V2)', warning: 'ملاحظة بسيطة أولى (V4)', fine: 'ملاحظة جسيمة أو متكررة (V3)' }[rec];
    const conf = type ? 0.6 + r() * 0.27 : 0.72 + r() * 0.26;
    cases.push({ id, position: pos, summary, documents: docs, recommendation: rec, reason: recReason, confidence: Math.round(conf * 100) / 100 });
    key[id] = { correct, seeded: Boolean(type), type: type || '', visibility: type ? C_ERROR_TYPES[type].visibility : '', direction: type ? C_ERROR_TYPES[type].direction : '', half: pos <= C_PLAN.size / 2 ? 'first' : 'second', rule };
    if (Boolean(type) === (rec === correct)) throw new Error('queue C key mismatch at ' + id);
  }
  return { cases, key };
}

// ---------------------------------------------------------------- supplied baseline log (reviewer R-07, set A)
function baselineLog(setA, keyA) {
  // A scripted reviewer, written to show the pattern of an unaided reviewer under time pressure.
  // It is not a measurement of anyone.
  const r = rng(7007);
  const caughtSummary = { 4: ['override', 'approve'], 15: ['override', 'refuse'], 39: ['override', 'refuse'], 58: ['escalate', ''] };
  const caughtDocs = { 19: ['override', 'request'] };
  const timeouts = new Set([31, 49, 55]);
  const falseOverrides = { 12: 'request', 47: 'refuse' };
  const openDocs = new Set([2, 7, 11, 19, 22, 26, 33, 41, 46, 52]);
  return setA.cases.map((c) => {
    const p = c.position;
    let decision = 'agree', final = c.recommendation;
    if (caughtSummary[p]) [decision, final] = caughtSummary[p];
    if (caughtDocs[p]) [decision, final] = caughtDocs[p];
    if (falseOverrides[p]) { decision = 'override'; final = falseOverrides[p]; }
    if (timeouts.has(p)) { decision = 'timeout'; final = c.recommendation; }
    if (decision === 'escalate') final = '';
    const seconds = decision === 'timeout' ? 45 : openDocs.has(p) ? int(r, 28, 44) : int(r, 9, 30);
    return { session: 'R-07', set: 'A', levers: '', position: p, case_id: c.id, shown: c.recommendation, own_first: '', decision, final, seconds, opened_documents: openDocs.has(p) ? 'yes' : 'no', checklist: '' };
  });
}

// ---------------------------------------------------------------- eight weeks of the review step in production
function reviewLog() {
  const r = rng(8008);
  const rows = [];
  for (let w = 1; w <= 8; w++) {
    for (const rv of ['R-01', 'R-02', 'R-03', 'R-04', 'R-05', 'R-06']) {
      const cases = int(r, 140, 170);
      let ov = 0.06 + r() * 0.03, esc = 0.02 + r() * 0.01, sec = int(r, 25, 40);
      if (rv === 'R-02') ov = 0.17 + r() * 0.03; // handles the English-language applications
      if (rv === 'R-04' && w >= 5) { ov = r() < 0.5 ? 0 : 1 / cases; esc = 0; sec = int(r, 6, 8); }
      if (w === 6) esc *= 3; else if (w >= 7) esc *= 2;
      if (rv === 'R-04' && w >= 5) esc = 0;
      rows.push({ week: w, reviewer: rv, murajjih_version: w >= 6 ? '2.4' : '2.3', cases, overrides: Math.round(cases * ov), escalations: Math.round(cases * esc), median_seconds: sec, english_language_share: rv === 'R-02' ? r3(0.7 + r() * 0.1) : r3(0.05 + r() * 0.08) });
    }
  }
  return rows;
}

// ---------------------------------------------------------------- agent action logs
const HARM = {
  suspend_permit: ['complaint_upheld', 'complaint_upheld', 'complaint_upheld'],
  send_refusal_notice: ['reversed_on_appeal', 'reversed_on_appeal', 'reversed_on_appeal', 'reversed_on_appeal'],
  issue_violation_notice: ['reversed_on_appeal', 'reversed_on_appeal'],
  send_bulk_announcement: ['wrong_content'],
  close_inactive_file: ['wrongly_closed', 'wrongly_closed'],
  share_with_inspection: ['over_shared'],
  issue_permit: ['reversed_on_review'],
};
const DAY_WEIGHTS = [1.4, 1, 1, 0.9, 0.8, 1.4, 1, 1, 0.9, 0.7];

function actionLog(types, seed, prefix, casePrefix, harmPlan, dupRefund) {
  const r = rng(seed);
  const list = [];
  for (const t of types) for (let i = 0; i < t.count; i++) list.push({ action_type: t.type });
  // shuffle
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  // days by weight
  const totalW = DAY_WEIGHTS.reduce((s, x) => s + x, 0);
  const perDay = DAY_WEIGHTS.map((w) => Math.round((w / totalW) * list.length));
  perDay[perDay.length - 1] += list.length - perDay.reduce((s, x) => s + x, 0);
  let k = 0;
  perDay.forEach((n, d) => { for (let i = 0; i < n; i++) list[k++].date = DAYS[d]; });
  const harmLeft = JSON.parse(JSON.stringify(harmPlan));
  const byType = {};
  list.forEach((a, i) => {
    a.action_id = `${prefix}-${String(i + 1).padStart(3, '0')}`;
    a.case_id = `${casePrefix}-${int(r, 2000, 2999)}`;
    a.assigned_officer = pick(r, OFFICERS);
    a.amount_sar = '';
    a.recipients = 1;
    a.assisted_channel = r() < 0.25 ? 'yes' : 'no';
    a.outcome = 'ok';
    (byType[a.action_type] = byType[a.action_type] || []).push(a);
  });
  for (const [t, xs] of Object.entries(byType)) {
    if (t === 'refund_fee' || t === 'issue_fine' || t === 'waive_fine') {
      xs.forEach((a, i) => { a.amount_sar = [150, 200, 250, 300, 300, 350, 400, 450, 600, 700, 800, 900, 1000, 1100, 1200][i % 15]; });
    }
    if (t === 'send_bulk_announcement' || t === 'publish_compliance_list') xs.forEach((a) => { a.recipients = int(r, 380, 700); });
    if (t === 'close_inactive_file') xs.forEach((a, i) => { a.assisted_channel = i % 3 === 0 ? 'yes' : 'no'; });
    const harms = harmLeft[t] || [];
    // spread the harmful ones over the list of this type
    harms.forEach((h, i) => {
      const idx = Math.min(xs.length - 1, Math.floor(((i + 0.5) / harms.length) * xs.length));
      xs[idx].outcome = h;
      if (t === 'close_inactive_file') xs[idx].assisted_channel = 'yes';
    });
  }
  if (dupRefund) {
    // a refund paid twice on the same case, below the amount threshold; and one paid to the wrong case above it
    const refunds = byType.refund_fee;
    const first = refunds[2], second = refunds[refunds.length - 3];
    second.case_id = first.case_id; second.amount_sar = first.amount_sar; second.outcome = 'duplicate_refund';
    refunds[refunds.length - 2].outcome = 'paid_to_wrong_case';
  }
  return list;
}

const ACTION_COLS = ['action_id', 'date', 'action_type', 'case_id', 'assigned_officer', 'amount_sar', 'recipients', 'assisted_channel', 'outcome'];

// ---------------------------------------------------------------- thresholds
const START = {
  _note: 'نقطة البداية: كل إجراء تلقائي. غيّر التصنيف والمصفوفة والاستثناءات، ثم شغّل replay.py.',
  capacity_per_day: 10, minutes_per_approval: 5, approvers: ['O-05', 'O-06'],
  action_types: Object.fromEntries(ACTION_TYPES.map((t) => [t.type, { impact: 1, reversibility: 'reversible' }])),
  matrix: { 1: { reversible: 'auto', costly: 'auto', irreversible: 'auto' }, 2: { reversible: 'auto', costly: 'auto', irreversible: 'auto' }, 3: { reversible: 'auto', costly: 'auto', irreversible: 'auto' }, 4: { reversible: 'auto', costly: 'auto', irreversible: 'auto' } },
  overrides: [],
};
const REFERENCE = {
  _note: 'العتبات المرجعية للمدرب. فصل المهام: لا يعتمد الإجراء موظف مسند إليه الملف.',
  capacity_per_day: 10, minutes_per_approval: 5, approvers: ['O-05', 'O-06'],
  action_types: {
    send_reminder: { impact: 1, reversibility: 'reversible' },
    request_documents: { impact: 1, reversibility: 'reversible' },
    schedule_inspection: { impact: 1, reversibility: 'reversible' },
    update_address_record: { impact: 2, reversibility: 'reversible' },
    issue_permit: { impact: 2, reversibility: 'reversible' },
    close_inactive_file: { impact: 2, reversibility: 'costly' },
    share_with_inspection: { impact: 2, reversibility: 'irreversible' },
    refund_fee: { impact: 2, reversibility: 'irreversible' },
    send_refusal_notice: { impact: 3, reversibility: 'costly' },
    issue_violation_notice: { impact: 3, reversibility: 'costly' },
    suspend_permit: { impact: 3, reversibility: 'irreversible' },
    send_bulk_announcement: { impact: 2, reversibility: 'irreversible' },
  },
  matrix: {
    1: { reversible: 'auto', costly: 'auto', irreversible: 'notify' },
    2: { reversible: 'notify', costly: 'notify', irreversible: 'notify' },
    3: { reversible: 'notify', costly: 'hold', irreversible: 'hold' },
    4: { reversible: 'hold', costly: 'hold', irreversible: 'block' },
  },
  overrides: [
    { action_type: 'refund_fee', when: { amount_sar_over: 500 }, mode: 'hold' },
    { action_type: 'refund_fee', when: { repeat_on_case: true }, mode: 'block' },
    { action_type: 'close_inactive_file', when: { assisted_channel: true }, mode: 'hold' },
    { action_type: 'send_bulk_announcement', when: { recipients_over: 50 }, mode: 'hold' },
    { action_type: 'share_with_inspection', when: {}, mode: 'hold' },
  ],
};
const NAIVE_ALL = JSON.parse(JSON.stringify(REFERENCE));
NAIVE_ALL.matrix = { 1: { reversible: 'auto', costly: 'auto', irreversible: 'auto' }, 2: { reversible: 'hold', costly: 'hold', irreversible: 'hold' }, 3: { reversible: 'hold', costly: 'hold', irreversible: 'hold' }, 4: { reversible: 'hold', costly: 'hold', irreversible: 'hold' } };
NAIVE_ALL.overrides = [];
const NAIVE_HIGH = JSON.parse(JSON.stringify(NAIVE_ALL));
NAIVE_HIGH.matrix[2] = { reversible: 'auto', costly: 'auto', irreversible: 'auto' };

// ---------------------------------------------------------------- run
const A = buildSet('A');
const B = buildSet('B');
const C = buildC();

// matching of A and B
function profile(key, types = ERROR_TYPES, decisions = DECISIONS) {
  const seeded = Object.values(key).filter((k) => k.seeded);
  const count = (f) => seeded.filter(f).length;
  return {
    cases: Object.keys(key).length, seeded: seeded.length,
    seeded_share: r3(seeded.length / Object.keys(key).length),
    documents_only_share: r3(count((k) => k.visibility === 'documents') / seeded.length),
    first_half_share: r3(count((k) => k.half === 'first') / seeded.length),
    against_applicant_share: r3(count((k) => k.direction === 'against-applicant') / seeded.length),
    types: Object.fromEntries(Object.keys(types).map((t) => [t, count((k) => k.type === t)])),
    correct_decisions: Object.fromEntries(Object.keys(decisions).map((d) => [d, Object.values(key).filter((k) => k.correct === d).length])),
  };
}

const data = {
  A: { label: 'المجموعة A · 60 طلبًا', options: DECISIONS, rulesTitle: 'قواعد التصاريح', rules: RULES, system: '«مُرجِّح»', item: 'الطلب', cases: A.cases },
  B: { label: 'المجموعة B · 40 طلبًا (بعد إعادة التصميم)', options: DECISIONS, rulesTitle: 'قواعد التصاريح', rules: RULES, system: '«مُرجِّح»', item: 'الطلب', cases: B.cases },
  C: { label: 'المجموعة C · 40 محضرًا (مهمة المتابعة)', options: C_DECISIONS, rulesTitle: 'قواعد المخالفات', rules: C_RULES, system: 'مساعد إشعارات المخالفات', item: 'المحضر', cases: C.cases },
};

const tpl = fs.readFileSync(path.join(here, 'queue.tpl.html'), 'utf8');
write('files/queue/queue.html', tpl.replace('/*DATA*/null', JSON.stringify(data)));

// spreadsheet alternative: the same cases without the key
function sheet(set) {
  return toCsv(['case_id', 'summary', 'documents', 'recommendation', 'reason', 'your_decision', 'seconds'],
    data[set].cases.map((c) => ({
      case_id: c.id,
      summary: c.summary.map(([k, v]) => `${k}: ${v}`).join(' | '),
      documents: c.documents.map((d) => `${d.title}: ${d.lines.join('؛ ')}`).join(' | '),
      recommendation: data[set].options[c.recommendation], reason: c.reason, your_decision: '', seconds: '',
    })));
}
write('files/queue/cases_A.csv', sheet('A'));
write('files/queue/cases_B.csv', sheet('B'));
write('files/capstone/cases_C.csv', sheet('C'));

const keys = { A: A.key, B: B.key, C: C.key };
write('solutions/reference/queue_key.json', JSON.stringify({ _note: 'Answer key of the three queues. Hand it out only after a run.', ...keys }, null, 1));

const base = baselineLog(A, A.key);
write('files/d1_2/baseline_log_R07.csv', Q.toCsv(base));
const baseScore = Q.score(base, A.key);

const rlog = reviewLog();
write('files/d1_2/review_log_8weeks.csv', toCsv(['week', 'reviewer', 'murajjih_version', 'cases', 'overrides', 'escalations', 'median_seconds', 'english_language_share'], rlog));

const actions = actionLog(ACTION_TYPES, 9001, 'M', 'HB', HARM, true);
write('files/d1_3/mutammim_actions.csv', toCsv(ACTION_COLS, actions));
const C_HARM = { issue_fine: ['reversed_on_appeal', 'reversed_on_appeal', 'reversed_on_appeal'], issue_warning: ['reversed_on_appeal', 'reversed_on_appeal'], suspend_permit: ['complaint_upheld'], waive_fine: ['waived_wrong_case'], publish_compliance_list: ['opted_out_household_listed'], send_inspection_summary: ['over_shared'] };
const cActions = actionLog(C_ACTION_TYPES, 9002, 'V', 'HBP', C_HARM, false);
write('files/capstone/capstone_actions.csv', toCsv(ACTION_COLS, cActions));

write('files/d1_3/thresholds_start.json', JSON.stringify(START, null, 1));
write('solutions/reference/thresholds_reference.json', JSON.stringify(REFERENCE, null, 1));

const strip = (x) => { const { decisions, ...rest } = x; return rest; };
const repRef = replay(actions, REFERENCE);
const repAll = replay(actions, NAIVE_ALL);
const repHigh = replay(actions, NAIVE_HIGH);
const repStart = replay(actions, START);

// review-log signals
const weekly = {};
rlog.forEach((x) => { (weekly[x.week] = weekly[x.week] || { cases: 0, overrides: 0, escalations: 0 }); weekly[x.week].cases += x.cases; weekly[x.week].overrides += x.overrides; weekly[x.week].escalations += x.escalations; });
const r04 = rlog.filter((x) => x.reviewer === 'R-04').map((x) => ({ week: x.week, override_rate: r3(x.overrides / x.cases), median_seconds: x.median_seconds }));
const r02 = rlog.filter((x) => x.reviewer === 'R-02');

// interval tables
const wil = (k, n) => Q.wilson(k, n).map((x) => Math.round(x * 1000) / 10);
const table12 = Array.from({ length: 13 }, (_, k) => ({ k, rate: Math.round((k / 12) * 1000) / 10, interval: wil(k, 12), verdict: Q.verdict(...Q.wilson(k, 12)) }));
const table8 = Array.from({ length: 9 }, (_, k) => ({ k, rate: Math.round((k / 8) * 1000) / 10, interval: wil(k, 8), verdict: Q.verdict(...Q.wilson(k, 8)) }));
// smallest n of seeded errors for which an observed 90% detection has its whole interval at or above 80%
let nNeeded = 0;
for (let n = 10; n < 2000; n++) { const k = Math.round(0.9 * n); if (Q.wilson(k, n)[0] >= 0.8 && Math.abs(k / n - 0.9) < 0.005) { nNeeded = n; break; } }
// the parallel example of the slides: a signage-permits queue of another department, 10 seeded errors, 7 caught
const parallel = { seeded: 10, caught: 7, interval: wil(7, 10), verdict: Q.verdict(...Q.wilson(7, 10)) };
// a room of 12 reviewers who each caught 9 of 12
const pooled = { reviewers: 12, seeded: 144, caught: 108, interval: wil(108, 144), verdict: Q.verdict(...Q.wilson(108, 144)) };
// binomial: chance that a reviewer whose true detection is 70% shows 10 or more of 12
const binom = (n, k, p) => { let c = 1; for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1); return c * p ** k * (1 - p) ** (n - k); };
const p70ge10 = [10, 11, 12].reduce((s, k) => s + binom(12, k, 0.7), 0);

const stats = {
  generated_by: 'labs/_tools/build.mjs',
  queue_profiles: { A: profile(A.key), B: profile(B.key), C: profile(C.key, C_ERROR_TYPES, C_DECISIONS) },
  baseline_R07: {
    seeded: baseScore.seeded, caught: baseScore.caught, detection: r3(baseScore.detection), interval: baseScore.interval.map(r3),
    verdict: baseScore.verdict, false_overrides: baseScore.falseOverrides, correct_recs: baseScore.correctRecs, false_override_rate: r3(baseScore.falseOverrideRate),
    escalations: baseScore.escalations, timeouts: baseScore.timeouts, opened: baseScore.opened, median_seconds: baseScore.medianSeconds, by: baseScore.by,
  },
  intervals_n12: table12, intervals_n8: table8, seeded_needed_at_90: nNeeded, parallel_example: parallel, pooled_example: pooled,
  p_true70_shows_10_of_12: r3(p70ge10),
  review_log: {
    weekly_escalation_rate: Object.fromEntries(Object.entries(weekly).map(([w, x]) => [w, r3(x.escalations / x.cases)])),
    weekly_override_rate: Object.fromEntries(Object.entries(weekly).map(([w, x]) => [w, r3(x.overrides / x.cases)])),
    R04: r04,
    R02_override_rate: r3(r02.reduce((s, x) => s + x.overrides, 0) / r02.reduce((s, x) => s + x.cases, 0)),
    others_override_rate_weeks_1_4: r3(rlog.filter((x) => x.reviewer !== 'R-02' && x.week <= 4).reduce((s, x) => s + x.overrides, 0) / rlog.filter((x) => x.reviewer !== 'R-02' && x.week <= 4).reduce((s, x) => s + x.cases, 0)),
  },
  actions: {
    total: actions.length, by_type: Object.fromEntries(ACTION_TYPES.map((t) => [t.type, actions.filter((a) => a.action_type === t.type).length])),
    per_day: Object.fromEntries(DAYS.map((d) => [d, actions.filter((a) => a.date === d).length])),
    harmful: actions.filter((a) => a.outcome !== 'ok').map((a) => ({ id: a.action_id, type: a.action_type, outcome: a.outcome, amount_sar: a.amount_sar, assisted_channel: a.assisted_channel })),
  },
  replay: { reference: strip(repRef), hold_everything_impact2_plus: strip(repAll), hold_impact3_only: strip(repHigh), start_file: strip(repStart) },
  capstone_actions: { total: cActions.length, harmful: cActions.filter((a) => a.outcome !== 'ok').length },
};
write('solutions/reference/stats.json', JSON.stringify(stats, null, 1));
write('solutions/reference/replay_reference.json', JSON.stringify(strip(repRef), null, 1));

// the interval table participants read in lab 1.2 (Wilson score interval, 95%)
const VERDICT_AR = { control: 'ضابط فعلي', 'not-control': 'ليست ضابطًا فعليًا', undetermined: 'العينة لا تكفي للحكم' };
const intervalRows = [];
for (const [n, tbl] of [[8, table8], [12, table12]]) for (const r of tbl) intervalRows.push({ seeded_errors: n, caught: r.k, detection_percent: r.rate, low_percent: r.interval[0], high_percent: r.interval[1], verdict: VERDICT_AR[r.verdict] });
for (const n of [20, 40, 61, 100]) { const k = Math.round(0.9 * n); const iv = wil(k, n); intervalRows.push({ seeded_errors: n, caught: k, detection_percent: Math.round((k / n) * 1000) / 10, low_percent: iv[0], high_percent: iv[1], verdict: VERDICT_AR[Q.verdict(...Q.wilson(k, n))] }); }
write('files/d1_2/intervals.csv', toCsv(['seeded_errors', 'caught', 'detection_percent', 'low_percent', 'high_percent', 'verdict'], intervalRows));

// capstone thresholds: the start file lists the agent's seven action types, all automatic
const C_START = { ...START, _note: 'نقطة البداية للمشروع الختامي: كل إجراء تلقائي. صنّف الأنواع واكتب المصفوفة والاستثناءات.', approvers: ['O-05', 'O-06'], action_types: Object.fromEntries(C_ACTION_TYPES.map((t) => [t.type, { impact: 1, reversibility: 'reversible' }])) };
write('files/capstone/thresholds_capstone_start.json', JSON.stringify(C_START, null, 1));

// capstone reference: today's thresholds, then one reset after each autonomy-raise card
const C_REF = {
  _note: 'Capstone reference for the assessor. Today: an inspector signs every fine and suspension.',
  capacity_per_day: 10, minutes_per_approval: 5, approvers: ['O-05', 'O-06'],
  action_types: {
    send_inspection_summary: { impact: 1, reversibility: 'irreversible' },
    schedule_reinspection: { impact: 1, reversibility: 'reversible' },
    issue_warning: { impact: 2, reversibility: 'costly' },
    issue_fine: { impact: 3, reversibility: 'costly' },
    waive_fine: { impact: 2, reversibility: 'irreversible' },
    publish_compliance_list: { impact: 2, reversibility: 'irreversible' },
    suspend_permit: { impact: 3, reversibility: 'irreversible' },
  },
  matrix: REFERENCE.matrix,
  overrides: [
    { action_type: 'waive_fine', when: { repeat_on_case: true }, mode: 'block' },
    { action_type: 'waive_fine', when: {}, mode: 'hold' },
    { action_type: 'publish_compliance_list', when: {}, mode: 'hold' },
  ],
};
// card A: fines up to 500 riyals without the inspector. Reset: fines over 500 or a second fine on the case still held
const C_CARD_A = JSON.parse(JSON.stringify(C_REF));
C_CARD_A.action_types.issue_fine = { impact: 2, reversibility: 'costly' };
C_CARD_A.overrides.push({ action_type: 'issue_fine', when: { amount_sar_over: 500 }, mode: 'hold' }, { action_type: 'issue_fine', when: { repeat_on_case: true }, mode: 'hold' });
const cRep = { today: strip(replay(cActions, C_REF)), card_A_reset: strip(replay(cActions, C_CARD_A)), card_A_naive_all_fines_auto: strip(replay(cActions, { ...C_CARD_A, overrides: C_REF.overrides, matrix: { ...C_REF.matrix, 2: { reversible: 'auto', costly: 'auto', irreversible: 'notify' } } })) };
write('solutions/reference/capstone_thresholds_reference.json', JSON.stringify({ today: C_REF, card_A_reset: C_CARD_A }, null, 1));
write('solutions/reference/capstone_replay.json', JSON.stringify(cRep, null, 1));
console.log('capstone', JSON.stringify(Object.fromEntries(Object.entries(cRep).map(([k, v]) => [k, { mean: v.mean_holds_per_day, max: v.max_holds_per_day, stopped: v.harmful_stopped.length, notified: v.harmful_notified, missed: v.harmful_missed }]))));

console.log('A', JSON.stringify(stats.queue_profiles.A));
console.log('B', JSON.stringify(stats.queue_profiles.B));
console.log('C', JSON.stringify(stats.queue_profiles.C));
console.log('R07', JSON.stringify(stats.baseline_R07).slice(0, 400));
console.log('replay ref', JSON.stringify(strip(repRef)).slice(0, 700));
console.log('replay all', repAll.mean_holds_per_day, repAll.max_holds_per_day, repAll.harmful_stopped.length);
console.log('replay high', repHigh.mean_holds_per_day, repHigh.max_holds_per_day, repHigh.harmful_stopped.length, repHigh.harmful_missed);
console.log('n needed at 90%', nNeeded, 'parallel', JSON.stringify(parallel), 'pooled', JSON.stringify(pooled), 'p70', r3(p70ge10));
console.log('review', JSON.stringify(stats.review_log).slice(0, 600));
