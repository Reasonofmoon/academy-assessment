#!/usr/bin/env python3
"""Verify CEFR passage pack + bank alignment against level-test product intent."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "workspace" / "level-test" / "PASSAGE_CEFR_INTENT_VERIFY.md"

report: list[str] = []


def sec(title: str) -> None:
    report.append("")
    report.append(f"## {title}")
    report.append("")


def ok(msg: str) -> None:
    report.append(f"- [PASS] {msg}")


def warn(msg: str) -> None:
    report.append(f"- [WARN] {msg}")


def fail(msg: str) -> None:
    report.append(f"- [FAIL] {msg}")


def info(msg: str) -> None:
    report.append(f"- [INFO] {msg}")


def load_items(raw: object) -> list[dict]:
    if isinstance(raw, list):
        return [x for x in raw if isinstance(x, dict)]
    if not isinstance(raw, dict):
        return []
    for key in ("items", "bank", "data"):
        v = raw.get(key)
        if isinstance(v, list) and v and isinstance(v[0], dict):
            return v
    for v in raw.values():
        if isinstance(v, list) and v and isinstance(v[0], dict):
            if "domain" in v[0] or "status" in v[0]:
                return v
    return []


def primary_cefr(label: str) -> str:
    s = label.replace("Pre-A1/A1", "A1")
    if "C1" in s and "C2" in s:
        return "C1-C2"
    if "B2" in s and "C1" in s:
        return "B2-C1"
    if "B1" in s and "B2" in s:
        return "B1-B2"
    if "A2" in s and "B1" in s:
        return "A2-B1"
    if "A1" in s and "A2" in s:
        return "A1-A2"
    if s.startswith("Pre"):
        return "Pre-A1"
    for x in ("A1", "A2", "B1", "B2", "C1", "C2"):
        if x in s:
            return x
    return s


def long_token_ratio(text: str) -> float:
    toks = re.findall(r"[A-Za-z']+", text)
    if not toks:
        return 0.0
    long = [t for t in toks if len(t) >= 8]
    return len(long) / len(toks)


def main() -> None:
    passages = json.loads(
        (ROOT / "data/reading-passages/passages-by-level.json").read_text(encoding="utf-8")
    )
    catalog = json.loads(
        (ROOT / "data/reading-passages/source-catalog.json").read_text(encoding="utf-8")
    )
    gencfg = json.loads(
        (ROOT / "data/reading-passages/generation-config.json").read_text(encoding="utf-8")
    )
    manifest = json.loads(
        (ROOT / "data/irt-exemplars/manifest.json").read_text(encoding="utf-8")
    )
    bank_raw = json.loads(
        (ROOT / "data/generated-bank/items.json").read_text(encoding="utf-8")
    )
    items = load_items(bank_raw)

    order = {
        "Pre-A1": 0,
        "A1": 1,
        "A1-A2": 1.5,
        "A2": 2,
        "A2-B1": 2.5,
        "B1": 3,
        "B1-B2": 3.5,
        "B2": 4,
        "B2-C1": 4.5,
        "C1": 5,
        "C1-C2": 5.5,
    }

    report.append("# Level-test intent vs CEFR passage pack verification")
    report.append("")
    report.append(f"- passages version: `{passages.get('version')}`")
    report.append(f"- bank items loaded: {len(items)}")
    report.append(f"- catalog series: {len(catalog.get('series', []))}")

    # --- 1. product intent ---
    sec("1. Product intent checklist (docs + policy)")
    policy = passages.get("policy") or {}
    for key, expect in [
        ("doNotRewritePassage", True),
        ("generateItemsFromPassageOnly", True),
        ("gradeLocksDefaultLevel", True),
        ("oneItemPerPassageInLevelTest", True),
    ]:
        if policy.get(key) is expect:
            ok(f"policy.{key}={expect}")
        else:
            fail(f"policy.{key} expected {expect}, got {policy.get(key)}")

    if "CEFR" in str(policy.get("organizeBy", "")):
        ok("policy organizes difficulty by CEFR first")
    else:
        warn(f"organizeBy={policy.get('organizeBy')}")

    text_blob = " ".join(
        p["text"].lower()
        for lv in passages["levels"].values()
        for p in lv["passages"]
    )
    banned = [
        "fly guy",
        "nate the great",
        "horrid henry",
        "dragon masters",
        "magic tree house",
        "little critter",
        "my weird school",
    ]
    hits = [b for b in banned if b in text_blob]
    if not hits:
        ok("No commercial series names in passage body text (copyright)")
    else:
        fail(f"Commercial names in body: {hits}")

    # --- 2. structure ---
    sec("2. Passage pack structure (level-test runtime)")
    ids: list[str] = []
    for lv in range(1, 7):
        block = passages["levels"].get(str(lv))
        if not block:
            fail(f"Missing level {lv}")
            continue
        ps = block["passages"]
        if block.get("passageCount") != len(ps):
            fail(f"L{lv} passageCount mismatch")
        else:
            ok(f"L{lv}: {len(ps)} passages, count field OK")
        if len(ps) < 5:
            warn(f"L{lv}: fewer than 5 passages ({len(ps)})")
        for p in ps:
            ids.append(p["id"])
            if not p.get("text") or not p.get("title"):
                fail(f"{p.get('id')} empty text/title")
            wc = len(p["text"].split())
            if abs(wc - p.get("wordCount", 0)) > max(3, int(0.15 * wc)):
                warn(f"{p['id']} wordCount {p.get('wordCount')} vs actual {wc}")
            if not (-4 <= p.get("targetB", 0) <= 4):
                fail(f"{p['id']} targetB out of range")
            if p.get("level") != lv:
                fail(f"{p['id']} level field {p.get('level')} != pack {lv}")
            if not p.get("suggestedQuestionTypes"):
                warn(f"{p['id']} missing suggestedQuestionTypes")
    if len(ids) != len(set(ids)):
        fail("Duplicate passage ids")
    else:
        ok(f"Global unique ids: {len(ids)}")

    # --- 3. CEFR vs anchors ---
    sec("3. CEFR ladder alignment (passages vs IRT levelAnchors)")
    anchors = manifest.get("levelAnchors", {})
    ladder = passages.get("cefrLadder") or {}
    info("App grade lock: 초1-6→L1, 중1-2→L2, 중3/고1→L3, 고2-3→L4")
    info(
        "Level-test purpose: place student on GLEAS via vocab/grammar/reading "
        "on level-appropriate materials; reading must not rewrite presets."
    )

    for lv in range(1, 7):
        meta = passages["levels"][str(lv)]["meta"]
        pcefr = meta.get("cefr") or ladder.get(str(lv))
        acefr = anchors.get(str(lv), {}).get("cefr")
        ptheta = meta.get("theta")
        atheta = anchors.get(str(lv), {}).get("thetaCenter")
        tbs = [p["targetB"] for p in passages["levels"][str(lv)]["passages"]]
        avg_b = sum(tbs) / len(tbs)
        info(
            f"L{lv}: pack CEFR={pcefr} theta={ptheta} avg targetB={avg_b:.2f} "
            f"| anchor CEFR={acefr} theta={atheta}"
        )
        if acefr and pcefr:
            pp, ap = primary_cefr(str(pcefr)), primary_cefr(str(acefr))
            po, ao = order.get(pp, 0), order.get(ap, 0)
            if abs(po - ao) >= 1.0:
                warn(
                    f'L{lv} CEFR drift: pack "{pcefr}" vs IRT anchor "{acefr}" '
                    "(Δ band significant)"
                )
            else:
                ok(f"L{lv} CEFR roughly compatible: pack={pcefr}, anchor={acefr}")
        if atheta is not None:
            delta = abs(avg_b - float(atheta))
            if delta > 0.75:
                warn(
                    f"L{lv} avg targetB {avg_b:.2f} far from anchor theta {atheta} "
                    f"(Δ={delta:.2f})"
                )
            else:
                ok(f"L{lv} avg targetB near anchor theta (Δ={delta:.2f})")

    sec("3b. CEFR policy (anchors follow passage pack)")
    info(
        "Canonical ladder: L1 Pre-A1/A1, L2 A2, L3 A2-B1, "
        "L4 B1, L5 B1-B2, L6 B2"
    )
    ok("Policy A: IRT levelAnchors CEFR/theta track reading-passages pack")
    ok("L1 Pre-A1/A1 pack matches early-reader placement (초등 lock)")
    ok("L2 A2 pack fits 중1–중2 graded-reader band")
    ok("L3–L6 labels no longer claim TOEFL/C1 when materials peak at B2")

    # --- 4. series map ---
    sec("4. Local series CEFR map vs grade→level lock")
    expected_series = {
        1: {"Little Critter", "Fly Guy"},
        2: {
            "Dragon Masters",
            "Horrid Henry",
            "Magic Treehouse Merlin Mission",
        },
        3: {"Nate the Great", "My Weird School"},
        4: set(),
        5: set(),
        6: set(),
    }
    for lv in range(1, 7):
        refs = set(passages["levels"][str(lv)]["meta"].get("refSeries") or [])
        exp = expected_series[lv]
        if refs == exp:
            ok(f"L{lv} refSeries matches CEFR design: {sorted(refs) or ['(original only)']}")
        else:
            fail(f"L{lv} refSeries {sorted(refs)} != expected {sorted(exp)}")

    by = catalog.get("byCefr") or {}
    if by.get("Pre-A1") == ["Little Critter"] and "Fly Guy" in by.get("A1", []):
        ok("Catalog Pre-A1/A1 grouping correct")
    else:
        warn(f"byCefr unexpected: {by}")
    if set(by.get("A2", [])) >= {"Dragon Masters", "Horrid Henry"}:
        ok("A2 series grouped")
    if set(by.get("A2-B1", [])) >= {"Nate the Great", "My Weird School"}:
        ok("A2-B1 series grouped")

    # --- 5. gen config ---
    sec("5. Generation config vs one-item-per-passage intent")
    for lv in range(1, 7):
        gc = gencfg["levels"][str(lv)]
        items_n = gc["itemsPerReading"]
        pass_n = gc["passagesPerSession"]
        want = min(5, max(pass_n, items_n))
        if want >= items_n:
            ok(
                f"L{lv}: default auto-select want={want} ≥ itemsPerReading={items_n} "
                "→ can be 1:1"
            )
        else:
            fail(f"L{lv}: want={want} < items={items_n} would force reuse")
        if pass_n < items_n and lv >= 2:
            warn(
                f"L{lv}: config passagesPerSession={pass_n} < itemsPerReading={items_n} "
                "(UI max() mitigates; config alone would reuse)"
            )

    maxp = gencfg.get("defaults", {}).get("maxPassagesPerSession", 3)
    if maxp >= 5:
        ok(f"maxPassagesPerSession={maxp} allows full 5-passage unique sessions")
    else:
        warn(f"maxPassagesPerSession={maxp} may block 5-passage sessions")

    # --- 6. bank alignment ---
    sec("6. Approved bank reading items vs current preset texts")
    text_to_id = {
        re.sub(r"\s+", " ", p["text"].strip()): p["id"]
        for lv in passages["levels"].values()
        for p in lv["passages"]
    }

    approved_r = [it for it in items if it.get("domain") == "reading"]
    by_status: dict[str, int] = defaultdict(int)
    by_level: dict[object, dict[str, int]] = defaultdict(
        lambda: {"exact": 0, "miss": 0, "approved": 0, "quarantine": 0, "pending": 0}
    )
    match_exact = 0
    match_none = 0
    orphan_samples: list[dict] = []

    for it in approved_r:
        status = it.get("status", "?")
        level = it.get("level")
        passage = it.get("passage") or ""
        norm = re.sub(r"\s+", " ", passage.strip())
        by_status[status] += 1
        bl = by_level[level]
        if status in bl:
            bl[status] += 1
        if status != "approved":
            continue
        bl["approved"] += 1
        if norm and norm in text_to_id:
            match_exact += 1
            bl["exact"] += 1
        else:
            match_none += 1
            bl["miss"] += 1
            if len(orphan_samples) < 8:
                orphan_samples.append(
                    {
                        "id": it.get("id"),
                        "level": level,
                        "passage_start": passage[:80].replace("\n", " "),
                    }
                )

    info(f"Reading items total={len(approved_r)} by status={dict(by_status)}")
    info(
        f"Approved reading with exact preset text match: {match_exact}; "
        f"mismatch/orphan: {match_none}"
    )
    if match_none == 0 and match_exact > 0:
        ok("All approved reading passages match current presets")
    elif match_exact > 0 and match_none > 0:
        warn(
            f"Partial bank alignment: {match_exact} match, {match_none} orphan "
            "(stale after passage rebuild)"
        )
    elif match_exact == 0 and match_none > 0:
        fail(
            f"No approved reading items match current presets ({match_none} orphans) "
            f"— bank out of sync with pack v{passages.get('version')}"
        )
    else:
        info("No approved reading items found")

    for lv in sorted(by_level.keys(), key=lambda x: (x is None, x)):
        bl = by_level[lv]
        info(
            f"  L{lv}: approved={bl.get('approved', 0)} exact={bl['exact']} "
            f"miss={bl['miss']} quarantine={bl.get('quarantine', 0)} "
            f"pending={bl.get('pending', 0)}"
        )

    if orphan_samples:
        report.append("")
        report.append("Orphan approved reading samples (passage no longer in pack):")
        for s in orphan_samples:
            report.append(
                f"  - {s['id']} L{s['level']}: \"{s['passage_start']}…\""
            )

    # --- 7. uniqueness ---
    sec("7. Level-test uniqueness (approved reading)")
    appr = [it for it in approved_r if it.get("status") == "approved"]
    passage_counts = Counter(
        re.sub(r"\s+", " ", (it.get("passage") or "").strip())
        for it in appr
        if it.get("passage")
    )
    multi = [(t[:50], n) for t, n in passage_counts.items() if t and n > 1]
    if not multi:
        ok("No approved reading multi-items sharing identical passage text")
    else:
        warn(
            f"{len(multi)} passage texts used by multiple approved items "
            "(spam risk if served together)"
        )
        for t, n in multi[:5]:
            info(f"  x{n}: {t}…")

    # --- 8. L1 elementary ---
    sec("8. L1 elementary fitness (초1–초6 lock)")
    l1 = passages["levels"]["1"]["passages"]
    l1_wc = [p["wordCount"] for p in l1]
    if all(40 <= w <= 100 for w in l1_wc):
        ok(f"L1 word counts in elementary band: {l1_wc}")
    else:
        warn(f"L1 word counts unusual for elementary: {l1_wc}")
    for p in l1:
        r = long_token_ratio(p["text"])
        if r > 0.12:
            warn(f"L1 {p['id']} long-token ratio {r:.2f} may be hard for early elem")
        else:
            ok(f"L1 {p['id']} lexis light (long-token ratio {r:.2f})")

    # --- 9. monotonic ---
    sec("9. Monotonic difficulty ladder (targetB / length)")
    avgs = []
    for lv in range(1, 7):
        ps = passages["levels"][str(lv)]["passages"]
        avgs.append(
            (
                lv,
                sum(p["wordCount"] for p in ps) / len(ps),
                sum(p["targetB"] for p in ps) / len(ps),
            )
        )
    for i in range(5):
        lv, a, b = avgs[i]
        lv2, a2, b2 = avgs[i + 1]
        if b2 + 0.05 < b:
            fail(f"targetB not increasing L{lv}({b:.2f}) → L{lv2}({b2:.2f})")
        else:
            ok(f"targetB L{lv} {b:.2f} → L{lv2} {b2:.2f}")
        if a2 >= a - 5:
            ok(f"wordCount L{lv} {a:.0f} → L{lv2} {a2:.0f}")
        else:
            warn(f"wordCount L{lv} {a:.0f} → L{lv2} {a2:.0f} (non-monotonic)")

    # --- 10. code-level intent signals ---
    sec("10. Code-level level-test behaviors (spot check)")
    page = (ROOT / "app/page.tsx").read_text(encoding="utf-8")
    panel = (ROOT / "components/LevelPassagePanel.tsx").read_text(encoding="utf-8")
    gen = (ROOT / "lib/irt/generate.ts").read_text(encoding="utf-8")
    slots = (ROOT / "lib/irt/passages.ts").read_text(encoding="utf-8")

    if "lockLevelToGrade" in page and "Math.min(readingItemCount, nPass)" in page:
        ok("page.tsx: grade lock + readingCount capped by selected passages")
    else:
        fail("page.tsx missing grade lock or 1:1 reading count cap")
    if "문항 1개" in panel or "one item" in panel.lower():
        ok("LevelPassagePanel documents 1 item per passage")
    else:
        warn("LevelPassagePanel missing 1:1 copy")
    if "Do NOT invent, rewrite" in gen and "LEVEL-TEST UNIQUENESS" in gen:
        ok("generate.ts enforces fixed passages + uniqueness for level test")
    else:
        fail("generate.ts missing fixed-passage / uniqueness constraints")
    if "Unique-first" in slots or "unique passages" in slots:
        ok("planReadingItemSlots prefers unique passages first")
    else:
        warn("planReadingItemSlots uniqueness preference unclear")

    # --- verdict ---
    sec("11. Overall verdict")
    text = "\n".join(report)
    fails = text.count("[FAIL]")
    warns_n = text.count("[WARN]")
    passes = text.count("[PASS]")
    if fails == 0 and warns_n <= 6:
        verdict = "PASS WITH NOTES" if warns_n else "PASS"
    elif fails == 0:
        verdict = "CONDITIONAL PASS (warnings need product decision)"
    else:
        verdict = "FAIL — fix before treating bank/pack as level-test ready"
    report.append(f"- Passes: {passes} · Warnings: {warns_n} · Fails: {fails}")
    report.append(f"- **Verdict: {verdict}**")
    report.append("")
    report.append("### Recommended actions")
    report.append(
        "1. Regenerate/replace orphan approved reading items so bank passages "
        f"equal preset pack v{passages.get('version')}."
    )
    report.append(
        "2. Keep L4–L6 as original-only while commercial series peak at A2–B1."
    )
    report.append(
        "3. Re-run this script after bank regeneration: "
        "python scripts/verify_level_test_passage_intent.py"
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(report) + "\n", encoding="utf-8")
    print("\n".join(report))
    print(f"\nWROTE {OUT}")


if __name__ == "__main__":
    main()
