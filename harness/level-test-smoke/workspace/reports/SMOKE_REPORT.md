# Level-test smoke report (agent-solved)

- **Generated:** 2026-08-05T11:46:50.125719+00:00
- **Harness:** level-test-smoke
- **Overall:** `pass`
- **Accuracy:** 3/3 = **100%**
- **Execution:** logical sequential lanes; Gemini solves without gold

## Level matrix

| Level | Verdict | Correct | Total | Accuracy |
|---|---|---:|---:|---:|
| L1 | **pass** | 3 | 3 | 100% |

## Item-by-item

### L1

- ✓ `vocabulary-L1-fill-msfwxxgr-0` [vocabulary] chosen=1 gold=1 · OK
  - note: The Korean word '행복한' translates directly to 'Happy' in English.
- ✓ `grammar-L1-fill-msfwxxgr-3` [grammar] chosen=1 gold=1 · OK
  - note: The subject 'She' is third-person singular, which requires the verb 'is' for the present tense of 'to be'.
- ✓ `reading-L1-elem-msg0um01-0` [reading] chosen=0 gold=0 · OK
  - note: The passage introduces Max, describes him, talks about daily activities with him, and expresses love for him. All these details revolve around 'My pet dog, Max'

## Mismatches (possible key/item issues)

_None — all smoke items scored correct._

## Interpretation

- High accuracy: bank keys mostly consistent with solvable stems.
- KEY_MISMATCH + HIGH_CONF_WRONG: review gold key or stem ambiguity.
- SOLVER_ERROR: API/transient; re-run smoke.

