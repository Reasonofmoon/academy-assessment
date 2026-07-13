# Design: cat_responses → 2PL calibration pipeline

**Status:** Design + thin adapter (sandbox estimator)  
**Date:** 2026-07-13  
**Constraint:** Do **not** auto-merge calibrated params into product banks without human gate.

---

## 1. Goal

Connect **real CAT session logs** (`echobridge-web` `public.cat_responses`) to the **same matrix → 2PL estimation flow** proven on Dicht sandbox (`academy-assessment` `scripts/irt_sandbox`), so we can:

1. Re-estimate item `(a, b)` (and later `c` for 3PL) from live data  
2. Promote `irtSource: "heuristic" → "empirical"` only after QC gates  
3. Keep product content (curated service JSON, generated-bank) **unchanged until approve**

Non-goals (this design phase):

- Full production MML/EM (use sandbox joint Newton only as **v0**; v1 = proper MML/EM or `mirt`/`py-irt`)  
- Auto-overwrite of echobridge `src/data/curated/*.service.json`  
- Absolute CEFR/Lexile certification without sample size gates  

---

## 2. Current pieces

| Piece | Location | Role |
|-------|----------|------|
| Response log schema | `echobridge-web/migrations/cat_responses.sql` | One row per administered item |
| Log writer | `echobridge-web` `POST /api/cat/log` | Session-end batch insert |
| Sandbox profile/convert | `academy-assessment/scripts/irt_sandbox/*` | Wide CSV → long → matrix |
| Sandbox 2PL | `estimate_2pl.py` | Educational joint Newton 2PL |
| Item banks | echobridge curated + academy generated-bank | Content + current `a,b,c` |
| Readiness gate | `LEVELTEST_READINESS_VERDICT.md` | Needs empirical params |

### 2.1 Schema alignment

| cat_responses | sandbox long (`cat_responses_long.jsonl`) | matrix |
|---------------|-------------------------------------------|--------|
| `session_id` | `session_id` | person axis |
| `item_id` | `item_id` | item axis |
| `correct` | `correct` | 0/1 cell |
| `step` | `step` | order (not used in 2PL v0) |
| `domain` / `dimension` / `passage_id` | same / dummy | filter facets |
| `theta_*` / `se_*` / `fisher_*` | optional | **not inputs** to item calibration |
| `selected_option_id` | optional | distractor analysis (later) |
| `response_time_ms` | optional | outlier filter |
| `created_at` | n/a | cohort filter |

**Key difference vs Dicht:** CAT is **sparse** (each person sees ~12–24 items, not all bank items). Matrix cells are mostly missing (`null`) by design.

---

## 3. Target architecture

```
[Student browser]
      │  CAT session
      ▼
[echobridge /api/cat/next]  ── uses current item params (heuristic|empirical)
      │
      ▼
[echobridge /api/cat/log] ──► Supabase public.cat_responses
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
           export job (batch)            analytics dash (later)
                    │
                    ▼
        responses_export.jsonl  (or CSV)
                    │
                    ▼
   academy-assessment scripts/irt_sandbox/
     from_cat_responses.py  → response_matrix.json  (sparse)
     estimate_2pl.py        → item_params_2pl.json
     write_summary.py       → SANDBOX_RESULTS / QC report
                    │
                    ▼
        QC gates (n_obs, rpb, a/b bounds)
                    │
         human approve (required)
                    │
                    ▼
        apply_params_patch.json
                    │
                    ▼
   echobridge apply job (optional, separate PR)
     → update curated item irtA/irtB + irtSource=empirical
     → never silent overwrite
```

### 3.1 Repo ownership

| Concern | Home repo | Why |
|---------|-----------|-----|
| Log collection & RLS | **echobridge-web** | Production traffic, Supabase keys |
| Calibration offline jobs | **academy-assessment** `scripts/irt_sandbox` (v0) or shared `packages/irt-calibrate` (v1) | Already has matrix/2PL path |
| Param apply + deploy | **echobridge-web** | Owns runtime item JSON |
| Content bank (AI items) | academy-assessment generated-bank | Separate from CAT runtime until export/merge |

v0: keep calibration scripts in academy-assessment; export logs into `data/irt-sample/live/` (gitignored).  
v1: extract pure estimator to shared package used by both.

