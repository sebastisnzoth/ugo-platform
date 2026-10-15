# UGO Maestro Autónomo — Capability integration registry

Source: installed UGO Maestro Autónomo v0.5.0 plugin skill catalog, adapted to `ugo-platform`. This document routes tasks for compatible coding agents; it does not package the plugin itself or deploy autonomous cloud infrastructure.

| Capability | Purpose in this repository |
| --- | --- |
| ugo-job-execution | Task claiming, owners/locks, lifecycle; do not duplicate work |
| ugo-github-ops | GitHub branch/PR/Actions/Pages evidence on same SHA |
| ugo-runtime-validation | Demonstrate actual TEST UI ↔ API ↔ DB behavior |
| ugo-evidence-judge | Independent evidence review, no self-certifying |
| ugo-recovery | Safe retries, stale work/locks, rollback |
| ugo-readiness-orchestrator | Reconcile readiness IDs against actual states |
| ugo-cto-architecture | Contracts and minimal architecture decisions |
| ugo-code-engineering | React/TS, real backend wiring and tests |
| ugo-app-design | ZIP-derived design, mobile accessibility, states |
| ugo-quality-refactor | Regression, quality, accessibility and performance |
| ugo-product-journey | Fix dead ends across role navigation |
| ugo-supabase-security | Existing Auth, RPC, RLS, Storage and Realtime |
| ugo-marketplace-lifecycle | Complete client-provider-admin operation |
| ugo-hugo-ai-engineering | Authorized Hugo voice/intents/tools/model routing |
| ugo-mobile-device-runtime | Real GPS/camera/mic/push/PWA states |
| ugo-payments-ledger | Payment/cash/debt/commission audit |
| ugo-observability-incidents | Traces, correlation IDs, alerts and recovery |
| ugo-e2e-test-automation | TEST journey across customer and supplier accounts |
| ugo-release-engineering | CI, preview, release and manual production approval |
| ugo-data-integrity | Reconciliation and duplicate/orphan prevention |
| ugo-performance-reliability | Bundle, retries, subscriptions, timeouts |
| ugo-launch-readiness | Evidence-driven final launch gate |
| ugo-agent-factory | Create a worker only after gap demonstrated |
| ugo-agent-governance | Registry, scope, lifecycle, permissions, ownership |
| ugo-agent-factory + ugo-agent-governance | Never claim ENABLED/VERIFIED from catalog only |
| instructions | Master routing, safety and verified-results output |

## Execution gates
1. DISCOVERED: identified in the plugin skill catalog.
2. CATALOGED: task mapping and policy in this document.
3. ENABLED: a runtime/tool can really invoke it with least privilege (not guaranteed here).
4. EXECUTED: real job actions captured with evidence and target SHA.
5. VERIFIED: independent checks plus runtime evidence and no security violations.

## Scope decision
The UGO Maestro plugin itself targets `ugo-admin-panel`. Its technical guardrails and specialists are adapted here, but scripts, jobs, Supabase edge functions and admin systems must be reused only after confirming exact contracts in that source repository. GitHub Pages serves static assets; server code and private credentials must remain behind an authorized backend.

## First runnable milestones
- CI verified on branch for current frontend and GitHub Pages.
- Pixel/interaction parity with the owner's ZIP (not merely token colors).
- Customer auth + profile from UGO TEST, E2E validated.
- Provider registration, profile and approval gate verified against RLS.
- Request-to-payment E2E with actual TEST state.
- Hugo voice integration against authorized backend and actual browser permissions.
- Admin observability, cross-role permissions, ledger and final release gate.

All unproven milestones are **PENDING**. Do not deploy secrets or modify production.
