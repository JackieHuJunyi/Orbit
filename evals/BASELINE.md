# Rune synthetic Golden Task baseline

> Evidence grade E1: deterministic regression evidence from synthetic fixtures. This is not user-demand, delivery, retention, or paid validation.

## Automated contract

- Set version: 1
- Fixtures: 20 synthetic tasks; 0 licensed or redacted real tasks
- Result: 20/20 passed; 0 failed
- Expected success paths: 14
- Expected fail-closed paths: 6
- Real DuckDB-Wasm numeric executions: 10
- Human-rated tasks: 0

| Task | Expected outcome | Automated result | Coverage |
| --- | --- | --- | --- |
| `review-whole-table-sum` | success | passed | CSV · sum · bar · Document · Slides |
| `review-exact-month-scope` | success | passed | CSV · exact scope · excluded malformed values · Document |
| `review-paired-month-change` | success | passed | CSV · paired exact scopes · primary minus comparison · shared categories |
| `review-average-line` | success | passed | CSV · duplicate categories · average · line |
| `review-json-boolean-scope` | success | passed | JSON · Boolean scope · typed identity · Slides |
| `review-date-string-scope` | success | passed | CSV · date string · exact scope · no date guessing |
| `review-simplified-chinese` | success | passed | CSV · zh-CN · Unicode fields · Document |
| `review-arabic-percent` | success | passed | CSV · Arabic locale · percent · Slides |
| `review-collision-safe-chain` | success | passed | CSV · case-insensitive collisions · complete chain |
| `review-duplicate-rows-slides-only` | success | passed | CSV · duplicate rows · sum · Slides only |
| `reject-missing-exact-field` | rejected | passed | failure · missing field · zero output |
| `reject-duplicate-deliverables` | rejected | passed | failure · duplicate deliverables · zero output |
| `reject-formatted-eligible-number` | rejected | passed | failure · formatted number · exact eligible rows · zero output |
| `reject-unshared-comparison` | rejected | passed | failure · paired exact scopes · no shared categories · zero output |
| `briefing-four-slide-english` | success | passed | Markdown · Document to Presentation · 4 slides · English |
| `briefing-six-slide-chinese` | success | passed | Markdown · Document to Presentation · 6 slides · zh-CN |
| `briefing-eight-slide-japanese` | success | passed | Markdown · Document to Presentation · 8 slides · Japanese |
| `briefing-refresh-linked-dark-deck` | success | passed | Markdown · linked refresh · exact identity · dark theme |
| `reject-briefing-insufficient-source` | rejected | passed | failure · Document to Presentation · insufficient evidence · zero output |
| `reject-briefing-foreign-target` | rejected | passed | failure · linked refresh · wrong origin · zero output |

## Human business-outcome rubric

Every licensed or redacted real task must be reviewed from 1–5 on:

1. Number correctness
2. Evidence completeness
3. Conclusion usefulness
4. Structure clarity
5. Visual deliverability
6. Change comprehensibility
7. Overall time saved

No human score is recorded until an authorized reviewer has completed a real task. A number-correctness score below 4 cannot be hidden by averaging. The pilot entry threshold remains 20 licensed or redacted real tasks.
