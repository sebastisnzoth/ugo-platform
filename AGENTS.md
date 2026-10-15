# AGENTS.md — UGO Platform / Maestro Autónomo v0.5

## Scope and authority
Applies to this repository `sebastisnzoth/ugo-platform`. Source of business contracts: `sebastisnzoth/ugo-admin-panel`. This repository is a React/TypeScript/Vite GitHub Pages frontend using existing UGO TEST Supabase project `tmossnqfwfwjrtzwcbmm`; **not** a new backend or database.

These instructions adapt the installed "UGO Maestro Autónomo" capability catalog to this repo. They do not install the plugin, create autonomous workers, grant API credentials, enable schedules, or establish completed/runtime-verified functionality. For each task verify actual tool availability.

## Primary mission
Render the owner-provided `ugo-flow-design-prototype (2).zip` as the UGO visual reference, while connecting real auth, data and role-safe flows from existing UGO contracts. Never replace a real action with mock behavior presented as live.

## Operating loop
DETECT → EVIDENCE → ROOT CAUSE → DECIDE → IMPLEMENT → WIRE → TEST → FIX → RETEST → REGRESSION → PERSIST EVIDENCE → INDEPENDENT REVIEW → DONE.
Run up to five safe, independently verifiable deliverables per iteration. Prioritize security, end-to-end journey, correctness, operability, cost, performance and then polish.

Before editing: fetch main SHA, inspect open PRs and pending work, understand actual files and existing integrations. Create feature branch/PR, small commits; no force push, destructive reset, overwriting other agents' work, or direct writes to protected/live environments. No production deployment, merge, spend, irreversible operation or privileged credential use without explicit approval.

## Routing capability catalog
Consult `docs/ugo-maestro-capabilities.md` for all 26 capability names, scopes, evidence and execution conditions. Do not invent tools/skills or claim these capabilities are automatically activated. Activate specialists only for relevant tasks; reuse an existing agent before inventing another.

- Architecture → ugo-cto-architecture.
- Code, TS, API wiring → ugo-code-engineering.
- Design system and mobile UX → ugo-app-design + ugo-product-journey.
- Supabase/Auth/RPC/RLS → ugo-supabase-security.
- Customer-provider-admin lifecycle → ugo-marketplace-lifecycle.
- Hugo voice, model routing and authority → ugo-hugo-ai-engineering.
- GPS, camera, mic, push, PWA → ugo-mobile-device-runtime.
- Payments, cash, commissions, debt → ugo-payments-ledger.
- GitHub CI/Pages/PR and release → ugo-github-ops + ugo-release-engineering.
- Runtime evidence and QA → ugo-runtime-validation + ugo-e2e-test-automation + ugo-evidence-judge.
- All jobs → ugo-job-execution. Recovery → ugo-recovery.
- Only create agent when justified → ugo-agent-factory + ugo-agent-governance.

## Data and security rules
TEST project ID: `tmossnqfwfwjrtzwcbmm`. Never send service_role, PAT, private API keys, privileged RPC or credentials to Pages/JS. Keep RLS server-enforced, authorize every action by user role, use existing schema/RPC/edge functions after inspecting them. Do not weaken RLS or fabricate payments/locations/professional approval. Client signup minimal, client details in profile; provider signup minimal, profile completed then sent for Admin verification, only approved suppliers may accept offers under prevailing backend rules.

## Canonical marketplace workflow
Client request → category/distance matching → provider receives/accepts → traveling → recent genuine GPS → arrival/geofence → before photo → work → after photo → client approval → payment (cash debt ledger if needed) → completed → bilateral ratings → admin observability/dispute where appropriate.

## Evidence contract
Separate CONFIGURED, WIRED, EXECUTED and VERIFIED. A passing build proves compilation, **not** integration with Supabase or production readiness. Keep run ID, head SHA, PR, test artifacts, backend changes, screenshots and reproducible runtime evidence. Judge must be independent of the executor when supported. Never combine green tests from different SHAs.

Status vocabulary: DONE | PENDING | FAILED | UNVERIFIED | BLOCKED_EXTERNAL | BLOCKED_HUMAN.

## Work report
MAIN SHA | DELIVERABLES 0-5 | DONE + proof | remaining steps | blockers | next critical action | status.
Additionally: PRODUCT | OPERATIONS | RISK | MONEY | NEXT ACTION | HUMAN APPROVAL NEEDED.
Never say fully autonomous, production-ready or shipped merely because this instruction file exists.
