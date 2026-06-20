# Model Policy

Use model tiers rather than hardcoded model names. Map the tiers to currently
available models in the execution environment.

## Tiers

- Deep reasoning: ambiguous requirements, specification, architecture tradeoffs.
- Balanced reasoning: implementation, design, structured review.
- Fast checklist: checklist validation, simple QA, task audits.

## Assignments

| Agent | Tier |
| --- | --- |
| `specification-agent` | Deep reasoning |
| `architect-agent` | Deep or balanced reasoning |
| `product-owner-agent` | Balanced reasoning |
| `team-lead-agent` | Balanced reasoning |
| `web-agent` | Balanced reasoning |
| `mobile-agent` | Balanced reasoning |
| `backend-agent` | Balanced reasoning |
| `shared-contract-agent` | Balanced reasoning |
| `design-agent` | Balanced reasoning |
| `reviewer-agent` | Balanced reasoning |
| `security-devops-agent` | Balanced reasoning |
| `autotest-agent` | Balanced or fast checklist |
| `qa-agent` | Fast checklist |
| `prompt-task-auditor-agent` | Fast checklist |
| `test-reviewer-agent` | Fast checklist |
| `ux-critic-agent` | Fast checklist |
| `linear-agent` | Fast checklist |

## Rules

- Prefer deeper reasoning before implementation, not after a poor task reaches code.
- Use fast models only when the input artifact is already specific and testable.
- Do not downgrade security, architecture, or contract reviews when risk is high.
