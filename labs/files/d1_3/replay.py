# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Replay the past actions of the agent Mutammim against a thresholds file.

Course LDS-AIG-307, lab 1.3. Standard library only; nothing is sent anywhere.

    uv run replay.py thresholds_start.json
    uv run replay.py my_thresholds.json --log mutammim_actions.csv --out held.csv
    python replay.py my_thresholds.json          (in JupyterLab or a hosted notebook: %run replay.py my_thresholds.json)

For every action the mode is read from the matrix (impact x reversibility of its type), then each
matching exception in "overrides" can only make it stricter: auto < notify < hold < block.
A held action goes to an approver who is not the officer assigned to the case.
"""
import argparse
import csv
import json
import math
import sys
from pathlib import Path

ORDER = ["auto", "notify", "hold", "block"]
LABELS = {"auto": "تلقائي", "notify": "تلقائي مع إخطار", "hold": "يتوقف للاعتماد", "block": "ممنوع"}


def stricter(a, b):
    return a if ORDER.index(a) >= ORDER.index(b) else b


def mode_of(action, th, seen):
    cls = th["action_types"].get(action["action_type"])
    if cls is None:
        raise SystemExit(f"لا تصنيف للإجراء {action['action_type']} في ملف العتبات")
    mode = th["matrix"][str(cls["impact"])][cls["reversibility"]]
    for o in th.get("overrides", []):
        if o["action_type"] != action["action_type"]:
            continue
        w = o.get("when", {})
        match = True
        if "amount_sar_over" in w and not float(action["amount_sar"] or 0) > w["amount_sar_over"]:
            match = False
        if "recipients_over" in w and not float(action["recipients"] or 0) > w["recipients_over"]:
            match = False
        if "assisted_channel" in w and (action["assisted_channel"] == "yes") != w["assisted_channel"]:
            match = False
        if w.get("repeat_on_case") and (action["action_type"] + "|" + action["case_id"]) not in seen:
            match = False
        if match:
            mode = stricter(mode, o["mode"])
    return mode


def replay(actions, th):
    seen, days, decisions = set(), {}, []
    approvers = th.get("approvers", [])
    per_approver = {a: 0 for a in approvers}
    conflicts = 0
    for a in actions:
        mode = mode_of(a, th, seen)
        seen.add(a["action_type"] + "|" + a["case_id"])
        d = days.setdefault(a["date"], {"date": a["date"], "actions": 0, "auto": 0, "notify": 0, "hold": 0, "block": 0})
        d["actions"] += 1
        d[mode] += 1
        approver = ""
        if mode == "hold" and approvers:
            allowed = [p for p in approvers if p != a["assigned_officer"]]
            if len(allowed) < len(approvers):
                conflicts += 1
            allowed.sort(key=lambda p: (per_approver[p], p))
            approver = allowed[0] if allowed else ""
            if approver:
                per_approver[approver] += 1
        decisions.append({"action_id": a["action_id"], "date": a["date"], "action_type": a["action_type"],
                          "mode": mode, "approver": approver, "outcome": a["outcome"]})
    rows = list(days.values())
    holds = [d["hold"] for d in rows]
    harmful = [d for d in decisions if d["outcome"] != "ok"]
    cap = th["capacity_per_day"]
    mean = math.floor(sum(holds) / len(rows) * 10 + 0.5) / 10
    return {
        "actions": len(decisions),
        "totals": {m: sum(1 for d in decisions if d["mode"] == m) for m in ORDER},
        "days": rows,
        "mean_holds_per_day": mean,
        "max_holds_per_day": max(holds),
        "days_over_capacity": sum(1 for h in holds if h > cap),
        "approval_minutes_per_day": math.floor(sum(holds) / len(rows) * th["minutes_per_approval"] * 10 + 0.5) / 10,
        "harmful_total": len(harmful),
        "harmful_stopped": [d["action_id"] for d in harmful if d["mode"] in ("hold", "block")],
        "harmful_notified": [d["action_id"] for d in harmful if d["mode"] == "notify"],
        "harmful_missed": [d["action_id"] for d in harmful if d["mode"] == "auto"],
        "sod_conflicts_rerouted": conflicts,
        "holds_per_approver": per_approver,
        "decisions": decisions,
    }


def main():
    here = Path(__file__).resolve().parent
    p = argparse.ArgumentParser(description="Replay Mutammim's past actions against thresholds")
    p.add_argument("thresholds")
    p.add_argument("--log", default=str(here / "mutammim_actions.csv"))
    p.add_argument("--out", default="", help="write every action with its mode to this CSV file")
    p.add_argument("--json", action="store_true", help="print the result as JSON")
    args = p.parse_args()
    th = json.loads(Path(args.thresholds).read_text(encoding="utf-8"))
    with open(args.log, encoding="utf-8-sig", newline="") as f:
        actions = list(csv.DictReader(f))
    res = replay(actions, th)
    if args.out:
        with open(args.out, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(res["decisions"][0].keys()))
            w.writeheader()
            w.writerows(res["decisions"])
    if args.json:
        out = {k: v for k, v in res.items() if k != "decisions"}
        print(json.dumps(out, ensure_ascii=False, indent=1))
        return
    sys.stdout.reconfigure(encoding="utf-8")
    print(f"الإجراءات: {res['actions']} من الملف {Path(args.log).name}")
    for m in ORDER:
        print(f"  {LABELS[m]}: {res['totals'][m]}")
    print("اليوم        الإجراءات  يتوقف  ممنوع")
    for d in res["days"]:
        print(f"{d['date']}   {d['actions']:>5}  {d['hold']:>5}  {d['block']:>5}")
    print(f"متوسط ما يتوقف للاعتماد في اليوم: {res['mean_holds_per_day']} (الطاقة {th['capacity_per_day']})، والأقصى: {res['max_holds_per_day']}، والأيام فوق الطاقة: {res['days_over_capacity']}")
    print(f"دقائق الاعتماد في اليوم: {res['approval_minutes_per_day']}")
    print(f"الإجراءات التي ثبت ضررها: {res['harmful_total']}؛ أوقفتها العتبات: {len(res['harmful_stopped'])}؛ عُرفت بعد وقوعها بالإخطار: {len(res['harmful_notified'])}؛ مرت دون أن يراها أحد: {len(res['harmful_missed'])}")
    if res["harmful_missed"]:
        print("  مرت دون أن يراها أحد: " + "، ".join(res["harmful_missed"]))
    if res["harmful_notified"]:
        print("  عُرفت بعد وقوعها: " + "، ".join(res["harmful_notified"]))
    print(f"إجراءات حُوّلت إلى معتمد آخر لأن المعتمد الأول هو الموظف المسند إليه الملف: {res['sod_conflicts_rerouted']}")
    print("ما يعتمده كل معتمد: " + "، ".join(f"{k} {v}" for k, v in res["holds_per_approver"].items()))


if __name__ == "__main__":
    main()
