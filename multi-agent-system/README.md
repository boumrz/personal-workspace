# Finance Assistant Multi-Agent System

This folder defines a practical multi-agent delivery setup for `finance-assistant`.
Each agent has a dedicated prompt file for focused execution.

Canonical cross-tool contracts now live in `../agents/`.
Use this folder as a legacy prompt library, and use these files as entry points:

- Codex: `../AGENTS.md`
- Cursor: `../.cursor/rules/00-multi-agent-system.mdc`
- Full system description: `../MULTI_AGENT_SYSTEM.md`
- Project specification: `../TECHNICAL_SPECIFICATION.md`

## Agents

- `orchestrator.prompt.md`
- `linear-agent.prompt.md`
- `design-agent.prompt.md`
- `web-agent.prompt.md`
- `mobile-agent.prompt.md`
- `backend-agent.prompt.md`
- `shared-contract-agent.prompt.md`
- `qa-agent.prompt.md`
- `autotest-agent.prompt.md`
- `security-devops-agent.prompt.md`
- `reviewer-agent.prompt.md`

## Operating Model

1. `Orchestrator` receives the request and breaks work into tasks.
2. `Linear Agent` creates/updates issues and keeps execution traceable.
3. `Design Agent` prepares UI/UX direction and implementation-ready specs.
4. Domain agents (`Web`, `Mobile`, `Backend`, `Shared`) implement changes.
5. `Autotest Agent` builds and maintains automated test suites.
6. `QA Agent` validates quality gates, regressions, and release confidence.
7. `Security/DevOps Agent` validates production-readiness controls.
8. `Reviewer Agent` provides final risk-focused sign-off.

## Non-Negotiable Rules

- No implementation without a corresponding Linear task.
- Every task must include acceptance criteria and verification steps.
- Contract changes must be reflected in `shared` and consumers.
- Final merge requires green checks and reviewer approval.
