# Lab Result Explainer — SPEC

## What this is

A provider-facing web tool. A provider uploads a patient's lab report PDF; the system
extracts the results, explains them in plain language, and — after the provider reviews and
approves — emails the patient a private link to read them. Education, never diagnosis or
medical advice.

**v1 is a real, working product running on synthetic data only.** No real patient
information (PHI) until the Real-World Pilot phase (see [ROADMAP.md](ROADMAP.md)).

## Who uses it

- **Provider** — signs in (one demo account in v1), uploads reports, verifies, approves, sends.
- **Patient** — no account. Opens an emailed link, confirms date of birth, reads results,
  can send a question. Invitation-only: there is no public site or landing page.

## The v1 flow

1. Provider signs in.
2. Provider uploads a lab report PDF + patient name, email, DOB (synthetic in v1).
3. **Extract (AI):** Claude API reads the PDF and transcribes each test — name as printed,
   value, unit, reference range as printed, lab flags (H/L/critical). Transcription only;
   the model adds no medical knowledge here.
4. **Normalize (dictionary):** each raw test name is matched to our analyte dictionary
   (canonical id + LOINC + aliases). Unmatched tests are marked *not covered* — never guessed.
5. **Verify (human):** provider sees the extracted table side-by-side with the PDF, corrects
   anything, and confirms. No extracted number is used before this.
6. **Classify (code, not AI):** deterministic comparison of each value against the report's
   own printed range → below / in / above. Critical flag from the lab's printed flags plus
   our curated critical thresholds. Implausible values are flagged, not classified. **If any
   value is critical, the report is held here — the pipeline stops, no draft is generated (FR-07).**
7. **Draft (AI):** for a non-held report, one call generates the patient page — the "Overall picture" synthesis and
   each test's personalized "What this means" — grounded **only** in (a) the classifications
   and (b) MedlinePlus test-page text fetched for each analyte. Never the model's own
   medical knowledge.
8. **Approve (human):** provider reads, edits if needed, approves. Nothing is
   patient-visible without approved status.
9. **Share:** patient gets an emailed link (unguessable token, expiring). Opening it
   requires DOB confirmation.
10. **Read & ask:** patient reads the results page; "Ask a question" sends an email to the
    provider's configured office address.

Runtime is **zero-AI**: AI runs at steps 3 and 7 only. The patient page renders stored,
approved content.

## Screens

| # | Screen | Notes |
|---|--------|-------|
| S1 | "Dr. X shared your lab results" — DOB gate | Patient entry point |
| S2 | Provider: upload report + patient details | Replaces the old manual-entry screen |
| S3 | Provider: verify extraction + review/approve draft | New — needs Figma design; also shows the held-critical state (names the critical test, nothing to send) per FR-07 |
| S4 | Patient results page | Overall-picture box, grouped tests with range markers, per-test "What this means," MedlinePlus links, disclaimer |
| S5 | "Ask a question" | Sends email to office |

The old public landing page is dropped. Design iterates continuously in Figma as we build.

## Functional requirements

- **FR-01** Provider auth: one demo provider account (Supabase auth). Multi-provider is out of scope.
- **FR-02** Upload: PDF up to ~10 pages; stored with patient name/email/DOB and a status:
  `uploaded → extracted → verified → drafted → approved → sent`, plus a terminal `held` branch off
  `verified` for reports containing a critical result (see FR-07).
- **FR-03** Extraction returns, per test: raw name, value, unit, reference range (low/high as
  printed, one-sided allowed), lab flags — preserved verbatim as printed (parsing to numbers
  happens later in classification, not extraction). Fields the model is unsure of are flagged
  low-confidence: one it genuinely cannot read is left empty and never fabricated, while an
  uncertain-but-legible read may be recorded if flagged.
- **FR-04** Normalization via the analyte dictionary; unknown tests get the honest
  "we don't cover this one yet" state on the patient page.
- **FR-05** Verify screen: side-by-side PDF and editable extracted table; provider must
  confirm before classification runs.
- **FR-06** Classification is deterministic and pure: same input → same output; no network,
  no randomness. Covered by golden fixtures. Outcomes: below / in / above (each with a critical
  flag), implausible (FR-08), not covered (FR-04), or **unclassifiable** — a value that can't be
  placed on a scale (non-numeric like "Negative," or no printed reference range); shown honestly,
  never forced onto a range. Printed reference ranges are inclusive: a value exactly equal to a
  printed bound is in range, not below/above — matching the lab's own convention, which flags H/L
  only for values strictly outside the range.
- **FR-07** Critical result → **held report, nothing sent.** A critical is detected the same
  deterministic way (printed flags **or** a curated critical threshold crossed — inclusive of the
  threshold value, `≤ criticalLow` / `≥ criticalHigh`, erring toward alarm; if the report's unit
  can't be confidently matched to the dictionary's unit, the curated-threshold check is skipped
  and only the printed range/flags are used — never guessed). A critical is **not** a routine
  result: this tool automates the non-urgent results callback, and a critical belongs to the
  provider's urgent workflow. So if any row is critical, the **whole report is held** — no draft
  is generated, no patient page exists, nothing is sent. The provider review screen **names the
  specific critical test(s)** with value and range and directs the office to contact the patient
  directly. Defense-in-depth: a gate test asserts a held report can never produce a patient-visible
  page, and the patient renderer fails safe if ever handed a critical row.
