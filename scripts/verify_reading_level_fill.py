#!/usr/bin/env python3
"""Verify reading passages + approved bank fill are level-appropriate."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "workspace" / "level-test" / "READING_LEVEL_FILL_VERIFY.md"

EXPECTED_CEFR = {
    1: "Pre-A1/A1",
    2: "A2",
    3: "A2-B1",
    4: "B1",
    5: "B1-B2",
    6: "B2",
}
WC_LO = {1: 55, 2: 65, 3: 70, 4: 110, 5: 120, 6: 120}
WC_HI = {1: 75, 2: 90, 3: 95, 4: 150, 5: 160, 6: 160}

report: list[str] = []
passes = warns = fails = 0


def p(msg: str = "") -> None:
    report.append(msg)


def ok(msg: str) -> None:
    global passes
    passes += 1
    report.append(f"[PASS] {msg}")


def warn(msg: str) -> None:
    global warns
    warns += 1
    report.append(f"[WARN] {msg}")


def fail(msg: str) -> None:
    global fails
    fails += 1
    report.append(f"[FAIL] {msg}")


def norm(t: str | None) -> str:
    return re.sub(r"\s+", " ", (t or "").strip())


def long_ratio(text: str) -> float:
    toks = re.findall(r"[A-Za-z']+", text)
    if not toks:
        return 0.0
    return sum(1 for t in toks if len(t) >= 8) / len(toks)


def avg_sent_len(text: str) -> float:
    sents = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
    if not sents:
        return 0.0
    return sum(len(s.split()) for s in sents) / len(sents)


def main() -> None:
    pack = json.loads(
        (ROOT / "data/reading-passages/passages-by-level.json").read_text(encoding="utf-8")
    )
    bank = json.loads(
        (ROOT / "data/generated-bank/items.json").read_text(encoding="utf-8")
    )
    manifest = json.loads(
        (ROOT / "data/irt-exemplars/manifest.json").read_text(encoding="utf-8")
    )
    cfg = json.loads(
        (ROOT / "data/reading-passages/generation-config.json").read_text(encoding="utf-8")
    )

    p("# Level reading pack fill verification")
    p(f"- pack version: `{pack.get('version')}`")
    p(f"- organizeBy: {pack.get('policy', {}).get('organizeBy')}")
    p("")

    all_ids: list[str] = []
    text_to_lv: dict[str, int] = {}

    p("## 1. Pack completeness per level")
    p("")
    for lv in range(1, 7):
        block = pack["levels"][str(lv)]
        ps = block["passages"]
        meta = block.get("meta") or {}
        if len(ps) != 5:
            fail(f"L{lv}: expected 5 passages, got {len(ps)}")
        else:
            ok(f"L{lv}: 5 passages filled")
        if block.get("passageCount") != len(ps):
            fail(f"L{lv}: passageCount mismatch")

        cefr = meta.get("cefr") or (ps[0].get("cefr") if ps else None)
        if cefr == EXPECTED_CEFR[lv]:
            ok(f"L{lv}: CEFR label `{cefr}`")
        else:
            fail(f"L{lv}: CEFR `{cefr}` != expected `{EXPECTED_CEFR[lv]}`")

        anchor = manifest["levelAnchors"][str(lv)]
        if anchor["cefr"] in (cefr, EXPECTED_CEFR[lv]):
            ok(f"L{lv}: IRT anchor CEFR matches (`{anchor['cefr']}`)")
        else:
            fail(f"L{lv}: anchor `{anchor['cefr']}` vs pack `{cefr}`")

        wcs: list[int] = []
        tbs: list[float] = []
        lrs: list[float] = []
        asls: list[float] = []
        for pas in ps:
            all_ids.append(pas["id"])
            text_to_lv[norm(pas["text"])] = lv
            if not pas.get("title") or not pas.get("text"):
                fail(f"{pas.get('id')}: empty title/text")
            if pas.get("level") != lv:
                fail(f"{pas['id']}: level field {pas.get('level')}")
            wc = len(pas["text"].split())
            if abs(wc - pas.get("wordCount", 0)) > 2:
                warn(f"{pas['id']}: wordCount field {pas.get('wordCount')} actual {wc}")
            wcs.append(wc)
            tbs.append(float(pas.get("targetB", 0)))
            lrs.append(long_ratio(pas["text"]))
            asls.append(avg_sent_len(pas["text"]))

        avg_wc = sum(wcs) / len(wcs)
        avg_b = sum(tbs) / len(tbs)
        avg_lr = sum(lrs) / len(lrs)
        avg_sl = sum(asls) / len(asls)
        p(f"- L{lv} titles: {[x['title'] for x in ps]}")
        p(
            f"- L{lv} metrics: wc={wcs} avg={avg_wc:.0f} | "
            f"targetB avg={avg_b:.2f} | longTok={avg_lr:.3f} | sentLen={avg_sl:.1f}"
        )

        if all(WC_LO[lv] - 10 <= w <= WC_HI[lv] + 25 for w in wcs):
            ok(f"L{lv}: word counts in soft band ~{WC_LO[lv]}–{WC_HI[lv]}")
        else:
            warn(f"L{lv}: word counts outside soft band {WC_LO[lv]}–{WC_HI[lv]}: {wcs}")

        if abs(avg_b - float(anchor["thetaCenter"])) <= 0.15:
            ok(f"L{lv}: avg targetB ≈ thetaCenter ({anchor['thetaCenter']})")
        else:
            warn(
                f"L{lv}: avg targetB {avg_b:.2f} vs theta {anchor['thetaCenter']}"
            )

    if len(all_ids) == len(set(all_ids)):
        ok(f"unique passage ids: {len(all_ids)}")
    else:
        fail("duplicate passage ids")

    blob = " ".join(text_to_lv.keys()).lower()
    banned = [
        "fly guy",
        "nate the great",
        "horrid henry",
        "dragon masters",
        "magic tree house",
        "little critter",
        "weird school",
    ]
    hits = [b for b in banned if b in blob]
    if not hits:
        ok("no commercial series names in passage bodies")
    else:
        fail(f"commercial names in body: {hits}")

    p("")
    p("## 2. Difficulty ladder (L1 → L6 should rise)")
    p("")
    metrics = []
    for lv in range(1, 7):
        ps = pack["levels"][str(lv)]["passages"]
        metrics.append(
            {
                "lv": lv,
                "wc": sum(p["wordCount"] for p in ps) / 5,
                "b": sum(p["targetB"] for p in ps) / 5,
                "lr": sum(long_ratio(p["text"]) for p in ps) / 5,
                "sl": sum(avg_sent_len(p["text"]) for p in ps) / 5,
            }
        )
    for i in range(5):
        a, b = metrics[i], metrics[i + 1]
        if b["b"] + 0.01 >= a["b"]:
            ok(f"targetB L{a['lv']} {a['b']:.2f} → L{b['lv']} {b['b']:.2f}")
        else:
            fail(f"targetB drop L{a['lv']}→L{b['lv']}")
        if b["wc"] + 8 >= a["wc"]:
            ok(f"wordCount L{a['lv']} {a['wc']:.0f} → L{b['lv']} {b['wc']:.0f}")
        else:
            warn(
                f"wordCount drop L{a['lv']} {a['wc']:.0f} → L{b['lv']} {b['wc']:.0f}"
            )
        if b["lr"] + 0.02 >= a["lr"] or b["sl"] + 0.5 >= a["sl"]:
            ok(
                f"lexis/syntax L{a['lv']}→L{b['lv']} "
                f"(lr {a['lr']:.3f}→{b['lr']:.3f}, sl {a['sl']:.1f}→{b['sl']:.1f})"
            )
        else:
            warn(f"lexis/syntax not rising L{a['lv']}→L{b['lv']}")

    p("")
    p("## 3. L1 elementary fitness")
    p("")
    for pas in pack["levels"]["1"]["passages"]:
        lr = long_ratio(pas["text"])
        sl = avg_sent_len(pas["text"])
        if lr <= 0.12 and sl <= 14 and pas["wordCount"] <= 90:
            ok(
                f"{pas['id']} elementary-ok "
                f"(wc={pas['wordCount']}, lr={lr:.2f}, sl={sl:.1f})"
            )
        else:
            warn(
                f"{pas['id']} may be heavy for L1 "
                f"(wc={pas['wordCount']}, lr={lr:.2f}, sl={sl:.1f})"
            )

    p("")
    p("## 4. L4+ original-only policy")
    p("")
    for lv in range(4, 7):
        refs = pack["levels"][str(lv)]["meta"].get("refSeries") or []
        if refs == []:
            ok(f"L{lv}: refSeries empty (academy original only)")
        else:
            fail(f"L{lv}: unexpected refSeries {refs}")

    p("")
    p("## 5. Approved bank fill vs presets (target: 1 item / passage)")
    p("")
    preset_texts = set(text_to_lv.keys())
    ap = [
        i
        for i in bank["items"]
        if i.get("domain") == "reading" and i.get("status") == "approved"
    ]
    by_lv: dict[int, list] = defaultdict(list)
    orphan = 0
    for it in ap:
        nt = norm(it.get("passage"))
        if nt not in preset_texts:
            orphan += 1
            continue
        by_lv[int(it["level"])].append(it)

    if orphan == 0:
        ok(f"approved reading all match presets (n={len(ap)})")
    else:
        fail(f"{orphan} approved orphans")

    for lv in range(1, 7):
        items = by_lv[lv]
        pack_map = {
            norm(p["text"]): p["id"] for p in pack["levels"][str(lv)]["passages"]
        }
        covered: set[str] = set()
        for it in items:
            nt = norm(it.get("passage"))
            if nt in pack_map:
                covered.add(pack_map[nt])
        multi = Counter(norm(it.get("passage")) for it in items)
        dups = sum(1 for _k, v in multi.items() if v > 1)
        n = len(items)
        c = len(covered)
        if n >= 5 and c == 5 and dups == 0:
            ok(f"L{lv}: bank fill complete — {n} approved, 5/5 presets, no dups")
        elif c == 5 and dups == 0:
            ok(f"L{lv}: all 5 presets covered (approved={n})")
        elif c >= 3:
            warn(f"L{lv}: partial cover {c}/5, approved={n}, dups={dups}")
        else:
            fail(f"L{lv}: weak cover {c}/5, approved={n}")

        mism = []
        for it in items:
            plv = text_to_lv.get(norm(it.get("passage")))
            if plv is not None and plv != it["level"]:
                mism.append(it["id"])
        if not mism:
            ok(f"L{lv}: item.level matches passage pack level")
        else:
            fail(f"L{lv}: level mismatch items {mism}")

        qtypes = Counter(it.get("questionType") for it in items)
        p(f"- L{lv} questionTypes: {dict(qtypes)}")

    p("")
    p("## 6. Generation config (1:1 sessions)")
    p("")
    for lv in range(1, 7):
        g = cfg["levels"][str(lv)]
        if g["itemsPerReading"] >= 5 and g["passagesPerSession"] >= 5:
            ok(
                f"L{lv}: items={g['itemsPerReading']} "
                f"passagesPerSession={g['passagesPerSession']}"
            )
        else:
            warn(
                f"L{lv}: items={g['itemsPerReading']} "
                f"passages={g['passagesPerSession']}"
            )

    p("")
    p("## Sample stems (approved)")
    p("")
    for lv in range(1, 7):
        for it in by_lv[lv][:2]:
            stem = (it.get("question") or "")[:70].replace("\n", " ")
            p(f"- L{lv} `{it.get('questionType')}`: {stem}")

    p("")
    p("## Verdict")
    p(f"- PASS={passes} · WARN={warns} · FAIL={fails}")
    if fails:
        verdict = "FAIL"
    elif warns == 0:
        verdict = "PASS"
    elif warns <= 3:
        verdict = "PASS WITH NOTES"
    else:
        verdict = "CONDITIONAL PASS"
    p(f"- **Verdict: {verdict}**")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(report) + "\n", encoding="utf-8")
    print("\n".join(report))
    print(f"\nWROTE {OUT}")


if __name__ == "__main__":
    main()
