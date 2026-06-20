# Finance Assistant Agent Contracts

This folder contains tool-agnostic agent contracts for `finance-assistant`.
Use these contracts in Codex, Cursor, or any local agent runtime.

## Common files

- `common/shared-contract.md`: shared task, output, and review envelope.
- `common/handoff-scenarios.md`: required handoff flows.
- `common/orchestrator-status-model.md`: task state model.
- `common/linear-operating-rules.md`: Linear issue rules.
- `common/model-policy.md`: model tier guidance.

## Role files

- `roles/orchestrator-agent.md`
- `roles/specification-agent.md`
- `roles/product-owner-agent.md`
- `roles/architect-agent.md`
- `roles/team-lead-agent.md`
- `roles/prompt-task-auditor-agent.md`
- `roles/web-agent.md`
- `roles/mobile-agent.md`
- `roles/backend-agent.md`
- `roles/shared-contract-agent.md`
- `roles/design-agent.md`
- `roles/autotest-agent.md`
- `roles/reviewer-agent.md`
- `roles/security-devops-agent.md`
- `roles/test-reviewer-agent.md`
- `roles/ux-critic-agent.md`
- `roles/qa-agent.md`
- `roles/linear-agent.md`

## Tool-specific entry points

| Tool | Entry point |
| --- | --- |
| Codex | `AGENTS.md` |
| Cursor | `.cursor/rules/00-multi-agent-system.mdc` |
| Generic runtime | this folder |

## Minimal flow

```text
specification -> product -> architecture -> delivery breakdown -> execution -> review -> qa
```

Use the full flow for broad, cross-layer, security-sensitive, or user-facing work.
For small fixes, use only the relevant executor and reviewer roles.
