/* Shared by queue.html, score.html and labs/solutions/check.mjs.
   Session logs are CSV; scoring needs the key file the trainer hands out after the run. */
(function (root) {
  'use strict';

  var LOG_COLUMNS = ['session', 'set', 'levers', 'position', 'case_id', 'shown', 'own_first',
    'decision', 'final', 'seconds', 'opened_documents', 'checklist'];

  function csvCell(v) {
    var s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCsv(rows) {
    var out = [LOG_COLUMNS.join(',')];
    rows.forEach(function (r) { out.push(LOG_COLUMNS.map(function (c) { return csvCell(r[c]); }).join(',')); });
    return out.join('\n') + '\n';
  }

  function parseCsv(text) {
    var rows = [], row = [], cell = '', q = false, i, ch;
    text = String(text).replace(/^﻿/, '');
    for (i = 0; i < text.length; i++) {
      ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    var head = rows.shift() || [];
    return rows.map(function (r) {
      var o = {}; head.forEach(function (h, j) { o[h] = r[j] === undefined ? '' : r[j]; }); return o;
    });
  }

  // Wilson score interval, 95% (z = 1.96)
  function wilson(k, n) {
    if (!n) return [0, 1];
    var z = 1.96, p = k / n, d = 1 + z * z / n;
    var c = (p + z * z / (2 * n)) / d;
    var h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [Math.max(0, c - h), Math.min(1, c + h)];
  }

  function median(xs) {
    if (!xs.length) return 0;
    var s = xs.slice().sort(function (a, b) { return a - b; }), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // The organisation's rule (a course rule, not a national text): the review step is a real
  // control when the whole 95% interval of the detection rate is at or above the target;
  // it is not a control when the whole interval is below it; otherwise the sample cannot tell.
  var TARGET = 0.8;
  function verdict(lo, hi) {
    if (lo >= TARGET) return 'control';
    if (hi < TARGET) return 'not-control';
    return 'undetermined';
  }

  // rows: one session's log rows; key: { case_id: {correct, seeded, type, visibility, half, direction} }
  function score(rows, key) {
    var s = { cases: 0, seeded: 0, caught: 0, corrected: 0, correctRecs: 0, falseOverrides: 0,
      escalations: 0, timeouts: 0, opened: 0, seconds: [], by: {} };
    function bump(group, name, hit) {
      var g = s.by[group] = s.by[group] || {};
      var c = g[name] = g[name] || { n: 0, k: 0 };
      c.n++; if (hit) c.k++;
    }
    rows.forEach(function (r) {
      var k = key[r.case_id];
      if (!k) return;
      s.cases++;
      var sec = Number(r.seconds); if (!isNaN(sec)) s.seconds.push(sec);
      if (r.opened_documents === 'yes') s.opened++;
      if (r.decision === 'timeout') s.timeouts++;
      if (r.decision === 'escalate') s.escalations++;
      var changed = r.decision === 'override' || r.decision === 'escalate';
      if (k.seeded) {
        s.seeded++;
        if (changed) s.caught++;
        if (r.decision === 'override' && r.final === k.correct) s.corrected++;
        bump('visibility', k.visibility, changed);
        bump('half', k.half, changed);
        bump('direction', k.direction, changed);
        bump('opened', r.opened_documents === 'yes' ? 'opened' : 'not-opened', changed);
      } else {
        s.correctRecs++;
        if (r.decision === 'override') s.falseOverrides++;
      }
    });
    s.detection = s.seeded ? s.caught / s.seeded : 0;
    s.interval = wilson(s.caught, s.seeded);
    s.falseOverrideRate = s.correctRecs ? s.falseOverrides / s.correctRecs : 0;
    s.escalationRate = s.cases ? s.escalations / s.cases : 0;
    s.medianSeconds = median(s.seconds);
    s.verdict = verdict(s.interval[0], s.interval[1]);
    return s;
  }

  function groupSessions(rows) {
    var by = {};
    rows.forEach(function (r) { (by[r.session + '|' + r.set] = by[r.session + '|' + r.set] || []).push(r); });
    return by;
  }

  var L = { LOG_COLUMNS: LOG_COLUMNS, toCsv: toCsv, parseCsv: parseCsv, wilson: wilson, median: median,
    verdict: verdict, TARGET: TARGET, score: score, groupSessions: groupSessions };
  if (typeof module !== 'undefined' && module.exports) module.exports = L;
  else root.QueueLib = L;
})(this);
