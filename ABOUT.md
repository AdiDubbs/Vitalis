# About Vitalis

> **Research and educational software.** Vitalis is not a medical device, is not FDA-cleared,
> and must not be used to make clinical decisions. Everything below describes an engineering
> project, not a validated diagnostic instrument.

---

## 1. What Vitalis is

Vitalis is a **multi-modal differential diagnosis engine**. It accepts what a clinician
actually has at the point of intake — demographics, a list of observed symptoms, a free-text
clinical note, lab values, medical images, and ECG waveforms — and produces a *ranked
probability distribution* over 79 candidate diagnoses, together with a per-diagnosis
explanation of which pieces of evidence pushed the estimate up or down.

The system is deliberately **not** an end-to-end neural network that maps a patient to a
diagnosis. It is a **Bayesian evidence-fusion layer** with narrow, well-scoped ML models
plugged into it as additional evidence sources. That single architectural choice drives
almost every other decision documented here.

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Structured  │   │ Clinical note│   │   Imaging    │   │     ECG      │
│  symptoms    │   │  + lab PDF   │   │ X-ray/MRI/…  │   │  waveform    │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │ regex + negation │ CNN classifiers  │ sklearn
       │                  ▼                  ▼                  ▼
       └────────────► feature dict ◄───── model logits ◄─────────┘
                            │
                            ▼
              ┌──────────────────────────────┐
              │  Log-space Bayesian fusion   │
              │  prior → +Σ log(LR) → +bumps │
              │      → constraints → softmax │
              └──────────────┬───────────────┘
                             ▼
        ranked probabilities · per-dx contributions · red flags
                  · follow-up questions · recommended tests
```

---

## 2. Motivation and reasoning

### Why a probabilistic engine instead of a single classifier

The tempting design is: collect a large labeled patient dataset, train one big model,
return `argmax`. Three problems made that a non-starter for this project:

1. **No dataset exists that spans the input space.** There is no public corpus that pairs
   free-text notes, structured symptoms, chest X-rays, MRIs, dermoscopy images, and ECGs
   for the *same* patients across 79 conditions. The available datasets are single-modality
   and single-task (CheXpert-style X-ray sets, HAM10000 skin lesions, brain-MRI sets, …).
   Any monolithic model would have to be trained on a synthetic join, which teaches the
   model the join, not medicine.
2. **Explainability is a hard requirement, not a feature.** A ranked list without "why" is
   clinically useless and ethically dubious. A log-linear Bayesian model gives per-feature
   contributions for free: every term in the sum *is* an explanation, in the same units.
3. **Knowledge must be auditable and editable.** Likelihood ratios come from published
   diagnostic-accuracy literature. Encoding them in YAML means a domain expert can inspect
   and correct them without retraining anything. Weights inside a neural net cannot be
   reviewed by a clinician.

### Why the ML models are narrow

Each vision model does exactly one thing it can plausibly learn from a real, labeled,
single-purpose dataset (is this chest X-ray pneumonic? is this lesion melanoma?). Their
output is treated as *one more piece of evidence*, not as the answer. This keeps the
failure mode graceful: a bad image classification perturbs a score, it does not replace
the reasoning.

---

## 3. System architecture

### 3.1 Repository layout

| Path | Role |
|---|---|
| [`vitalis_engine/`](vitalis_engine) | The reasoning core. No web framework, no I/O beyond config/model loading. |
| [`form_app.py`](form_app.py) | Flask API + static host for the built React app. All request validation, upload handling, case storage. |
| [`configs/`](configs) | The entire clinical knowledge base as YAML. |
| [`models/`](models) | Serialized model weights + [`manifest.json`](models/manifest.json), the artifact contract. |
| [`training/`](training), [`tools/`](tools) | Offline model training and data-prep scripts. Not imported at runtime. |
| [`frontend/`](frontend) | React 19 + Vite + Mantine client. |
| [`tests/`](tests) | Contract tests for model artifacts and submission validation. |
| [`cases/`](cases) | Per-case result storage (0700 dirs, one UUID per case). |
| [`legacy/`](legacy), [`configs/archived/`](configs/archived) | Superseded implementations kept for provenance. |

### 3.2 Engine module boundaries

The engine is split so that each module has one reason to change:

| Module | Responsibility | Why it's separate |
|---|---|---|
| [`core.py`](vitalis_engine/core.py) | Orchestration only — `run_case()` loads config, calls each stage in order, assembles the response. | The one place to read to understand the pipeline end to end. 136 lines. |
| [`config.py`](vitalis_engine/config.py) | YAML/JSON loading, caching, and *shape normalization*. | Config format changes stay here; nothing downstream knows the on-disk layout. |
| [`nlp.py`](vitalis_engine/nlp.py) | Note → feature dict. Lab-value regex, symptom phrase matching, negation and family-history detection. | Text extraction is the noisiest part; isolating it makes it independently testable. |
| [`inference.py`](vitalis_engine/inference.py) | Model loading and image/signal → logit bumps. | The only module that imports torch. Its failure is contained (see §5.4). |
| [`probability.py`](vitalis_engine/probability.py) | Priors, Bayesian fusion, contribution analysis, follow-up selection. | The mathematical heart; pure functions, no I/O except exclusions. |
| [`heuristics.py`](vitalis_engine/heuristics.py) | Red-flag rule evaluation. | Deliberately *outside* the probabilistic path (see §4.5). |
| [`data_structs.py`](vitalis_engine/data_structs.py) | `FeatureEvidence`, `Contribution` dataclasses. | Shared vocabulary between stages, no behavior. |

`run_case()` is keyword-only (`*` in the signature) because it takes ten-plus optional
arguments; positional calls would be unreadable and silently mis-ordered.

---

## 4. The diagnostic engine in detail

### 4.1 Log-space accumulation

All scoring happens in log space, in one accumulator per diagnosis:

```
S[d] = log(prior[d])
     + Σ  confidence(f) · log(LR[f][d])        # symptom / lab evidence
     + Σ  model_bump[d]                        # imaging / ECG evidence
     + constraint penalties
