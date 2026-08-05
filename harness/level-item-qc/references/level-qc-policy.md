# Level item QC policy

Used by `level-item-qc` harness. Counts use **active** bank items only  
(`status` ∈ {`approved`, `pending`}; **exclude** `quarantine`).

## Default count targets (broadcast)

| Level | min total active | min per domain (vocab/grammar/reading) |
|---|---:|---:|
| L1–L6 | 9 | 3 |

Override via CLI: `--min-per-domain N --min-total N`.

Empty levels (0 items) → **fail** with `LEVEL_EMPTY` (unless `--allow-empty-levels`).

## Quality codes

| code | severity | meaning |
|---|---|---|
| `LEVEL_EMPTY` | error | no active items at this level |
| `COUNT_TOTAL_LOW` | error | active total < min_total |
| `COUNT_DOMAIN_LOW` | error | a domain has active count < min_per_domain |
| `COUNT_DOMAIN_ZERO` | error | domain missing entirely while others exist |
| `INCOMPLETE_STEM` | error | vocab instruction-only stem |
| `GENERIC_SYNONYM` | error | EN synonym shell unsuitable for placement |
| `OPTIONS_BAD` | error | not 4 unique MCQ options / bad answer |
| `READING_NO_PASSAGE` | error | reading without passage |
| `B_FAR_THETA` | warning | \|b−θ\| > 1.0 |
| `IRT_SOFT` | warning | a/c soft band |
| `SEED_ACTIVE` | error | irtSource=test still active (not quarantined) |
| `STATUS_PENDING` | info | pending items counted but not yet approved |

## Level verdict

- **fail** if any error-severity defect
- **warn** if warnings only (or pending-heavy)
- **pass** otherwise

## Overall

- overall **fail** if any level fails
- overall **warn** if any level warns and none fail
- overall **pass** if all levels pass
