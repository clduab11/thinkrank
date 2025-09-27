# ThinkRank App Store Acceleration Plan

Executive owner: Mobile PM; Technical owner: Mobile Lead; Duration: 8 weeks
Objective: Rapid App Store deployment with viral gacha-driven growth and measurable AI literacy outcomes.

Key artifacts and scripts leveraged:
- Android build script: [build-android.sh](client/build-scripts/build-android.sh)
- iOS build script: [build-ios.sh](client/build-scripts/build-ios.sh)
- Unity project settings: [ProjectVersion.txt](client/unity-project/ProjectSettings/ProjectVersion.txt)
- Store metadata stubs: [play-store-metadata.json](deployment/app-store/android/play-store-metadata.json), [metadata.json](deployment/app-store/ios/metadata.json)
- Social backend entry points: [social.controller.ts](backend/services/social-service/src/controllers/social.controller.ts), [sharing.routes.ts](backend/services/social-service/src/routes/sharing.routes.ts), [leaderboard.routes.ts](backend/services/social-service/src/routes/leaderboard.routes.ts), [achievement.routes.ts](backend/services/social-service/src/routes/achievement.routes.ts)

Success metrics (targets):
- App Store approval < 30 days
- Retention D1/D7/D30 > 70% / 50% / 30%
- DAU growth > 20% WoW, K-factor > 1.5
- Educational module completion > 80%
- Crash-free sessions > 99.5%, p95 network API < 200ms

Compliance baseline:
- Apple: Guidelines 1.1, 2.3, 2.5, 3.1.1, 5.1, 5.6; App Privacy; ATT if tracking; SKAdNetwork
- Google: Families policy (if applicable), User Data policy, Ads policy, Android 14 compatibility
- Ethical gacha: clear odds, pity system, daily cap, parental gates if under 18

Milestones overview:
- Week 1–2: Codebase analysis, performance/security hardening, gacha tuning scaffolds
- Week 3–4: Store readiness, builds, metadata, beta programs, submissions
- Week 5–6: Coordinated launch, viral mechanics activation, monitoring, content iteration
- Week 7–8: Scale, advanced AI research integration, seasonal events, internationalization

Dependencies and ownership key:
- Owners: Mobile (Unity), Backend (Node), DevOps, Design, Data/Research, Compliance
- Gates: Performance > 60 FPS target devices, bundle < 150MB cellular, privacy docs complete

Risk register summary (see details later):
- Store rejection, performance regressions, gacha policy risk, privacy issues, infra scaling

----

Phase 1: Codebase Analysis & Optimization (Weeks 1–2)

Goals:
- Remove performance bottlenecks, harden security/privacy, prepare viral gacha loops
- Integrate AI literacy instrumentation and bias-detection hooks

Week 1 – Profiling, Budgets, and Security

Tasks:
- Establish device matrix and targets (A12/A13 iPhones; Pixel 5–8; memory 3–6GB)
- Enable deterministic builds; lock Unity and SDK versions per [ProjectVersion.txt](client/unity-project/ProjectSettings/ProjectVersion.txt)
- Define performance budgets: 60 FPS, frame time <= 16.6ms, draw calls < 100, tris < 500k
- Asset pipeline audit: textures (ASTC/ETC2), audio compression, mesh LODs, addressables
- Build-time stripping: IL2CPP, managed stripping level, remove unused assemblies
- Client telemetry: wire performance events to backend metrics
- Security posture: certificate pinning, secure storage, jailbreak/root checks
- Privacy: SDK inventory, data collection map, App Privacy answers draft

Deliverables:
- Performance budget doc and device matrix
- Automated profiling captures across 5 scenes and hot paths
- Security checklist results and remediation tickets
- Draft App Privacy responses and data retention schedule

Success criteria:
- Average FPS >= 60 on mid devices; no frame spikes > 33ms during core loop
- Memory headroom >= 25% at session peak; app size trending to < 150MB OTA
- All critical security checks passing; no plaintext PII

Week 2 – Gacha Loop Tuning and AI Literacy Instrumentation

Tasks:
- Gacha audit: drop tables, pity, soft currency sinks, sessionization, daily/weekly quests
- Ethical safeguards: publish odds, pity thresholds, session caps, teen-friendly UX
- AB test scaffolding for gacha parameters; configure experiment and metrics
- AI literacy: embed bias-detection tasks and reflections in core loop
- Backend optimizations: cache hotspots, pagination, batch endpoints
- CDN/edge caching for static assets; prefetch critical data

