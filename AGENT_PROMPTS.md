# Agent Prompts

The canonical prompts live in `agents/roles/*.md`.

Legacy prompt files also exist in `multi-agent-system/*.prompt.md`; keep them for
compatibility with existing workflows, but prefer `agents/roles` for new Codex
and Cursor orchestration.

Recommended loading order for a new feature:

1. `agents/roles/orchestrator-agent.md`
2. `agents/roles/specification-agent.md`
3. `agents/roles/product-owner-agent.md`
4. `agents/roles/architect-agent.md`
5. `agents/roles/team-lead-agent.md`
6. One executor role:
   - `web-agent`
   - `mobile-agent`
   - `backend-agent`
   - `shared-contract-agent`
   - `design-agent`
   - `autotest-agent`
7. Review roles:
   - `reviewer-agent`
   - `security-devops-agent`
   - `test-reviewer-agent`
   - `ux-critic-agent`
   - `qa-agent`
