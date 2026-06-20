# Handoff Scenarios

## New Feature

```text
specification-agent
  -> product-owner-agent
  -> architect-agent
  -> team-lead-agent
  -> prompt-task-auditor-agent
  -> executor
  -> reviewer-agent
  -> qa-agent
```

## API Contract Change

```text
architect-agent
  -> shared-contract-agent
  -> backend-agent
  -> web-agent
  -> mobile-agent
  -> autotest-agent
  -> reviewer-agent
```

## UI/UX Change

```text
product-owner-agent
  -> design-agent
  -> web-agent or mobile-agent
  -> ux-critic-agent
  -> qa-agent
```

## Security or Deploy Change

```text
architect-agent
  -> security-devops-agent
  -> backend-agent
  -> reviewer-agent
  -> qa-agent
```

## Bug Fix

```text
team-lead-agent
  -> relevant executor
  -> autotest-agent
  -> reviewer-agent
```

## Required Handoff Fields

- input summary;
- files or artifacts changed;
- acceptance criteria status;
- verification evidence;
- risks and blockers;
- next owner.
