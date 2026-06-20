# Orchestrator Status Model

Use this status model for local task envelopes and for Linear synchronization.

| Status | Meaning |
| --- | --- |
| `draft` | Raw request or incomplete task |
| `refinement` | Needs product/spec clarification |
| `ready` | Has owner, acceptance criteria, and verification plan |
| `in_progress` | Executor is actively changing artifacts |
| `in_review` | Implementation complete, reviewer needed |
| `qa` | Reviewer passed, QA validation in progress |
| `done` | Acceptance criteria and verification complete |
| `blocked` | Cannot proceed without external input or dependency |

## Transition Rules

- `draft -> ready` requires acceptance criteria.
- `ready -> in_progress` requires one owner agent.
- `in_progress -> in_review` requires implementation notes and test plan.
- `in_review -> qa` requires no blocking review findings.
- `qa -> done` requires verification evidence.
- Any status can move to `blocked` with a blocker reason and next owner.
