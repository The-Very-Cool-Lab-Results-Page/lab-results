# Demo script

A scripted 10-minute walkthrough anyone on the team can drive. It shows the full loop
(upload, AI extraction, provider verify, deterministic classification, AI draft, provider
approval, patient view) plus every safety state, in a fixed order with known data.

## Setup (5 minutes, before the demo)

1. In `.env.local`, set:

   ```
   DATA_OFFLINE=1
   ANTHROPIC_API_KEY=<a funded key>
   ```

   `DATA_OFFLINE=1` runs the in-memory demo seeds, so every scripted report is in a known
   state no matter what is in anyone's database. The key keeps PDF extraction and drafting
   live, which is the wow moment. Leave `LLM_OFFLINE` unset.

2. From a clean clone, install dependencies once, then start the app:

   ```
   npm install
   npm run dev
   ```

   The app serves on `http://localhost:3000`. If that port is busy it picks 3001; use
   whatever URL the terminal prints in place of 3000 below.

3. Sign in once at `http://localhost:3000/provider/sign-in` to confirm the credentials
   work: `dr.anderson@demo.clinic` / `demo-password-2026` (prefilled on the form).

4. Have `tests/extraction/liver-metabolic-quest/report.pdf` findable in a Finder window.
   It is the live-extraction PDF: five normal liver results, one deliberately absurd
   glucose (15000), and one test the dictionary does not cover.

Restarting the dev server resets all demo data to this starting state. That is also your
recovery move if a rehearsal or an earlier demo left things clicked-through.

## The run

### 1. The problem (30 seconds, no clicking)

"Patients get lab PDFs they cannot read, and the tools that explain them either guess or
give medical advice. Ours does neither: AI transcribes and drafts, deterministic code
classifies, and a human provider approves everything a patient sees. Two human gates, no
bypass."

### 2. Sign in and the worklist (30 seconds)

Sign in. The reports list shows patients at every stage: several already sent, David Chen
held for a critical result, Grace Okoro waiting on approval, and Samuel Reyes just uploaded.
Reyes and Chen are the two you drive; the rest are there to show the range of states.

### 3. Live AI extraction (2 minutes)

Open Samuel Reyes (status: uploaded). Attach the liver panel PDF and click "Read the
results." Extraction is a real Claude call and takes about 15 seconds; narrate while it
runs:

"The model is transcribing, not interpreting. It copies what the PDF prints, exactly. If
it cannot read a field it flags it low-confidence rather than guessing. It never decides
whether a value is normal."

When the table appears, point at the glucose row: the PDF really prints 15000, and the
model transcribed it faithfully instead of correcting it. This is a live model call, so
the exact rows can vary slightly run to run. That is fine: the safety states below are
decided by deterministic code, not the model, so glucose is still flagged and an unknown
test is still an honest fallback no matter how the transcription lands.

### 4. Gate one: provider verification (1 minute)

"Nothing proceeds until a human confirms the transcription against the PDF." Skim the
rows, then click "Confirm results."

Classification happens at this click, in plain deterministic code, not AI: five liver
results in range, glucose implausible (it fails a human-curated plausibility bound, so it
is set aside to double-check, never explained as a real value), and the hepatitis B row
honestly marked as not covered by our dictionary.

### 5. AI draft, grounded (1.5 minutes)

The draft appears after a live drafting call (about 15 seconds). Read the overall text
aloud: it covers only the five verified in-range results, cites MedlinePlus, and never
says "you have" anything.

"The draft is grounded in fetched MedlinePlus text plus our own classifications. The
model is not allowed to add medical knowledge of its own."

Edit one sentence to show the provider owns the text. Then click "Approve for the
patient": gate two.

### 6. Send and the patient view (2 minutes)

Click "Send to patient" and open the patient link. Enter last name `Reyes` and DOB
`5 / 9 / 1988` to clear the gate.

Walk the patient page top to bottom: the education-only disclaimer, the at-a-glance
chips, the glucose row saying "please double-check" instead of a fake explanation, the
hepatitis B row honestly saying it is not explained here, and the MedlinePlus links.

"This page is stored, approved content. Nothing is generated when the patient looks at
it, so there is nothing the AI can improvise at view time."

### 7. The critical path (2 minutes)

Back in the provider app, open David Chen. His potassium is 6.8, a critical value.

"This report is held. There is no send button, and no code path that can put a critical
result on a patient page; the renderer refuses outright. Critical values need a human
conversation, so the screen directs the provider to contact the patient and log it."

Log a contact: method phone, note "Reached David by phone; advised same-day visit."
The panel flips to "Every critical result has a logged contact." Point out the hold does
not lift; documentation never substitutes for the safety state.

### 8. The gate rejects strangers (30 seconds)

Open `http://localhost:3000/r/demo-nguyen-token` in a private window. Enter a wrong last
name; it refuses. Enter `Nguyen` and `9 / 14 / 1979`; it opens to an all-in-range report.

### 9. Close (30 seconds)

"Deterministic where it must be, AI where it helps, a human gate in front of everything a
patient reads. Runs offline for development and testing, and the same code is live on
Vercel with Supabase persistence and real extraction."

## Spare patient links

| Token | Last name | DOB | Shows |
|---|---|---|---|
| `demo-nguyen-token` | Nguyen | 9 / 14 / 1979 | Every result in range |
| `demo-park-token` | Park | 2 / 28 / 1995 | Implausible sodium, double-check state |
| `demo-alvarez-token` | Alvarez | 3 / 12 / 1984 | Mixed results |

## If something goes wrong

- Live extraction errors or stalls: click "New report", fill in any patient, and click
  "Read the results" (no PDF needed). A freshly created report runs the synthetic path and
  returns instantly, so you still get a full loop to walk. Only the transcription-of-15000
  beat is lost. Note: this offline path works only for reports you create here, not for the
  Reyes seed, which has no synthetic fixture and needs the live key.
- Clicked too far or approved the wrong thing: "Start over" on the report page, or
  restart the dev server to reset every seed.
- No usable API key on demo day, or the key is out of credits (the error names a low
  balance): set `LLM_OFFLINE=1` in `.env.local` and restart, then drive the loop from a
  "New report" (manual entry) instead of Reyes. The rest of the script is unchanged; skip
  the narration about live calls.
