# Level-test smoke report (agent-solved)

- **Generated:** 2026-08-05T11:45:03.317267+00:00
- **Harness:** level-test-smoke
- **Overall:** `pass`
- **Accuracy:** 18/18 = **100%**
- **Execution:** logical sequential lanes; Gemini solves without gold

## Level matrix

| Level | Verdict | Correct | Total | Accuracy |
|---|---|---:|---:|---:|
| L1 | **pass** | 3 | 3 | 100% |
| L2 | **pass** | 3 | 3 | 100% |
| L3 | **pass** | 3 | 3 | 100% |
| L4 | **pass** | 3 | 3 | 100% |
| L5 | **pass** | 3 | 3 | 100% |
| L6 | **pass** | 3 | 3 | 100% |

## Item-by-item

### L1

- ✓ `vocabulary-L1-fill-msfwxxgr-0` [vocabulary] chosen=1 gold=1 · OK
  - note: The Korean word '행복한' directly translates to 'Happy' in English.
- ✓ `grammar-L1-fill-msfwxxgr-3` [grammar] chosen=1 gold=1 · OK
  - note: The subject 'She' is third-person singular, which requires the verb 'is' in the simple present tense.
- ✓ `reading-L1-fill-msfwxxgr-6` [reading] chosen=0 gold=0 · OK
  - note: The passage details Nathaniel Adams Cole's life from learning piano and forming groups to becoming a solo vocalist and releasing albums, which comprehensively d

### L2

- ✓ `vocabulary-1` [vocabulary] chosen=0 gold=0 · OK,AMBIGUOUS
  - note: The Korean words '도착하다' and '도달하다' both mean 'to arrive' or 'to reach'.
- ✓ `grammar-1` [grammar] chosen=1 gold=1 · OK
  - note: The subject "My brother" is third-person singular, and the adverb "often" indicates a habitual action, requiring the simple present tense form "plays".
- ✓ `reading-1` [reading] chosen=0 gold=0 · OK
  - note: The letter's main purpose is for Michael's mother to request an extension for his homework deadline from Ms. White.

### L3

- ✓ `vocabulary-1-3` [vocabulary] chosen=0 gold=0 · OK,AMBIGUOUS
  - note: The Korean words '달성하다' and '성취하다' both directly translate to 'achieve' in English.
- ✓ `grammar-1-3` [grammar] chosen=0 gold=0 · OK
  - note: The subject of the sentence is 'One', which is singular, requiring a singular verb 'is' for subject-verb agreement.
- ✓ `reading-1-3` [reading] chosen=0 gold=0 · OK
  - note: The passage consistently argues that having too many choices, or a wide range of options, can lead to unhappiness, stress, and regret, rather than satisfaction.

### L4

- ✓ `vocabulary-L4-fill-msfwz4fx-0` [vocabulary] chosen=0 gold=0 · OK,AMBIGUOUS
  - note: The Korean words '근면한' and '성실한' both translate to 'diligent' in English, meaning hardworking and conscientious.
- ✓ `grammar-L4-fill-msfwz4fx-2` [grammar] chosen=0 gold=0 · OK
  - note: This is a Type 2 conditional sentence, which uses 'If + past simple' in the condition clause and 'would + base form' in the main clause to express an unreal or 
- ✓ `reading-L4-fill-msfwz4fx-5` [reading] chosen=0 gold=0 · OK
  - note: The passage contrasts the quick, pre-programmed development of other mammals (which limits their adaptability) with the long period of helplessness in humans du

### L5

- ✓ `vocabulary-L5-fill-msfx02ht-0` [vocabulary] chosen=0 gold=0 · OK
  - note: The word 'ubiquitous' means present, appearing, or found everywhere, which perfectly matches the Korean meaning '어디에나 있는, 아주 흔한'.
- ✓ `grammar-L5-fill-msfx02ht-2` [grammar] chosen=0 gold=0 · OK
  - note: After a preposition ('on'), the verb must be in its gerund (-ing) form.
- ✓ `reading-L5-fill-msfx02ht-5` [reading] chosen=0 gold=0 · OK
  - note: The passage's primary purpose is to explain the meanings of various idiomatic expressions that include the word 'hand'.

### L6

- ✓ `vocabulary-L6-fill-msfx10co-0` [vocabulary] chosen=0 gold=0 · OK
  - note: The Korean phrase '어디에나 있는, 아주 흔한' translates to 'present everywhere, very common,' which perfectly matches the definition of 'ubiquitous.'
- ✓ `grammar-L6-fill-msfx10co-2` [grammar] chosen=0 gold=0 · OK
  - note: When a negative adverbial phrase like 'Not until' begins a sentence, it requires subject-auxiliary inversion. For simple past tense, this means using 'did' + su
- ✓ `reading-L6-fill-msfx10co-5` [reading] chosen=0 gold=0 · OK,AMBIGUOUS
  - note: The passage introduces the RFID tracking nametags in Texas schools, explains the reasons for their implementation (financial benefits), and then delves into the

## Mismatches (possible key/item issues)

_None — all smoke items scored correct._

## Interpretation

- High accuracy: bank keys mostly consistent with solvable stems.
- KEY_MISMATCH + HIGH_CONF_WRONG: review gold key or stem ambiguity.
- SOLVER_ERROR: API/transient; re-run smoke.

