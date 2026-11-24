// The replay rule, in JavaScript. labs/files/d1_3/replay.py implements the same rule in Python;
// labs/solutions/check.mjs runs both on the reference thresholds and compares them.

export const ORDER = ['auto', 'notify', 'hold', 'block'];
const stricter = (a, b) => (ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b);

export function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
  const head = lines.shift().split(',');
  return lines.map((l) => {
    const cells = l.split(',');
    const o = {};
    head.forEach((h, i) => { o[h] = cells[i] ?? ''; });
    return o;
  });
}

export function modeOf(action, th, seenRefunds) {
  const cls = th.action_types[action.action_type];
  if (!cls) throw new Error('no class for ' + action.action_type);
  let mode = th.matrix[String(cls.impact)][cls.reversibility];
  for (const o of th.overrides || []) {
    if (o.action_type !== action.action_type) continue;
    const w = o.when || {};
    let match = true;
    if (w.amount_sar_over !== undefined && !(Number(action.amount_sar || 0) > w.amount_sar_over)) match = false;
    if (w.recipients_over !== undefined && !(Number(action.recipients || 0) > w.recipients_over)) match = false;
    if (w.assisted_channel !== undefined && (action.assisted_channel === 'yes') !== w.assisted_channel) match = false;
    if (w.repeat_on_case && !seenRefunds.has(action.action_type + '|' + action.case_id)) match = false;
    if (match) mode = stricter(mode, o.mode);
  }
  return mode;
}

export function replay(actions, th) {
  const seen = new Set();
  const days = new Map();
  const approvers = th.approvers || [];
  const perApprover = Object.fromEntries(approvers.map((a) => [a, 0]));
  let conflicts = 0;
  const decisions = [];
  for (const a of actions) {
    const mode = modeOf(a, th, seen);
    seen.add(a.action_type + '|' + a.case_id);
    const d = days.get(a.date) || { date: a.date, actions: 0, auto: 0, notify: 0, hold: 0, block: 0 };
    d.actions++; d[mode]++;
    days.set(a.date, d);
    let approver = '';
    if (mode === 'hold' && approvers.length) {
      // segregation of duties: never the officer assigned to the case; then the less loaded approver
      const allowed = approvers.filter((p) => p !== a.assigned_officer);
      if (allowed.length < approvers.length) conflicts++;
      approver = allowed.sort((x, y) => perApprover[x] - perApprover[y] || (x < y ? -1 : 1))[0] || '';
      if (approver) perApprover[approver]++;
    }
    decisions.push({ action_id: a.action_id, date: a.date, action_type: a.action_type, mode, approver, outcome: a.outcome });
  }
  const dayRows = [...days.values()];
  const holds = dayRows.map((d) => d.hold);
  const harmful = decisions.filter((d) => d.outcome !== 'ok');
  const cap = th.capacity_per_day;
  return {
    actions: decisions.length,
    totals: Object.fromEntries(ORDER.map((m) => [m, decisions.filter((d) => d.mode === m).length])),
    days: dayRows,
    mean_holds_per_day: Math.round((holds.reduce((s, x) => s + x, 0) / dayRows.length) * 10) / 10,
    max_holds_per_day: Math.max(...holds),
    days_over_capacity: holds.filter((h) => h > cap).length,
    approval_minutes_per_day: Math.round((holds.reduce((s, x) => s + x, 0) / dayRows.length) * th.minutes_per_approval * 10) / 10,
    harmful_total: harmful.length,
    harmful_stopped: harmful.filter((d) => d.mode === 'hold' || d.mode === 'block').map((d) => d.action_id),
    harmful_notified: harmful.filter((d) => d.mode === 'notify').map((d) => d.action_id),
    harmful_missed: harmful.filter((d) => d.mode === 'auto').map((d) => d.action_id),
    sod_conflicts_rerouted: conflicts,
    holds_per_approver: perApprover,
    decisions,
  };
}
