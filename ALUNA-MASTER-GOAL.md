# Aluna Master /goal prompt v1.1

Date: 2026-11-28. Repository: Aluna2027/Aluna. Integration target: staging.
Use this template in Codex Cloud with the published Aluna environment. Select Goal mode (/goal) and replace all bracketed placeholders with owner-approved details before submitting. This document is a template, not authorization to start work or release changes.

## Prompt

### Goal and approved scope
- PR title / identifier: [title / next available PR number]
- Functional specifications: [approved scope]
- Acceptance criteria: [explicit desktop, mobile, automated, security and regression criteria]
- Exclusions: [out of scope]
- Gate 1 owner approval: [explicit approval reference]
- Baseline: current origin/staging, or [explicit owner-approved commit].

Do not begin implementation without Gate 1 approval. Follow the repository AGENTS.md and all applicable nested instructions. Stop on conflicts rather than silently overriding them.

### Cloud startup (v1.1)
For a genuinely new task, use the installed, accepted direct-helper workflow rather than depending on automatic Start skill discovery:

```bash
task_repo=$(/workspace/.aluna-cloud/start-task.sh) && cd "$task_repo"
```

Verify successful startup, actual checkout, expected baseline and AGENTS.md before proceeding. Read AGENTS.md. Use a dedicated feature branch for changes. Use the installed /workspace/.aluna-cloud/start-db.sh and start-app.sh helpers from the actual task checkout when needed, with the documented local-only target safeguards.
For a resumed task, preserve the existing task checkout, branch, uncommitted changes and local data; verify its context and baseline instead of creating a new checkout or resetting. Never discard ongoing work. If the helpers or context are missing, invalid or fail, report BLOCKED; do not reconstruct, modify or republish the environment without approval.

### Autonomous development
Within approved scope, investigate, implement, test, diagnose failures, repair and retest autonomously. Reuse established components and architecture; avoid unrelated refactors, repeated investigations and unnecessary reruns. Use targeted tests during development and complete mandatory acceptance checks before requesting technical approval.
Use Standard speed where available and the model preferences in AGENTS.md. Escalate only when justified. Never purchase additional credits, upgrade plans or activate paid services without explicit approval.
Stop for unresolved blockers, security-sensitive changes outside scope, scope expansion or actions requiring approval. Do not weaken controls or tests.

### Database and migration safety
Default to disposable local Supabase. Verify the exact target before every database command; use only the validated per-task local context. No Production credentials or development tests against Production. Hosted Staging read-only access is permitted only if separately authorized and verified as scoped. Hosted writes and hosted migrations each require separate explicit authorization; Gate 1 is not that authorization.
Follow Issue #44 and docs/releases/ migration inventory and reconciliation. Compare tracked migrations and target ledger before proposing hosted execution. Prevent historical replay; preserve historical SQL and ledger. Test new migrations locally. Document divergences; do not claim native CLI alignment without evidence. Never run unapproved remote db push, migration repair, or hosted reset. Never reset local data without the required explicit confirmation and verified local target.
The local startup ACL correction for campaign execution is a local test-environment safeguard, not proof that historical migration replay independently reproduces hosted privileges. Do not silently modify historical migrations; any durable forward correction requires separate approved scope.

### Security, testing and preview
Maintain authorization, RLS, ownership, verification, data integrity and private-media boundaries. Keep secrets out of source, logs and reports. Use payment mocks or explicitly authorized Stripe Staging test-mode credentials only; no real transactions.
Run typecheck, lint, build, relevant existing and new automated tests and appropriate regression tests. Record failures, skips and blockers accurately. Check desktop/mobile requirements and report evidence for subsequent owner acceptance; do not claim owner acceptance.
Prepare a draft PR targeting staging with the exact reviewed head SHA. Verify Preview isolation and target configuration before using hosted Preview; check historical branch-specific overrides when relevant. Report required CI/Preview status and any checks not executed. Never bypass protection, merge autonomously into main, deploy/promote/rollback Production or change hosted infrastructure without explicit approval.

### Completion and stop conditions
Goal is complete only when approved technical criteria are met, required checks pass, and a reviewable draft PR and concise evidence report are ready for Gate 2. If blocked, stop and report NO-GO instead of claiming goal achievement.
Report:
- PR link, exact head SHA and baseline; summary of changes and exclusions.
- Tests PASS / FAIL / SKIPPED / BLOCKED, typecheck, lint, build and regression evidence.
- Security, database target, migration reconciliation and Preview evidence; remaining risks.
- GO / NO-GO recommendation for Gate 2.
Stop at Gate 2. No autonomous merge to staging under this template. Gate 2 technical acceptance, Gate 3 functional acceptance (desktop/mobile), and Gate 4 Production release each require separate explicit owner approval. Production release is performed by an authorized administrator for the exact approved commit and release scope. No approval is inferred from silence, test results or an earlier gate.

## Version record
v1.1: S9.1 fresh-instance acceptance passed using direct helpers on 2026-11-28. Automatic Start skill discovery remains BLOCKED; the explicit helper workflow is the accepted alternative. S9.3 hosted Staging scoped access and S9.9 integrated autonomous goal execution remain separate verification gates. This template does not certify those checks.
