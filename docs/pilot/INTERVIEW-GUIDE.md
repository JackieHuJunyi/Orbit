# Rune P1 recent-task interview guide

> Use this guide for the first 15 problem interviews. It collects evidence about completed behavior; it is not a product pitch or a willingness-to-pay survey.

## Data boundary

- Record consent, identity, contact information, company, interview notes, and any identity-to-alias mapping only in the approved research system.
- Do not commit completed interview records, source files, screenshots, deliverables, consent records, or payment records to Rune or `pilot-private/`.
- Do not ask a participant to show protected material until authorization or redaction is confirmed outside Rune.
- The repository may receive only aggregate, non-identifying conclusions after the research owner has reviewed them.

## Recruit and screen

Recruit people responsible for operations, finance, strategy/business analysis, or founder-office work in teams of roughly 10–200 people.

Ask these questions before scheduling:

1. In the last 60 days, did you personally prepare or materially review a weekly or monthly operating report or presentation?
2. What was the most recent completion date?
3. Was the result used by leadership, a board, or an operating team to make or track a decision?
4. Would you be able to discuss the workflow without disclosing protected information?

Include a participant only when questions 1–3 describe one concrete completed task. Exclude one-off presentation generation, macro-heavy financial modeling, pixel-perfect Office migration, and unattended external publishing needs from this study.

## Interview setup

- Duration: 45 minutes.
- Anchor every answer to the most recent completed task.
- Ask for sequence and evidence before opinions.
- Do not demo Rune until the recent-task timeline is complete.
- Do not describe local-first, traceability, review, or speed as benefits before asking about current trust and file-sharing behavior.

Suggested opening:

> I want to understand the last time you completed this work, not an ideal future process. I will ask what happened, in order, and where time or errors entered. We will not copy protected material into this study.

## Recent-task timeline

Capture each stage in order using the approved research system.

| Field        | What to capture                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Trigger      | Who requested the work, when, and for what decision                                                            |
| Inputs       | File types and systems used; whether each input could be authorized or redacted for a later trial              |
| Steps        | Every meaningful action from first input to final handoff                                                      |
| Tools        | Spreadsheet, SQL/BI, document, presentation, AI, chat, email, or other tool used at each step                  |
| Elapsed time | Active work and waiting time for every stage; record estimates as estimates                                    |
| Handoffs     | Who reviewed, corrected, approved, or reformatted the result                                                   |
| Rework       | What was redone and why                                                                                        |
| Last error   | Most recent number, source, version, formatting, or delivery error and its consequence                         |
| AI use       | What was sent to AI, what output was kept, what was discarded, and why                                         |
| Final output | Actual format and where it went; do not copy the output into the interview record unless separately authorized |
| Recurrence   | Actual frequency over the last three cycles, not intended future frequency                                     |

## Questions

Ask in this order and follow each answer with “what happened next?” or “show me how you know” when appropriate.

1. When did you last finish this report or presentation?
2. Who requested it, who made it, who checked it, and who used it?
3. What decision or follow-up depended on it?
4. What inputs did you start with, and where did each one come from?
5. Walk me through every tool and handoff from start to delivery.
6. How long did each stage take? Which parts were waiting versus active work?
7. What did you copy, reconcile, or reformat by hand?
8. Which step caused the most rework in that specific cycle?
9. Tell me about the last number or version error. How was it found and what did it cost?
10. Which AI tools did you actually use? What did you keep, change, or discard?
11. Which files or fields could not be sent to a cloud service, and what rule or concern caused that boundary?
12. How did reviewers decide the numbers and conclusions were current and correct?
13. In the last three cycles, how often did this task happen and how similar were the inputs and outputs?
14. Could the same completed task be repeated in a supervised Rune trial using authorized or redacted material?
15. Who would have authority to approve that trial and, later, approve a paid pilot?

After the behavioral interview is complete, show the three concrete pilot packages from the product plan (¥499, ¥999, ¥1,999) and require a forced choice plus rationale. This is E1 preference evidence only. Count payment as E4 only after an authorized payment or signed commercial commitment exists in the approved commercial system.

## Per-interview decision record

Complete these fields in the approved research system; do not commit the filled record here.

```text
Participant alias:
Role segment: operations | finance | strategy-analysis | founder-office
Interview date:
Most recent task completion date:
Actual cadence: weekly | monthly | less frequent | mixed
Total active time (minutes, estimated or measured):
Material error cost observed: yes | no
Authorized/redacted trial material possible: yes | no | unknown
Agrees to a real supervised task: yes | no | follow-up
Primary output: DOCX | PPTX | PDF | other
Primary blocker:
Current alternative:
Price forced choice: 499 | 999 | 1999 | none
Evidence links in approved system:
Researcher confidence: high | medium | low
```

## P1 gate calculation

Evaluate the gate only after 15 completed, eligible interviews:

- at least 8 of 15 performed the task at least monthly;
- at least 5 spent more than two active hours per cycle or described material error cost;
- at least 7 agreed to a supervised real task;
- at least 5 authorized or redacted source sets are available for the next phase.

Report exact counts and missing evidence. Do not average unknown answers into success, replace missing interviews with synthetic personas, or change the threshold after seeing the results. If the gate fails twice, revisit the user or task hypothesis before adding product scope.

## Private deterministic gate

After the first 15 eligible records are locked in the approved research system, create `pilot-private/p1-interviews.json`. Use anonymous aliases and bounded decision fields only; do not copy notes, names, companies, contact details, task content, or source files.

```json
{
  "version": 1,
  "interviews": [
    {
      "participantId": "participant-001",
      "interviewedOn": "2026-08-19",
      "evidenceReference": "approved-system/reference-not-a-name",
      "roleSegment": "operations",
      "eligibleRecentTask": true,
      "repeatsAtLeastMonthly": true,
      "activeMinutes": 135,
      "activeMinutesBasis": "estimated",
      "materialErrorCost": "not_observed",
      "trialMaterialStatus": "redacted",
      "agreesToSupervisedTask": "yes",
      "priceChoice": 999
    }
  ]
}
```

The example documents one row, not a complete input or a real interview. The actual array must contain exactly the first 15 unique eligible participants. Use `null` active minutes only together with `"activeMinutesBasis": "unknown"`; unknown values remain visible and never count as success.

Run:

```bash
npm run pilot:interviews -- pilot-private/p1-interviews.json
```

The command refuses a movable cohort size, duplicate aliases, extra fields, ineligible tasks, invalid dates, ambiguous time records, or missing evidence references. Its aggregate output contains no participant or evidence identifier. Price-choice counts remain explicitly labeled E1 and cannot satisfy P4.
