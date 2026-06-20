# Shared Contract

All agents use this shared task envelope unless a tool requires a different
format.

## Task Envelope

```yaml
task:
  id: TASK-###
  title: Short actionable title
  project: finance-assistant
  priority: P0|P1|P2|P3
  status: draft|ready|in_progress|in_review|qa|done|blocked
  owner_agent: web-agent
  reviewer_agents:
    - reviewer-agent
context:
  product_area: auth|finance|voice|data-tools|admin|mobile|infra|docs
  user_goal: ...
  dependencies: []
  constraints: []
artifacts:
  spec:
    - TECHNICAL_SPECIFICATION.md
  architecture: []
  api_contracts: []
  design: []
  tests: []
acceptance_criteria:
  - ...
verification:
  commands:
    - npm run typecheck
  manual_checks: []
risks:
  - ...
linear:
  issue_id: null
  url: null
```

## Agent Output

```yaml
agent: web-agent
task_id: TASK-###
summary: ...
status_recommendation: ready|in_progress|in_review|qa|done|blocked
artifacts_created:
  - type: code|test|doc|design|review
    location: path/or/url
decisions:
  - ...
risks:
  - ...
blockers:
  - ...
verification:
  commands_run:
    - command: npm run typecheck
      result: pass|fail|not_run
      notes: ...
handoff_to:
  - agent: reviewer-agent
    reason: final risk review
linear_update:
  state: In Review
  comment_summary: ...
```

## Review Output

```yaml
reviewer: reviewer-agent
task_id: TASK-###
verdict: approve|revise|reject
risk_level: low|medium|high
findings:
  - severity: high|medium|low
    file: path
    line: 1
    summary: ...
    recommendation: ...
missing_tests:
  - ...
blocking: true|false
```

## Shared Rules

- Work only inside the role responsibility area.
- Escalate conflicts instead of silently resolving disputed decisions.
- Keep outputs structured and handoff-ready.
- Update spec/contracts when implementation behavior changes.
- Do not mark work complete without acceptance criteria and verification evidence.