Deliverables:
- Gacha design spec with balance sheets and AB test plan
- AI literacy module map with event taxonomy
- Backend performance profile with proposed changes

Success criteria:
- Predicted K-factor >= 1.2 pre-launch via sim; target > 1.5 at launch
- Educational step completion > 80% in test cohort
- p95 API < 200ms on beta endpoints

Dependencies:
- Social backend endpoints: [social.controller.ts](backend/services/social-service/src/controllers/social.controller.ts)
- Sharing/leaderboards endpoints: [sharing.routes.ts](backend/services/social-service/src/routes/sharing.routes.ts), [leaderboard.routes.ts](backend/services/social-service/src/routes/leaderboard.routes.ts)
- Achievement endpoints: [achievement.routes.ts](backend/services/social-service/src/routes/achievement.routes.ts)

----

Phase 2: App Store Preparation & Submission (Weeks 3–4)

Goals:
- Create optimized binaries, complete compliance, and submit to stores with strong metadata

Week 3 – Build Optimization and Metadata

Tasks:
- Android: enable R8, resource shrinking, split APK/ABB by ABI; verify Play feature delivery
- iOS: app thinning and slicing; verify bitcode settings (as required by toolchain)
- Texture/audio compression per platform; strip unused locales/resources
- Reduce cold start: lazy init non-critical SDKs; addressables warmup lists
- Implement privacy manifest and data safety forms
- Draft store listing assets copy and creatives; localize EN first
- Metadata optimization: keywords research, title/subtitle, short and full descriptions
- Wire build scripts: [build-android.sh](client/build-scripts/build-android.sh), [build-ios.sh](client/build-scripts/build-ios.sh)

Deliverables:
- AAB and IPA ready candidates
- Store metadata JSONs updated: [play-store-metadata.json](deployment/app-store/android/play-store-metadata.json), [metadata.json](deployment/app-store/ios/metadata.json)
- Privacy manifests and data safety forms drafts
- Keyword score >= 80/100 draft via target tools

Success criteria:
- Android download size < 150MB for mobile data; iOS <= cell limit with on-demand resources
- TTI improved by 30% from baseline; cold start under 3s on mid devices
- LCP under 1.5s for initial interactive screen

Week 4 – Beta Programs and Submission

Tasks:
- Configure TestFlight internal/external and Play Console closed testing
- Define feedback loops with education partners; distribute builds
- Finalize privacy answers; update in-store forms
- Pre-submission checks: screenshots, previews, age rating, ATT prompts, content
- Run automated compliance suite and fix blockers
- Submit to review with staged rollout plan

Deliverables:
- TestFlight build distributed to 100+ testers
- Play closed test to 200+ testers
- Complete media kit and store assets
- Submission packages uploaded and in review

Success criteria:
- Zero blocker rejections in beta; < 2 minor issues
- App review decisions within 5 business days
- Baseline retention in beta: D1 65%+, D7 45%+

----

Phase 3: Launch & Growth Acceleration (Weeks 5–6)

Goals:
- Execute launch, activate viral mechanics, monitor and iterate quickly

Week 5 – Launch and Viral Systems Activation

Tasks:
- Referral system: deep links, invite codes, double-sided rewards
- Social sharing: templated share images, progress cards
- Leaderboards and achievements spotlight; seasonal event kickoff
- Live-ops calendar and content pipeline
- Feature flags for gacha and event parameters
- Analytics funnels: acquisition, activation, retention, referral (AARRR); crash reporting

Deliverables:
- Referral and sharing live in production
- Seasonal event content packaged and deployed
- Real-time dashboards: DAU/retention/K-factor/ARPU/educational completion

Success criteria:
- K-factor > 1.5 by end of week
- Crash-free sessions > 99.5%
- Referral conversion > 20%, social share CTR > 8%

Week 6 – Optimization and Community Building

Tasks:
- AB tests across gacha tables, onboarding, and rewards
- Community channels launch and moderation runbooks
- Education partners: cohort onboarding and study protocols
- Performance tuning based on telemetry and user feedback
- Add content variants for high-impact screens

Deliverables:
- AB test reports with statistically significant winners
- Community moderation SOPs and escalation matrix
- Partner program materials and onboarding guides

Success criteria:
- D1 70%+, D7 50%+, D30 30%+ in production
- > 80% module completion across partner cohorts
- > 20% WoW DAU growth sustained

----

Phase 4: Scaling & Iteration (Weeks 7–8)

Goals:
- Scale systems, deepen AI research integration, and prepare international expansion

Week 7 – Scale and Advanced AI Integration

