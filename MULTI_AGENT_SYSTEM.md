# Multi-Agent Development System

This file defines the multi-agent workflow for `finance-assistant`. It is
compatible with Codex, Cursor, and any tool that can load the role files in
`agents/roles/`.

## 1. Goal

Make development specification-first, traceable, and reviewable. Agents are not
equal free-form contributors; they form a controlled delivery chain from product
intent to verified implementation.

## 2. Operating Flow

```text
User request
  -> SDD/OpenSpec triage
  -> OpenSpec change proposal/design/spec/tasks
  -> orchestrator-agent
  -> specification-agent
  -> product-owner-agent
  -> architect-agent
  -> team-lead-agent
  -> prompt-task-auditor-agent
  -> executor agent
  -> reviewer-agent / security-devops-agent / test-reviewer-agent / ux-critic-agent
  -> qa-agent
  -> product-owner-agent acceptance
  -> OpenSpec sync/archive when complete
```

Executor agents are selected by ownership:

- `web-agent`: `src/`, web UI, RTK Query, CSS Modules, Rspack.
- `mobile-agent`: `mobile/`, Expo, React Native, navigation, permissions.
- `backend-agent`: `server/src/`, routes, services, migrations.
- `shared-contract-agent`: `shared/`, cross-layer types and API client.
- `design-agent`: UX/UI decisions and implementation-ready screen specs.
- `autotest-agent`: automated test implementation.
- `linear-agent`: Linear state management when Linear is available.

## 3. Agent Roster

| Agent | Kind | Primary output |
| --- | --- | --- |
| `orchestrator-agent` | Coordinator | Task envelope, routing, status |
| `specification-agent` | Planner | Spec section, assumptions, open questions |
| `product-owner-agent` | Planner | Scope, stories, acceptance criteria |
| `architect-agent` | Designer | Architecture, API/data contract, ADR notes |
| `team-lead-agent` | Planner | Task breakdown, dependencies, owner map |
| `prompt-task-auditor-agent` | Gate | Task readiness verdict |
| `web-agent` | Executor | Web code and web verification |
| `mobile-agent` | Executor | Mobile code and mobile verification |
| `backend-agent` | Executor | API/service/migration code and tests |
| `shared-contract-agent` | Executor | Shared types/API contracts |
| `design-agent` | Executor | UX flow and UI state spec |
| `autotest-agent` | Executor | Test code and test evidence |
| `reviewer-agent` | Reviewer | Bug-first findings |
| `security-devops-agent` | Reviewer | Security, CI, deploy safety verdict |
| `test-reviewer-agent` | Reviewer | Coverage quality verdict |
| `ux-critic-agent` | Reviewer | UX/accessibility verdict |
| `qa-agent` | Reviewer | Release readiness |
| `linear-agent` | Operations | Issue state and comments |

## 4. Required Artifacts

Every non-trivial feature should produce or update:

- an OpenSpec change under `openspec/changes/<change-name>/` with proposal,
  design/spec, and tasks;
- a spec note in `TECHNICAL_SPECIFICATION.md` or `docs/specs/`;
- task envelope using `agents/common/shared-contract.md`;
- acceptance criteria;
- implementation notes;
- test evidence;
- review verdict.

## 5. Handoff Rules

- Each handoff includes objective, context, changed files, risks, blockers, and next owner.
- API changes must route through `shared-contract-agent`.
- Security-sensitive changes must route through `security-devops-agent`.
- UI changes must route through `design-agent` or `ux-critic-agent` when the interaction changes.
- Test gaps must route to `autotest-agent` or be explicitly accepted by `qa-agent`.
- Linear is the preferred task state source when the connector is available; otherwise use local task envelopes.
- Executor work must not start until the OpenSpec change has implementation
  tasks and acceptance criteria.

## 6. Decision Rights

- Product value and scope: `product-owner-agent`.
- Architecture and API boundaries: `architect-agent`.
- Delivery sequencing: `team-lead-agent`.
- Security block/release risk: `security-devops-agent`.
- Release readiness: `qa-agent`.
- Final code risk review: `reviewer-agent`.

## 7. Completion Criteria

A task is complete only when:

- acceptance criteria are checked;
- OpenSpec tasks are checked off or explicitly deferred;
- implementation matches the current specification;
- tests or manual verification are recorded;
- risks and missing tests are listed;
- reviewers have no unresolved blocking findings.