P    = softmax(S)
```

**Why log space:** multiplying dozens of likelihood ratios in linear space underflows and
makes contributions non-comparable. In log space every evidence source contributes an
*additive, signed, same-unit* term — which is exactly what the explanation UI needs. The
softmax is max-shifted (`exp(S[d] - max S)`) for numerical stability.

**Why confidence-weighted LRs:** `configs/confidence_map.yaml` assigns each feature a
reliability in `[0, 1]` — a troponin result is `0.95`, a self-reported symptom might be
`0.7`. The contribution is `confidence · log(LR)`, so unreliable evidence moves the
posterior less. This is a pragmatic stand-in for modelling measurement error properly.

### 4.2 Priors

Priors are demographic. `get_demographic_priors()` buckets age into
`0-4 / 5-17 / 18-29 / 30-44 / 45-64 / 65+`, selects a sex-specific prevalence table, and
normalizes across the candidate set.

**Why coarse age buckets:** prevalence data (GBD-derived, see [`scripts/gbd_to_priors.py`](scripts/gbd_to_priors.py))
is published in bands. Interpolating to per-year granularity would invent precision the
source data does not have.

**Why normalize:** the engine answers "given that this patient has *one of* these 79
conditions, which is it?" — a closed-world assumption. `OTHER_UNCERTAIN_DIAGNOSIS` exists
in `dx_list` as an explicit escape hatch so the distribution has somewhere to put mass when
nothing fits.

### 4.3 Three penalties that shape the ranking

Raw likelihood-ratio accumulation has a well-known pathology: a disease with *no* listed
LR for any of the patient's symptoms is untouched by the evidence, so it floats up on its
prior alone and outranks diseases that were actively evaluated. Three explicit penalties
address this ([`probability.py:92`](vitalis_engine/probability.py:92)):

| Penalty | Value | Purpose |
|---|---|---|
| `MISSING_SYMPTOM_LR` | `log(0.3) ≈ −1.20` | A present symptom that a disease's LR table does not mention is weak evidence *against* that disease, not neutral. |
| `NO_SYMPTOM_SUPPORT_PENALTY` | `−3.0` | If any symptom is present and a disease gained *no* positive support from any of them, it is pushed down hard. Kills the "high-prior free rider" failure. |
| Missing-mandatory penalty | `−10.0`, or `0.0` if model evidence exists | Diseases declare `mandatory_features` (e.g. pneumonia requires cough or a positive X-ray). Absent all of them, the disease is effectively eliminated. |

The **adaptive** part of the last one is the interesting decision. `_adaptive_mandatory_penalty()`
waives the penalty entirely when a model produced positive evidence for that diagnosis. The
reasoning: if the chest X-ray model is confident about pneumonia, the patient not having
*checked the cough box* should not veto it. Objective evidence overrides missing subjective
evidence. The penalty is tagged `MISSING_MANDATORY_MIN` vs `MISSING_MANDATORY` so the reason
is visible in the contributions log.

Negative evidence (`f.value is False`) applies a flat `−0.5 · confidence` only to diseases
where the feature would have been *supportive* (`LR > 1`). Absence of a symptom that was
never diagnostic for a disease is not informative.

### 4.4 Model evidence → logit bumps

Image and ECG models emit a class distribution. Converting it into the log-space accumulator
([`inference.py:193`](vitalis_engine/inference.py:193)):

```python
bump = log(p / (1 - p)) · confidence · 10.0     # clamped to ±12
```

Three decisions worth calling out, each with a trade-off:

- **Log-odds, not raw probability.** Keeps the term in the same units as the LR terms, so
  the fusion stays a coherent sum rather than a mix of scales.
- **The `10.0` multiplier is a tuning constant, not a derivation.** It exists so imaging
  evidence dominates demographic priors — a confidently pneumonic X-ray should beat "this
  patient's age band makes influenza more common". It is honest to call this what it is:
  a hand-set gain. The `±12` clamp in `_apply_bump()` is the guardrail that keeps a single
  overconfident model from saturating the softmax.
- **Temperature `0.3` sharpens model outputs** before softmax ([`inference.py:160`](vitalis_engine/inference.py:160)).
  Standard temperature scaling *calibrates* (usually `T > 1`, softening). Here `T < 1`
  deliberately sharpens, which increases confidence rather than calibrating it. This is a
  known deviation from best practice — see §9.

Multi-label models aggregate before bumping: the skin model's seven HAM10000 classes map
down to three diagnoses (`nv`, `bkl`, `df`, `vasc` all → `BENIGN_SKIN_LESION`), with
probabilities **summed** before the log-odds transform. Summing first is correct — the
probability of "benign" is the probability of the union of benign classes. Note that `akiec`
maps to nothing and is intentionally dropped, which the test suite asserts explicitly.

Fracture handling is context-dependent: without a stated body part, a positive fracture
classification bumps all three fracture diagnoses; with `fracture_body_part` supplied, it
bumps only the anatomically consistent one. The UI enforces that the body part accompanies
the upload.

### 4.5 Red flags are outside the probability model

`evaluate_red_flags()` is a separate rule engine over the same feature dict, with `any`/`all`
trigger logic and a severity level. It does not touch `S[d]`.

**Why deliberately separate:** "fever + confusion → possible sepsis" is not a claim about
which of 79 diagnoses is most likely — it is a claim that *something time-critical may be
happening regardless of the ranking*. Folding it into the softmax would let a high-probability
benign diagnosis bury it. Keeping it orthogonal means a critical alert surfaces even when
the ranked list looks unremarkable. The frontend honors this: any triggered red flag forces
the case to "High Risk" independent of the top probability.

### 4.6 Follow-up questions

`get_follow_up_symptoms()` walks `configs/primary_to_branches.yaml`: each selected symptom
links to related *sections* and to specific `suggest_features`. Candidates already selected
are dropped, section-derived candidates are filtered to `confidence > 0.75`, and the result
is sorted by confidence descending.

**Why config-driven rather than information-gain computed:** the mathematically principled
choice is to ask the question that maximizes expected entropy reduction over the current
posterior. That was rejected for now because it would surface questions that are statistically
informative but clinically bizarre, and because it makes the follow-up list unstable — it
churns on every selection. A curated branch map produces questions a clinician recognizes as
sensible. Information-gain ranking is a natural future upgrade *within* the curated candidate
set (§10).

The frontend debounces follow-up requests by 500 ms so that rapid multi-select does not
generate a request per click.

---

## 5. Data and knowledge design

### 5.1 One consolidated disease file

`configs/diseases.yaml` (79 entries, ~2300 lines) holds, per disease: `full_name`,
`diagnostic_criteria` (mandatory/negative features), `recommended_tests`, `likelihood_ratios`,
and `prevalence` by sex and age band. `_metadata.lr_sources` cites the literature behind the
LR values (Ebell et al. on CAP, Alvarado score meta-analysis, PIOPED/Wells for PE, …).

This file is a **deliberate consolidation** of four earlier files, still visible in
[`configs/archived/`](configs/archived): `disease_database.yaml`, `lr_store_evidence_based.json`,
`priors_data.yaml`, `exclusions.yaml`. The split version required four loads and four
cross-file edits to add one disease, and drifted — a disease could exist in the priors file
but not the LR store. One file per disease-concept makes the invariant "a disease is complete"
locally checkable.

**Trade-off accepted:** `load_diseases_all()` now performs three different *transposes* of the
same document — priors keyed by disease, LR store **keyed by symptom** (inverted, because
fusion iterates features and needs `LR[feature][disease]`), and a display DB. That inversion
cost is paid once per process and cached, which is the right side of the trade.

### 5.2 Config catalogue

| File | Contents | Scale |
|---|---|---|
| `system.yaml` | `dx_list` (the closed world), `dx_negative_evidence_map` (mandatory features per dx), `runtime` paths | 79 dx, 75 mandatory-feature entries |
| `diseases.yaml` | Per-disease criteria, LRs, prevalence, recommended tests | 79 diseases |
| `symptom_tree_expanded.yaml` | Sectioned symptom nodes (`id`, `text`, `feature_id`) | 15 sections, 180 nodes |
| `confidence_map.yaml` | Feature → reliability in `[0,1]` | 162 features |
| `primary_to_branches.yaml` | Symptom → related sections + suggested features | 18 branch links |
| `lab_ranges.yaml` | Reference ranges + the feature IDs to emit when high/low | 42 analytes |
| `red_flags.yaml` | Trigger rules with severity and clinical message | 8 rules |

### 5.3 The manifest as an artifact contract

[`models/manifest.json`](models/manifest.json) declares, per artifact: file path, builder
identity, class labels **in training order**, and optionally `input_size` and `normalization`.

**Why a manifest rather than hardcoded paths:** label order is the single most dangerous
implicit coupling in an ML system — swap two labels and the system silently inverts a
diagnosis. Declaring it next to the weights makes it checkable, and
[`tests/test_model_artifact_contracts.py`](tests/test_model_artifact_contracts.py) asserts that
the manifest's labels and input size match what is embedded in the checkpoint.

Per-artifact preprocessing overrides exist because the models were trained by different
scripts at different times. The MRI model uses `input_size: 256` and `normalization: null`
(trained on raw `ToTensor()` output, no ImageNet normalization). Forcing a single global
preprocessing path would silently degrade that model. Encoding the difference in the manifest
makes the inconsistency **explicit and testable** rather than hidden.

`MODEL_CONFIGS` in `inference.py` maps a builder name to a torchvision architecture, and
`_build_model()` constructs it with `weights=None` and reshapes the final layer.
`load_state_dict(..., strict=True)` is intentional: a partial load is a corrupted model, and
failing loudly at load time beats returning plausible garbage.

### 5.4 Degradation strategy

Optional dependencies are guarded at import (`ECG_OK`), and every upload path records a
user-facing outcome via `_record_upload_result()` with a status of `analyzed` / `failed` and
a `contributed` boolean. An unreadable image produces a visible "could not be analyzed"
message; it does not fail the case and does not silently vanish.

**Why this matters:** the worst outcome is a user believing their X-ray was considered when
it was dropped. The `upload_results` array is surfaced in the results UI for exactly that
reason, and `test_unreadable_image_returns_a_visible_upload_failure` locks the behavior in.

---

## 6. Text extraction design

`extract_features_from_note()` runs two passes over the combined note + lab text:

1. **Lab regex pass** — ~30 analytes with multiple alias patterns each (`total leukocyte count`,
   `tlc`, `wbc`). A matched value is compared against `lab_ranges.yaml` and emits the
   configured `high_feature`/`low_feature`. A unit-scale heuristic divides by 1000 when the
   value exceeds `max × 100` (catching cells/µL reported where 10⁹/L was expected).
   The **last** match wins, on the assumption that a lab PDF's final occurrence is the result
   rather than a header or reference-range mention.

2. **Symptom phrase pass** — a curated phrase → `feature_id` map, each phrase compiled to a
   word-boundary regex with flexible whitespace, gated by two context checks:
   - `_is_negated()` — finds the enclosing sentence, then looks 50 chars before the match for
     `no / denies / without / negative for / rules out / r-slash-o`, 10 chars before for a bare
     `not`, and 15 chars after for trailing forms (`-free`, `absent`, `is not`).
   - `_is_family_history()` — looks 80 chars back for `family history of`, `mother had`, etc.,
     but bails out if `patient` appears in the nearest 50 chars, so "patient's mother had
     diabetes; patient reports chest pain" is not misattributed.

**Why regex and hand-context rules instead of a clinical NLP model:** negation detection
(negex/ConText-style) is a solved-enough problem with well-understood failure modes, and the
alternative — a transformer trained on clinical text — introduces a large dependency, a
license question, and an unauditable failure surface for a subsystem that only needs to emit
boolean features. spaCy is loaded with `parser` and `ner` disabled and is currently used only
as an optional handle; the extraction itself is pure regex. This is honest about what the
code does — it is a lexical matcher, not semantic understanding.

**Known limits, accepted deliberately:** the phrase map is a fixed vocabulary (no synonym
expansion — "SOB" is not mapped to shortness of breath), and negation scope is character-window
heuristic, so complex nested negation ("cannot rule out the absence of…") will be wrong.
Every extracted feature enters the fusion at its `confidence_map` weight rather than at 1.0,
which limits the damage of a bad extraction.

---

## 7. API and backend design

### 7.1 Server-owned intake contract

`INTAKE_SCHEMA` in [`form_app.py:18`](form_app.py:18) is the single definition of what the
intake accepts: age bounds, allowed sex values, symptom count cap, note length cap, and
per-upload-field allowed extensions and size limits. It is **served to the client** at
`GET /api/intake-schema`, and enforced server-side in `_validate_submission()`.

**Why one schema, published:** duplicating limits in the React app guarantees eventual drift
where the UI permits what the server rejects. Publishing the server's own rules makes the
client's validation a *projection* of the authority rather than a second source of truth.

### 7.2 Validation before side effects

`_validate_submission()` runs to completion and returns a **field → message** error dict
before any file is written to disk or any model is loaded. All errors are returned at once
(HTTP 400), not first-error-wins, so the user fixes everything in one pass.

Notable checks: symptom IDs are validated against `_known_symptom_ids()` derived from the
symptom tree, so an arbitrary string cannot enter the feature dict; duplicates are rejected;
upload size is measured by seeking the stream without consuming it; text-note uploads must
decode as UTF-8; and a fracture image and its body part are required together in both
directions.

### 7.3 Case storage and access control

Each submission creates `cases/<uuid4>/` with mode `0700`, and `result.json` written through
`os.open(..., O_EXCL, 0o600)`. Uploads land in a `inference-inputs/` subdirectory that is
removed in a `finally` block — they exist only for the duration of inference.

Retrieval at `GET /api/cases/<id>` requires (a) a syntactically valid UUID and (b) that the
ID is present in the caller's signed session, which caps at the 20 most recent cases. A case
the session does not own returns **404, not 403** — a 403 would confirm existence.

**What is deliberately not persisted:** raw clinical note text, original filenames, upload
paths, and the uploaded files themselves. The saved record keeps demographics, selected
symptom IDs, a `doctor_note_provided` boolean, and the analysis output. On any exception the
whole case directory is `rmtree`'d so a failed request leaves nothing behind.

Responses carry `Cache-Control: no-store`. Session cookies are `HttpOnly`, `SameSite=Lax`,
and `Secure` when `VITALIS_COOKIE_SECURE=true`. `SECRET_KEY` comes from
`VITALIS_SESSION_SECRET` and falls back to `os.urandom(32)` — the fallback is fine for local
development and **wrong for deployment**, since every restart invalidates every case link;
[`.env.example`](.env.example) says so explicitly.

### 7.4 Health endpoint

`GET /api/health` verifies that the five required config files exist, that the manifest
parses, that the five required imaging artifact keys are present, and that each declared
weights file exists on disk. It returns 503 when anything is missing.

**Why check files rather than just returning 200:** the interesting failure mode for this
app is not "the process died", it is "the process is up but a model file is missing, so
diagnoses silently lose an evidence source". The health check is designed to catch exactly
that.

### 7.5 Serving model

Flask serves `frontend/dist` as static root and falls back to `index.html` for unknown paths
so client-side routing works, with an explicit guard that `/api/*` never falls through to the
SPA. When no build exists, `/` renders the legacy Jinja template
[`templates/form.html`](templates/form.html) — a working no-build fallback.

---

## 8. Frontend design

**Stack:** React 19, Vite 7, Mantine 9 (core + dropzone + notifications), React Router 7,
Tabler icons. Dev proxies `/api` to `localhost:5000`; production is served by Flask from the
same origin, so there is no CORS surface at all.

### Structural decisions

- **Route-level code splitting.** Every page is `lazy()`-loaded behind a `Suspense` fallback.
  The results page alone is ~900 lines; the home page should not pay for it.
- **`ErrorBoundary` wraps the routed content**, not the shell — a page crash keeps the header,
  footer, and navigation usable.
- **State lifted to [`Diagnosis.jsx`](frontend/src/pages/Diagnosis.jsx).** Demographics,
  uploads, note, and selected symptoms live in the layout; `DiagnosisIntake` and
  `DiagnosisSymptoms` are controlled children. The left rail (case summary, categories,
  selected chips) and the right column both need the same state, and it is submitted as one
  payload — a store or context would be ceremony for a three-component tree.
- **Submit-handler inversion.** The child that owns the `FormData` construction registers its
  submit function upward via `setSubmitHandler`, so the primary action button can live in the
  layout footer where it belongs visually while the logic stays with the form.
- **Symptom bucketing happens server-side.** `load_symptoms_from_tree()` reshapes the 15 YAML
  sections into 14 UI buckets, splitting "Endocrine / Renal / GU" across Urinary, Women's
  Health, and General, and routing each cancer alarm-feature into a body-system bucket *in
  addition to* the red-flag list. The clinical taxonomy and the browsing taxonomy are
  genuinely different problems, and the mapping belongs next to the source data, not in JSX.
- **Results hydration is dual-path.** The results page prefers router state (instant, no
  refetch after submit) and falls back to `GET /api/cases/:id` from the query string, so a
  results URL is shareable within the owning session and survives a refresh.
- **Explanations are grouped by evidence category.** `categorizeReasonSource()` splits
  contributions into *objective* (lab, imaging, ECG, vitals) and *patient-reported*, because
  "your X-ray shows this" and "you told us this" carry different weight to a reader even when
  their numeric contributions are similar.

### Visual system

Dark-first Mantine theme, cyan primary at shade 9, `lg` default radius, `autoContrast` on.
Typography is Outfit for headings (weight 800) and Geist for body. Colors are threaded
through CSS custom properties (`--surface`, `--accent`, `--panel-card-border`) with
`color-mix()` for borders, so component overrides in the theme and hand-written CSS in
[`frontend/src/styles/`](frontend/src/styles) stay in sync from one set of variables.

`IntakePrototype.jsx` at `/prototype/intake` is an **in-progress redesign** of the intake
flow into a three-step wizard (Patient → Evidence → Symptoms & review). It is routed outside
the main `AppShell` so it can own the full viewport, and it is uncommitted exploratory work,
not the shipped flow.

---

## 9. Testing

Two suites, both contract-oriented:

**[`test_model_artifact_contracts.py`](tests/test_model_artifact_contracts.py)** — asserts that
the MRI checkpoint's embedded `classes` and `img_size` match the manifest and that it loads
under `strict=True`; that the skin model fuses to exactly `{MELANOMA, BASAL_CELL_CARCINOMA,
BENIGN_SKIN_LESION}` and never leaks a raw label like `akiec`; and that a corrupt image
produces a recorded failure rather than an exception.

**[`test_submission_validation.py`](tests/test_submission_validation.py)** — covers schema
exposure, health reporting, accepted and rejected submissions, structured error shape,
fracture body-part coupling, session-bound case retrieval, that stored cases exclude raw
inputs, and that a failed case leaves no temporary files or partial records.

**Why no unit tests on the fusion math:** the deliberate choice was to test *contracts and
invariants* — "the skin model can only ever affect these three diagnoses", "a failed upload is
always visible", "a case is never retrievable across sessions" — rather than pin exact
probability values, which would freeze tuning constants that are still being calibrated.
The gap this leaves is real and named in §10.

---

## 10. Known gaps and honest caveats

These are documented rather than hidden, because a diagnostic prototype that overstates its
rigor is worse than one that doesn't.

1. **Confidence intervals are decorative.** `core.py:121` computes
   `se = sqrt(p(1-p)/1000)` — a binomial standard error with a hardcoded n=1000. There is no
   sample of 1000 anything. It produces a plausible-looking interval that carries no
   information about the model's actual uncertainty. It should be removed or replaced with a
   real posterior-uncertainty estimate.
2. **Temperature 0.3 sharpens rather than calibrates.** The comment says it was "optimized on
   a validation set to maximize confidence" — maximizing confidence is not calibration. Proper
   temperature scaling minimizes NLL/ECE on held-out data and typically yields `T > 1`.
3. **The `10.0` model-evidence gain is hand-tuned**, as are `−3.0`, `−10.0`, and `log(0.3)`.
   They produce sensible rankings on the demo cases in [`cases/`](cases) but have not been
   fit to labeled outcomes.
4. **Demographic exclusion rules are currently dead code.** `load_exclusions()` reads
   `configs/exclusions.yaml`, but that file exists only at `configs/archived/exclusions.yaml`,
   so the loader always returns `[]` and rules like "prostate cancer excluded for female
   patients" never apply. This is a leftover from the config consolidation (§5.1) and a
   one-line fix — either move the file or point the loader at `archived/`.
5. **`form_app.py:642` references an undefined `safe_case_id`** inside the case-load exception
   handler, which would raise `NameError` while handling an error. Latent — it only fires when
   a stored `result.json` is unreadable.
6. **`runtime.priors_path` in `system.yaml` points at `configs/priors/clinical.yaml`,
   which does not exist.** It is harmless because `run_case()` sources priors from
   `diseases.yaml` via `load_diseases_all()` and never reads that key — but it is a misleading
   config entry that should be deleted.
7. **`model_accuracy_report.json` contains no metrics.** Every entry says "Requires test
   dataset for evaluation" with `stored_metrics: {}`. No held-out accuracy, sensitivity, or
   specificity has been measured for any of the vision models. Their real-world performance
   is currently unknown.
8. **Bare `except:` clauses** in `core.py` (spaCy load, manifest read) swallow every exception
   including `KeyboardInterrupt`. They should be `except Exception:` at minimum.
9. **Conditional independence is assumed.** Summing `log(LR)` across features treats them as
   independent given the diagnosis. Symptoms are heavily correlated (cough and sputum
   production, dyspnea and orthopnea), so correlated evidence is double-counted and the
   resulting probabilities are systematically overconfident.
10. **Closed-world assumption.** The softmax normalizes over 79 diagnoses. A patient with a
    condition outside that set will still receive a confident-looking ranking;
    `OTHER_UNCERTAIN_DIAGNOSIS` mitigates but does not solve this.
11. **`cases/` is unbounded.** Nothing prunes old case directories; there is no retention
    policy or scheduled cleanup.

---

## 11. Where this would go next

**Correctness first** — items 4, 5, 6, and 8 above are small, mechanical fixes. Item 1
(remove or replace the fake CIs) matters most for honesty of the UI.

**Calibration** — measure the vision models against held-out test sets and fill in
`model_accuracy_report.json`; refit the temperature by minimizing expected calibration error
instead of maximizing confidence; replace the `10.0` gain with a value derived from how well
each model's confidence predicts correctness.

**Dependence modelling** — group correlated features (a respiratory cluster, a cardiac
cluster) and apply a discount to within-group evidence, or move to a small Bayesian network
over the feature set. This is the highest-value change to the math.

**Information-gain follow-ups** — keep the curated branch map as the candidate pool, but rank
candidates by expected entropy reduction over the current posterior instead of by static
confidence, so the questions asked actually discriminate between the current top diagnoses.

**Fusion evaluation harness** — a fixture set of cases with expected top-k diagnoses, run in
CI, so tuning constants can be changed with evidence rather than by feel. The cases in
[`cases/`](cases) are the seed corpus for this.

**Retention and multi-user** — a TTL sweep over `cases/`, and real accounts if this ever needs
to serve more than one session at a time.