Tasks:
- Backend autoscaling and quotas; rate limiting and circuit breakers
- Optimize database queries; add indexes and caching as needed
- Expand AI literacy: adaptive difficulty, bias taxonomy coverage
- Content cadence: weekly challenges and monthly themes
- Improve observability: SLOs, alerting, traces, heatmaps

Deliverables:
- Production capacity for 100k concurrent sessions
- Extended AI module with adaptive curriculum
- New content schedule and authoring templates

Success criteria:
- p95 API < 200ms at 5x load; error rate < 0.1%
- Retention steady or improving as scale increases

Week 8 – Internationalization and Retention Systems

Tasks:
- Localize store listings and top UI flows (ES/FR/PT first)
- Regional pricing and storefront optimizations
- Customer support localization and knowledge base
- Long-term retention: re-engagement, streak saves, comeback rewards
- Audit legal/privacy for new regions

Deliverables:
- Localized listings and in-app strings for priority locales
- Country-specific pricing and offers live
- Retention system enhancements deployed

Success criteria:
- Conversion uplift in localized markets by 10–15%
- Retention uplift of 3–5% from retention features

----

Cross‑Cutting Blueprints

Viral Growth Mechanics
- Referral rewards with anti-abuse checks and cooldowns
- Social proof surfaces on home and results screens
- Streaks, dailies, weekly events, and limited-time collections
- Ethical gacha: visible odds, pity tracker, fair drop rates, opt-outs

Educational Impact Amplification
- Bias-detection challenges integrated into core loop
- Reflection prompts and micro-lessons tied to actions
- Learning analytics: mastery curves, time-on-task, hint usage
- Partner dashboards with cohort progress and exports

Technical Performance
- 60 FPS targets, asset budgets, addressables, async loading
- Memory pooling, object reuse, shader variants trimmed
- Network efficiency: pagination, compression, cache headers
- Client crash/ANR monitoring and triage

Security & Compliance
- TLS with certificate pinning; least-privilege tokens
- Secure storage via platform keystores; no PII in logs
- Privacy manifests and transparent data collection
- COPPA/teen considerations and parental gates when required

CI/CD and Release Management
- Branching with release candidates; feature flags for risky changes
- Automated tests: unit, integration, E2E smoke on device farm
- Staged rollouts with quick rollback playbooks
- Release notes, known issues, and support readiness

Monitoring and KPIs
- Dashboards for DAU, retention, K-factor, ARPU, completion
- SLOs for p95 API latency and error rates
- Alerting on crash spikes, performance regressions, churn risk

----

Approval Strategy and Contingencies

Pre‑submission checklist (iOS):
- Correct bundle ID, provisioning, capabilities
- App Privacy answers accurate and consistent
- ATT prompt only if tracking; purpose strings present
- Screenshots for all devices, preview videos optional
- Content policy compliance, including gacha disclosures

Pre‑submission checklist (Android):
- Target/compile SDK levels compliant; 64-bit native
- Data safety form accurate; ads SDK declarations
- Closed testing tracks configured; release notes present
- Device and Play integrity compliant

Rejection scenarios and actions:
- Privacy mismatch: update forms, remove nonessential data, resubmit within 24–48h
- Performance issues: ship hotfix with asset compression and init deferral
- Gacha policy: add clearer odds screens and session limits; re-review request

Rollback procedures:
- Keep last stable build installable; store staged rollout pauses at 10%
- Feature flags disable new mechanics instantly
- Backfill data migrations and revertable toggles

----

Work Plan and Responsibilities

Owners:
- Mobile: Unity client performance, assets, UX
- Backend: API performance, leaderboards, achievements
- DevOps: CI/CD, store automation, monitoring
- Design/Content: art, copy, metadata, seasonal content
- Data/Research: AI literacy design, AB testing, analytics
- Compliance: policies, privacy, legal review

Weekly ceremonies:
- Monday: goal review and risk check
- Daily: stand-up with cross-functional sync
- Friday: milestone demo and metrics review

Artifacts updated per week:
- Store metadata JSONs, privacy responses, release notes
- Performance and crash reports; AB test dashboards
- Risk register and decision log

----

Success Criteria Summary
- Approval < 30 days with zero critical rejections
- D1/D7/D30 >= 70%/50%/30%
- K-factor > 1.5; DAU WoW > 20%
- Module completion > 80%
- Crash-free > 99.5%; p95 API < 200ms

This plan aligns with existing assets and code paths to enable rapid, safe, and scalable App Store deployment while maximizing viral growth and educational impact.