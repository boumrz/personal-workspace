# AGENTS.md

Project-level Codex instructions for `finance-assistant`.

This repository is developed specification-first. Treat `TECHNICAL_SPECIFICATION.md`
as the product and architecture source of truth, and use the multi-agent contracts
in `agents/` before making non-trivial product, API, UI, mobile, or infrastructure
changes.

## Project Snapshot

- Product: personal finance assistant for web and mobile.
- Web: React 18, TypeScript, Redux Toolkit/RTK Query, Ant Design, CSS Modules, Rspack.
- Backend: Node.js, Express, PostgreSQL, JWT auth, Helmet, CORS, rate limits.
- Mobile: Expo/React Native with shared TypeScript API client.
- Shared contracts: `shared/src/types` and `shared/src/api`.
- Main specs: `TECHNICAL_SPECIFICATION.md`, `MULTI_AGENT_SYSTEM.md`, `agents/`.

## Default Workflow

1. Read the relevant specification section before implementation.
2. For unclear or broad requests, route through the agent flow:
   `specification-agent -> product-owner-agent -> architect-agent -> team-lead-agent -> executor -> reviewers -> qa`.
3. Keep changes scoped to the target layer and update contracts across web/mobile/backend when payloads change.
4. Add or update tests when behavior changes.
5. Report residual risk and missing tests in the final response.

## Required Review Skills

Use these skills by default for review-oriented work:

1. `$build-graph` when graph state is missing or stale.
2. `$review-delta` for local diffs and "review changes" requests.
3. `$review-pr` for branch or PR-wide reviews.

If a graph MCP tool is unavailable, continue with local repository analysis and say so.

## Multi-Agent Entry Points

- Codex: this file plus `agents/README.md`.
- Cursor: `.cursor/rules/00-multi-agent-system.mdc` plus `.cursor/rules/agents/*.mdc`.
- Tool-agnostic role prompts: `agents/roles/*.md`.
- Legacy prompts kept for compatibility: `multi-agent-system/*.prompt.md`.

## Agent Roster

| Agent | Owner area |
| --- | --- |
| `orchestrator-agent` | Routes work, tracks status, keeps handoffs clean |
| `specification-agent` | Converts raw requirements into testable specs |
| `product-owner-agent` | Scope, user stories, acceptance criteria |
| `architect-agent` | Architecture, API/data contracts, ADRs |
| `team-lead-agent` | Task breakdown, sequencing, delivery risk |
| `prompt-task-auditor-agent` | Checks task readiness before execution |
| `web-agent` | `src/`, web UI, RTK Query, Rspack |
| `mobile-agent` | `mobile/`, Expo, navigation, permissions |
| `backend-agent` | `server/src/`, routes, services, migrations |
| `shared-contract-agent` | `shared/`, cross-layer request/response types |
| `design-agent` | UX flows, UI states, accessibility |
| `autotest-agent` | Unit, integration, e2e automation |
| `qa-agent` | Test strategy, release readiness |
| `security-devops-agent` | Secrets, rate limits, CI, deploy safety |
| `reviewer-agent` | Bug-first final review |
| `test-reviewer-agent` | Test coverage quality review |
| `ux-critic-agent` | UX and accessibility review |
| `linear-agent` | Linear task hygiene when Linear is available |

## Available Skill Triggers

Use available skills when the task matches their scope. If a skill is not installed in
the current session, continue with the best local fallback and mention the limitation.

- `build-graph`: build/update the code review knowledge graph before reviews.
- `review-delta`: review local diffs with blast-radius context.
- `review-pr`: review a PR or branch diff.
- `browser:control-in-app-browser`, `playwright`, `playwright-interactive`: browser/UI verification.
- `openai-docs`: current OpenAI API, model, and Codex documentation.
- `github:github`, `github:gh-address-comments`, `github:gh-fix-ci`, `github:yeet`: GitHub repo, PR, CI, and publishing workflows.
- `linear`, `linear:linear`: Linear issue/project work.
- `figma`, `figma-implement-design`, `figma:figma-use`, `figma:figma-generate-design`, `figma:figma-generate-library`, `figma:figma-code-connect`, `figma:figma-generate-diagram`, `figma:figma-create-new-file`, `figma:figma-use-figjam`, `figma:figma-use-slides`: Figma design and implementation workflows.
- `imagegen`: raster images, illustrations, textures, sprites, or image edits.
- `pdf`, `pdf:pdf`: PDF reading, creation, rendering, and verification.
- `doc`, `documents:documents`: `.docx` and Word-style documents.
- `spreadsheets:Spreadsheets`: `.xlsx`, `.csv`, `.tsv`, formulas, charts, spreadsheet QA.
- `presentations:Presentations`: PowerPoint decks.
- `speech`: text-to-speech generation.
- `transcribe`: audio/video transcription.
- `screenshot`: OS-level screenshots when tool-specific capture is insufficient.
- `sentry`: Sentry issue/event inspection.
- `humanizer`: make prose sound natural and less AI-generated.
- `notion-knowledge-capture`: capture decisions and notes into Notion.
- `plugin-creator`: create or update Codex plugins.
- `skill-creator`: create or update Codex skills.
- `skill-installer`: install curated or GitHub-hosted Codex skills.
- `viral-hooks-threads`: write Threads hooks and post openers.

## Guardrails

- Do not overwrite user changes in a dirty worktree.
- Do not change API payloads without updating `shared`, web, mobile, tests, and spec notes.
- Production configuration must fail closed for weak secrets or wildcard CORS.
- Voice/LLM parsing must keep deterministic fallback behavior and input validation.
- UI work must include loading, empty, error, and success states where relevant.
- Mobile work must handle denied permissions and Android-first runtime assumptions.
- Final reviews must list risk level and missing tests.
