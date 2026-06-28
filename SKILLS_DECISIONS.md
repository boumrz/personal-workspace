# Skills Decisions

This project should use Codex skills opportunistically. A skill is required when
the current task matches its trigger and the skill is available in the session.
If unavailable, continue with the best local fallback and report the limitation.

## Always Preferred For Reviews

- `build-graph`: initialize or refresh code knowledge graph before reviews.
- `review-delta`: local diff review with blast-radius analysis.
- `review-pr`: PR or branch-wide review.

## Development And Verification

- `sdd-openspec-multiagent`: required for every project change; enforce SDD,
  OpenSpec artifacts, and multi-agent routing before implementation.
- `openspec-explore`: inspect OpenSpec state and active changes.
- `openspec-propose`: create proposal, design/spec, and tasks before work.
- `openspec-apply-change`: implement OpenSpec tasks and update checkboxes.
- `openspec-sync-specs`: sync accepted changes to canonical specs.
- `openspec-archive-change`: archive completed OpenSpec changes.
- `playwright`: browser automation, UI flow checks, screenshots.
- `playwright-interactive`: persistent browser debugging.
- `browser:control-in-app-browser`: in-app browser testing for localhost and websites.
- `screenshot`: OS-level screenshot fallback.
- `humanizer`: polish user-facing or documentation prose.

## Product And API Knowledge

- `openai-docs`: official OpenAI/Codex/API docs.
- `github:github`: GitHub repository, issue, and PR context.
- `github:gh-address-comments`: resolve PR review feedback.
- `github:gh-fix-ci`: inspect and fix failing GitHub Actions.
- `github:yeet`: commit, push, and open draft PR.
- `linear` and `linear:linear`: Linear issue/project operations.
- `sentry`: Sentry production issue/event inspection.
- `notion-knowledge-capture`: capture decisions into Notion.

## Design And Visual Work

- `figma`: fetch design context and translate Figma nodes to code.
- `figma-implement-design`: implement Figma designs with visual fidelity.
- `figma:figma-use`: required before Figma write actions.
- `figma:figma-generate-design`: generate full screens/views in Figma.
- `figma:figma-generate-library`: create/update Figma design systems.
- `figma:figma-code-connect`: map Figma components to code.
- `figma:figma-generate-diagram`: create diagrams in FigJam.
- `figma:figma-create-new-file`: create new Figma files.
- `figma:figma-use-figjam`: FigJam-specific Figma work.
- `figma:figma-use-slides`: Figma Slides work.
- `imagegen`: generate or edit bitmap images/assets.

## Documents And Media

- `pdf` and `pdf:pdf`: inspect, create, render, and verify PDFs.
- `doc` and `documents:documents`: create/edit Word documents.
- `spreadsheets:Spreadsheets`: spreadsheets, CSV/TSV, formulas, charts.
- `presentations:Presentations`: PowerPoint decks.
- `speech`: text-to-speech.
- `transcribe`: audio/video transcription.

## Codex Extensibility

- `plugin-creator`: create/update Codex plugins.
- `skill-creator`: create/update Codex skills.
- `skill-installer`: install Codex skills.

## Content-Specific

- `viral-hooks-threads`: Threads hooks/post openers.

## Trigger Policy

- Prefer the smallest skill set that fits the task.
- Project changes must include `sdd-openspec-multiagent`.
- Read the selected skill instructions before acting.
- Do not invent skill behavior; if missing or blocked, state that and continue.