---

## 4. Data contracts

### 4.1 Export format (echobridge → file)

Minimum export row (JSONL), one line per `cat_responses` row:

```json
{
  "session_id": "uuid-or-text",
  "step": 3,
  "item_id": "L2-00432-D2_Meaning-1",
  "domain": "vocabulary",
  "dimension": "D2_Meaning",
  "passage_id": null,
  "correct": true,
  "selected_option_id": "L2-00432-D2_Meaning-1-C",
  "response_time_ms": 4200,
  "created_at": "2026-07-13T10:00:00Z"
}
```

Filters recommended at export time:

- `created_at` in pilot window  
- optional `domain in ('vocabulary','reading')`  
- drop rows with `response_time_ms < 500` or `> 180000` (configurable)  
- drop unfinished sessions if you add `pilot_sessions.status` later  

### 4.2 Sparse matrix contract (already used by estimate_2pl)

```json
{
  "person_ids": ["session-A", "session-B"],
  "item_ids": ["item-1", "item-2"],
  "matrix": [[1, null], [0, 1]],
  "source": "cat_responses",
  "sandbox": false
}
```

- Person key = **`session_id`** (not name; PII-safe)  
- Missing = not administered (CAT)  
- Duplicate `(session_id, item_id)`: keep **last step** or first; log count  

### 4.3 Calibration output contract

```json
{
  "model": "2PL",
  "D": 1.7,
  "items": [
    {
      "item_id": "L2-00432-D2_Meaning-1",
      "a": 1.12,
      "b": -0.41,
      "c": 0.0,
      "n_obs": 87,
      "p_plus": 0.55,
      "irtSource": "sandbox_2pl_jmle",
      "qc": { "pass": true, "flags": [] }
    }
  ],
  "product_bank_merge": false,
  "gates": { "min_n_obs_b": 50, "min_n_obs_a": 100 }
}
```

Promotion to `irtSource: "empirical"` requires QC pass + human flag file `APPROVE_APPLY.json`.

---

## 5. Pipeline stages (v0 → v1)

### Stage A — Collect (echobridge)

1. Ensure Supabase env + `cat_responses` migration applied  
2. `BETA_PAUSED=false` only for pilot cohort  
3. Monitor: `count(*)`, distinct `item_id`, distinct `session_id`  
4. Export (implemented in **echobridge-web**):

```bash
# repo: echobridge-web
npm run export:cat-responses:sql          # SQL for Dashboard
npm run export:cat-responses -- --since 2026-07-01 --domains vocabulary,reading
npm run export:cat-responses -- --out ../academy-assessment/data/irt-sample/live/cat_responses.jsonl
```

Docs: `echobridge-web/docs/CAT_RESPONSES_EXPORT_AND_EMPIRICAL_APPLY.md`

### Stage B — Ingest & matrix (academy irt-sandbox)

```
python scripts/irt_sandbox/from_cat_responses.py \
  --in data/irt-sample/live/cat_responses.jsonl \
  --out-dir data/irt-sample/out-live
```

Produces `response_matrix.json` + `convert_meta.json` (same shape as Dicht path).

### Stage C — Estimate

```
python scripts/irt_sandbox/estimate_2pl.py data/irt-sample/out-live/response_matrix.json
```

(v0 reuses joint Newton; v1 swap for MML/EM without changing I/O files.)

### Stage D — QC gates

Implemented: `scripts/irt_sandbox/qc_item_params.py`

```bash
python scripts/irt_sandbox/qc_item_params.py --profile pilot data/irt-sample/out-live
python scripts/irt_sandbox/qc_item_params.py --profile smoke data/irt-sample/out-fixture
# or via pipeline (fixture defaults to smoke, live to pilot)
python scripts/irt_sandbox/run_live_pipeline.py --fixture
```

| Gate | `pilot` | `production` | `smoke` (fixture) |
|------|---------|--------------|-------------------|
| min n_obs **b** | 30 | 500 | 8 |
| min n_obs **a** | 50 | 1000 | 12 |
| a in [0.2, 2.5] | clip + fail promote | same | same |
| \|b\| ≤ 3.5 | clip + fail promote | same | same |
| p+ in (0.05, 0.95) | fail extremes | same | same |
| rpb ≥ threshold | 0.15 (fail if low) | 0.15 + required | 0.10 |
| exposure rate | log only | log only | log only |

