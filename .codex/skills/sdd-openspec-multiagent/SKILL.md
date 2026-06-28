---
name: sdd-openspec-multiagent
description: Enforce specification-driven development with OpenSpec and the finance-assistant multi-agent workflow. Use for every project change, especially product, API, UI, mobile, backend, test, deployment, infrastructure, security, or cross-layer work.
---

# SDD OpenSpec Multi-Agent

Use this skill before changing `finance-assistant`.

## Required Flow

1. Read `AGENTS.md`, `MULTI_AGENT_SYSTEM.md`, and relevant specs.
2. Route non-trivial work through the configured agent chain:
   `orchestrator-agent -> specification-agent -> product-owner-agent -> architect-agent -> team-lead-agent -> prompt-task-auditor-agent -> executor -> reviewers -> qa`.
3. Create or update an OpenSpec change under `openspec/changes/<change-name>/`.
4. Do not implement until the change has proposal, design/spec, and tasks.
5. Keep implementation scoped to the OpenSpec tasks.
6. Update task checkboxes as each task is completed.
7. Verify with tests or explicit manual checks.
8. Final response must include OpenSpec change name, completed tasks, risk level, and missing tests.

## OpenSpec Artifacts

For each change, maintain:

- `.openspec.yaml`
- `proposal.md`
- `design.md`
- `tasks.md`
- `specs/<capability>/spec.md`

If the `openspec` CLI is unavailable, create these files manually using the
existing `openspec/changes/*` structure.

## Multi-Agent Gate

Always activate the multi-agent process for implementation work:

- Use actual subagents when the runtime supports them and the task is broad,
  cross-layer, security-sensitive, or infrastructure-related.
- Otherwise, explicitly apply the role contracts from `agents/roles/*.md` and
  document the virtual handoff in the OpenSpec design/tasks.

## Implementation Guardrails

- Specification changes go first.
- API payload changes must update shared contracts, web, mobile, backend, and tests.
- Infrastructure changes must include rollback notes and certificate/routing checks.
- Production defaults must fail closed for weak secrets and wildcard CORS.
- Do not weaken security to make local or production deployment easier.