- **FR-08** Implausible value (fails plausibility bounds): shown as "please double-check with
  your provider," never classified or explained as if real.
- **FR-09** Drafting inputs are only classifications + fetched MedlinePlus text; output
  includes a sources line. Each test card links "Learn more at MedlinePlus" (this is also the
  required attribution).
- **FR-10** Approval gate: no patient-visible text without `approved` status; provider can
  edit the draft before approving. Approved text is stored and frozen.
- **FR-11** Share link: unguessable token, DOB-gated, expires 30 days after it is sent,
  scoped to one report — exactly one live link per report; a new link can be issued
  after expiry. The superseded link is kept (tombstoned), so the old emailed URL shows
  the expired notice with the clinic phone — never an error page.
- **FR-12** Education-only disclaimer renders on every patient view — no code path may omit it.
- **FR-13** Ask-a-question: form sends email (question + test context) to the office address.
  (Real-PHI phase will switch to notify-only email.)
- **FR-14** Language: never "you have," no diagnosis, no medication instructions; "discuss
  with your provider" framing throughout.
- **FR-15** Synthetic data only: seed patients and fabricated lab PDFs; no real PHI anywhere
  in v1 (code, fixtures, database, or logs).

Stretch (only if time allows): print/download of the results page via browser print styles.

## Data model (sketch — shared TypeScript types are the contract)

```ts
AnalyteEntry   // the dictionary: id (stable slug), loinc, displayName, aliases[],
               // medlineplusUrl, unit (the unit the curated thresholds are expressed in),
               // criticalLow?/criticalHigh? (curated, cited),
               // plausibleLow?/plausibleHigh?
Report         // patient {name, email, dob}, pdfRef, status, timestamps
ResultRow      // reportId, rawName, analyteId?, value (as printed, string), unit?,
               // refLow?, refHigh?, rawRange? (range as printed), labFlags[] (raw, as
               // printed), lowConfidenceFields[] (fields the extractor was unsure of;
               // unreadable ones left empty, never guessed),
               // classification? (below/in/above +critical, or implausible /
               // not-covered / unclassifiable)
Explanation    // reportId, overallText, perTest: {analyteId, text}[],
               // sources[], status: draft|approved, approvedAt
ShareLink      // reportId, token, expiresAt, openedAt?, supersededAt?
```

Kept FHIR-friendly on purpose: `ResultRow` maps cleanly onto FHIR `Observation`
(code/value/referenceRange/interpretation) so EHR import later is additive, not a rewrite.

## Definition of done — v1 gates

1. **Golden classification suite** (`tests/golden/`) passes 100% — covers below/in/above,
   one-sided ranges, critical, implausible, unknown test.
2. **Extraction eval corpus** (synthetic lab PDFs + expected JSON) meets its accuracy bar,
   measured by `npm run eval:extract` (`scripts/eval/extract-eval.ts`) against each frozen
   `expected.json` and recorded in `tests/extraction/SPIKE_RESULTS.md`: 100% row fidelity (no
   dropped/duplicated rows), ≥98% exact-match on
   `value`/`unit`/`refLow`/`refHigh`/`rawRange`/`labFlags`, ≥95% on `rawName`. Opt-in eval (needs
   `ANTHROPIC_API_KEY`), not CI-automated. Provisional until the corpus adds a true no-text-layer
   scanned fixture (see that doc).
3. **E2E (Playwright):** full loop upload → verify → approve → link → DOB → results page,
   including one implausible and one unknown test; plus a **held-critical path** — a report with a
   critical value is held at review (with the critical test named) and never produces a sent page.
4. **Gate tests:** no route renders unapproved explanation text; **no report containing a critical
   result can produce a patient-visible page** (FR-07); disclaimer present on every patient view.

## Out of scope for v1

Public landing page · real EHR/lab connectivity (FHIR import) · real PHI, BAAs, HIPAA
program · multi-provider onboarding · patient accounts · trends/history across reports ·
non-blood tests · translations · in-app messaging inbox.

## Decisions

| Decision | Status |
|---|---|
| Provider approval gate before anything reaches a patient | **Non-negotiable** |
| AI writes only from MedlinePlus source text + classifications | **Non-negotiable** |
| Synthetic data only until Real-World Pilot phase | **Non-negotiable** |
| MedlinePlus (NLM pages) as content source — public domain; never ingest A.D.A.M./Mayo/WebMD content (licensed) | Settled |
| Claude API for extraction + drafting (single `llm.ts` boundary) | Chosen, revisable |
| Supabase free tier (DB + auth + file storage), Vercel hosting | Chosen, revisable |
| Lab's printed reference ranges drive classification | Settled |