Outputs (next to matrix): `item_params_qc.json`, `QC_REPORT.md`, `APPROVE_APPLY.draft.json`.

Items failing gates stay **heuristic** in runtime. Draft is **not** auto-applied.

### Stage E — Human approve & apply

1. Review `QC_REPORT.md` / `item_params_qc.json`  
2. Copy `APPROVE_APPLY.draft.json` → `APPROVE_APPLY.json`, set `"approved": true`  
3. echobridge (implemented):

```bash
# repo: echobridge-web — default dry-run
npm run apply:empirical -- --approve ../academy-assessment/data/irt-sample/out-live/APPROVE_APPLY.json
# only after human review
npm run apply:empirical:write -- --approve ../academy-assessment/data/irt-sample/out-live/APPROVE_APPLY.json
```

4. Report + backups under `echobridge-web/data/exports/empirical-apply/`  
5. Bump bank version / deploy; keep git commit of service JSON deltas

---

## 6. CAT-specific estimation notes

1. **Sparse design:** Most matrix cells null — estimator must ignore nulls (already true in sandbox 2PL).  
2. **Adaptive selection bias:** Classic issue — MLE item params from CAT can be biased. Mitigations (v1+):  
   - MML with correct sampling model  
   - online calibration / moving windows  
   - freeze high-exposure items earlier  
3. **3PL:** Runtime uses 3PL; v0 2PL sets `c=0`. Later: fix c by item type (MCQ 0.25) or estimate with large N.  
4. **Reading vs vocab:** Calibrate **per domain** (separate matrices) so scales do not mix physics-style Dicht with English CAT.  
5. **Scale anchoring:** After estimation, re-center θ mean 0 (sandbox already centers); optionally anchor to CEFR prior blend α (PILOT_PLAN).  

---

## 7. Security & privacy

- Export only `session_id`, never student name/email in calibration files  
- `data/irt-sample/live/` gitignored  
- Supabase service role only on server  
- Calibration outputs may include item_ids only (public content ids OK)  

---

## 8. Implementation checklist

### Done (this change set)

- [x] Design doc (this file)  
- [x] `from_cat_responses.py` adapter (JSONL/CSV → sparse matrix)  
- [x] Shared matrix path into existing `estimate_2pl.py` (writes next to matrix)  
- [x] Fixture + runner: `make_fixture_cat_responses.py`, `run_live_pipeline.py --fixture`  
- [x] npm: `irt:from-cat`, `irt:from-cat:fixture`  
- [x] QC module (`qc_item_params.py`) + `irt:qc` / pipeline Stage D  

### Done (export + apply)

- [x] echobridge `export-cat-responses.ts` / `npm run export:cat-responses`  
- [x] echobridge `apply-empirical-params.ts` dry-run / `--write` + APPROVE gate  

### Done (CI)

- [x] CI: academy `.github/workflows/irt-sandbox.yml` (`run_live_pipeline.py --fixture`)  
- [x] CI: echobridge `.github/workflows/cat-irt-smoke.yml` (export SQL + apply dry-run gate)  

### Next implementation

- [ ] Upgrade estimator to MML/EM when pilot N grows  
- [ ] Staging deploy + re-enable “예비 보정” only after M3  
- [ ] Live Supabase export once `.env.local` + pilot rows exist

---

## 9. Success criteria

| Milestone | Criterion |
|-----------|-----------|
| M0 | Adapter accepts fixture JSONL shaped like cat_responses; 2PL runs without bank writes |
| M1 | ≥ 30 sessions exported from real Supabase; matrix non-empty for ≥ 20 items |
| M2 | ≥ 1 domain with ≥ 10 items passing pilot n_obs gates |
| M3 | Human-approved patch applied to staging bank with `irtSource=empirical` |
| M4 | Production readiness sample sizes (b≥500) for core placement items |

---

## 10. Explicit non-actions

- Do not merge Dicht `dicht:Q*` params into English banks  
- Do not set `irtSource=empirical` without APPROVE_APPLY  
- Do not disable “예비 보정” UI until M3+ on staging  
