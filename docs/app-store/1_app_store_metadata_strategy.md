# ThinkRank App Store Metadata Strategy

Purpose: Achieve 80/100+ App Store search score, 25%+ conversion lift, Top 10 rankings for priority keywords, and scalable localization across 10+ markets through a repeatable, data-driven ASO program.

Cross-references
- APP acceleration plan: [APP_STORE_ACCELERATION_PLAN.md](APP_STORE_ACCELERATION_PLAN.md)
- iOS metadata: [metadata.json](deployment/app-store/ios/metadata.json)
- Android metadata: [play-store-metadata.json](deployment/app-store/android/play-store-metadata.json)
- iOS build script: [build-ios.sh](client/build-scripts/build-ios.sh)
- Android build script: [build-android.sh](client/build-scripts/build-android.sh)
- Asset optimization pipeline: [AssetOptimizationPipeline.cs](client/unity-project/Assets/Scripts/Performance/AssetOptimizationPipeline.cs)
- Analytics metrics routes: [metrics.routes.ts](backend/services/analytics-service/src/routes/metrics.routes.ts)
- Compliance validation report: [validation-report.md](docs/validation-report.md)

KPIs and Targets
- Search Score: ≥ 80/100
- Store Page Conversion Rate: +25% vs baseline
- Organic Top-10 Rankings: ≥ 10 target keywords per market
- Global Reach: 10+ locales live with localized metadata and assets
- Experiment Velocity: ≥ 2 significant experiments per 4-week cycle

Table of Contents
- 1. Keyword Strategy Framework
- 2. App Store Description Templates
- 3. Visual Asset Guidelines
- 4. Localization Strategy
- 5. A/B Testing Framework
- 6. Competitive Analysis
- 7. Performance Measurement
- 8. Optimization Roadmap
- 9. Governance and Workflow
- 10. Submission QA Checklists

1. Keyword Strategy Framework

Objectives
- Build a prioritized, high-intent keyword portfolio across Primary, Secondary, Long-tail, and Competitor-derived sets
- Map keywords to store fields with character constraints and impact potential
- Maintain iterative optimization with weekly rank tracking and quarterly re-baselining

Keyword Research Matrix

┌─────────────────────────────────────────────────────────────────┐
│                    Keyword Research Matrix                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │   Primary   │  │ Secondary   │  │   Long-tail │  │Competitor│ │
│  │  Keywords   │  │  Keywords   │  │  Keywords   │  │ Analysis │ │
│  │  (High Vol) │  │  (Med Vol)  │  │  (Low Vol)  │  │          │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────────────┘

Sources
- App Store and Play auto-suggest and related searches
- Competitor titles, subtitles/short descriptions, and user reviews
- SEO keywords and site search terms from marketing properties
- Internal queries and feature usage signals from analytics

Scoring and Prioritization
- Relevance (0–5): proximity to ThinkRank’s core value prop
- Volume (0–5): estimated monthly search demand
- Difficulty (0–5): competitiveness; invert as Ease = 5 − Difficulty
- Intent (0–5): likelihood to convert for our audience
- Priority Score = 0.4*Relevance + 0.3*Volume + 0.2*Ease + 0.1*Intent
- Maintain an active Top 25 list per locale; revisit monthly

Field-by-Field Implementation
- App Name/Title: Lead with primary keyword + brand; avoid truncation on small screens
- Subtitle (iOS)/Short Description (Android): Secondary keywords + outcome-oriented benefits
- iOS Keywords Field: Fill remaining high-priority terms, comma-separated, no spaces, avoid duplicates
- Long Description: Support long-tail phrases naturally; avoid keyword stuffing
- In-App Events/Promotional text: Rotate seasonal or time-bound keywords

Tracking
- Weekly: rank, impressions, product page views, conversion rate per keyword cohort
- Monthly: share-of-voice vs competitors, portfolio refresh
- Quarterly: re-baseline primary and secondary sets

2. App Store Description Templates

Principles
- Clarity over cleverness; outcome-first headlines
- Front-load the first 3 lines; treat as above-the-fold copy
- Mirror user language from reviews and support tickets
- Include targeted keywords naturally to reinforce relevance

Feature-focused Template

Headline: Achieve better research decisions with ThinkRank
Subhead: Discover bias, optimize context, and choose with confidence
Body: Describe 3–5 core features as benefits. Each point should end with a clear user outcome.
CTA: Download ThinkRank and make every choice informed

Benefit-driven Template

Headline: Make complex choices simple
Subhead: Turn uncertainty into clarity in seconds
Body: Focus on how ThinkRank improves speed, accuracy, and confidence. Include 1–2 short social proof statements.
CTA: Get started free today

Social Proof Block

- ★★★★★ Loved by teams and independent researchers
- “ThinkRank helped us reduce decision time by 40%.” — Product Manager

Call-to-Action Variants
- Start now
- Try it free
- Improve your decisions
- Join thousands using ThinkRank

3. Visual Asset Guidelines

Goals
- Drive higher tap-through and conversion with clear, consistent visuals that communicate value in under 3 seconds

Screenshots
- Set 1: Problem → Solution narrative (first 3 images)
- Set 2: Feature highlights with short overlays (3–5 words)
- Maintain strong contrast, consistent typography, and device framing
- Localize text overlays per market; avoid UI text duplication

App Preview Video
- Duration: 15–30 seconds; show value within first 5 seconds
- Structure: Hook → Core value → 2–3 feature beats → Social proof → CTA
- Produce portrait and landscape variants as required per store

Icon Principles
- Distinct silhouette, minimal detail, strong color contrast
- Align with brand shapes; test at 48px for legibility
- Avoid text; focus on recognizable mark

Seasonal Asset Strategy
- Refresh 2–4 times/year for major seasons or events
- Adapt color accents and overlays; keep core brand consistent
- Evaluate lift per season and feed winners into evergreen set

4. Localization Strategy

Markets and Locales (initial 10+)
- English (US, UK), Spanish (ES, MX), French (FR), German (DE), Portuguese (BR), Japanese (JP), Korean (KR), Chinese (Simplified CN, Traditional TW), Hindi (IN)

Workflow
- Source: Write EN-US master with keyword mapping
- Translate: Professional translation with glossary and do-not-translate list
- Review: Native reviewer validates tone, claims, and search terms
- QA: Render on device frames; ensure truncation-safe titles
- Publish: Staged rollout with experiment where available

Local Keyword Optimization
- Build locale-specific matrices; do not directly translate head terms
- Use local competitors and reviews to seed discovery
- Validate with store auto-suggest in the target market

Quality Standards
- Accuracy of claims; privacy and data statements aligned to store policy
- No cultural missteps; respect local norms and idioms
- Consistent CTA verbs; adapt where needed (e.g., UK vs US spelling)

5. A/B Testing Framework

Methodology
- Hypothesis-driven tests on title, subtitle/short description, first 3 screenshots, and preview video thumbnail
- One primary variable per test; hold duration ≥ 7 days or until significance

Significance and Power
- Target alpha 0.10, power 0.80 for speed; tighten to alpha 0.05 for confirmatory tests
- Minimum detectable effect: 5–10% relative lift on conversion rate, pre-calc sample size before launch
- Use sequential analysis to allow early stopping rules when safe

Platforms
- iOS: Product Page Optimization in App Store Connect
- Android: Store Listing Experiments in Google Play Console

Implementation Steps
- Define hypothesis, variable, success metric, and guardrails
- Produce creatives/metadata variants; validate compliance
- Launch 50/50 split; monitor daily
- Conclude on significance; document learning and ship the winner
- Archive assets and outcomes for knowledge base reuse

6. Competitive Analysis

Objectives
- Identify positioning whitespace, messaging angles, and keyword gaps

Steps
- Select top 10 competitors by category rank and shared keywords
- Capture titles, subtitles, first 3 screenshots, preview thumbnails, ratings, and review themes
- Build a comparison table for value props, feature claims, and social proof types
- Map keyword overlap and discover gaps for long-tail opportunities
- Synthesize 3–5 differentiating angles to test in metadata and assets

7. Performance Measurement

Core Metrics (weekly dashboard)
- Search score and trend by locale
- Organic impressions, product page views, conversion rate
- Rank distribution across primary/secondary keyword cohorts
- Tap-through from search to product page (proxy: impression→view)
- Post-install day 1 retention and 7-day activation rate

Data and Pipelines
- Source of truth: analytics events and store console exports
- Expose KPIs via metrics endpoints in the analytics service
- Reference routes: [metrics.routes.ts](backend/services/analytics-service/src/routes/metrics.routes.ts)
- Align data definitions with the compliance validation report: [validation-report.md](docs/validation-report.md)

Decision Rules
- Ship: variant beats control with significance and meets guardrails
- Iterate: trend positive but inconclusive; refine hypothesis
- Revert: negative impact > threshold or policy risk detected

8. Optimization Roadmap

Cadence
- Weekly: keyword rank updates, screenshot copy tweaks, metadata hygiene
- Bi-weekly: run 1–2 experiments on text or first-line visual assets
- Quarterly: full portfolio review; refresh primary keywords and creative direction

12-Week Starter Plan
- Weeks 1–2: Audit, baselines, keyword matrix, competitive teardown
- Weeks 3–4: Title/subtitle test; first 3 screenshots v1
- Weeks 5–6: Description and long-tail reinforcement; preview thumbnail test
- Weeks 7–8: Localization wave 1 (5 locales) with local keyword maps
- Weeks 9–10: Icon and colorway tests; seasonal concept
- Weeks 11–12: Localization wave 2 (5+ locales); consolidate wins

9. Governance and Workflow

RACI
- Marketing: owns messaging, creative production, and calendar
- Product: owns claims accuracy and roadmap alignment
- Design: owns visual system and asset quality
- Engineering: owns pipeline automation and metadata deployment
- Data/Analytics: owns experiment design and analysis

Integrations and Automation
- iOS/Android metadata stored in repo and deployed via build scripts
- Files: [metadata.json](deployment/app-store/ios/metadata.json), [play-store-metadata.json](deployment/app-store/android/play-store-metadata.json)
- Build scripts: [build-ios.sh](client/build-scripts/build-ios.sh), [build-android.sh](client/build-scripts/build-android.sh)
- Asset optimization in client build: [AssetOptimizationPipeline.cs](client/unity-project/Assets/Scripts/Performance/AssetOptimizationPipeline.cs)

Change Management
- Use PRs for any metadata or asset update with side-by-side diffs
- Include experiment ID and hypothesis in commit message
- Maintain a changelog of shipped winners vs archived variants

10. Submission QA Checklists

Metadata
- Titles within truncation limits; leading with primary keyword
- No duplication across title, subtitle, and keywords field
- Claims verifiable; policy-compliant; privacy statements consistent
- Localized strings reviewed by native speaker

Visuals
- First 3 screenshots tell the core story without reading long text
- All overlays localized and legible on small devices
- Icon renders clearly at small sizes; no text
- Preview video hooks in first 5 seconds; correct captions

Experiments
- One primary variable per test
- Pre-calculated sample size and guardrails
- Daily monitoring log and auto-alerts on anomalies
- Results archived and referenced for future tests

Appendix A — Example Description (Short)

Achieve better research decisions with ThinkRank. Detect bias, evaluate context, and choose with confidence. Built for individuals and teams who need reliable judgments fast.

• Identify hidden biases in inputs
• Compare options with structured criteria
• Collaborate and share outcomes

Download ThinkRank and make every choice informed.

Appendix B — Example Screenshot Copy Overlays

- Reveal bias, build clarity
- Evaluate context in seconds
- Decide with confidence
- Built for teams and pros
- Proven impact on decision quality

Appendix C — Localization Markets (Starter Set)

- EN-US, EN-UK, ES-ES, ES-MX, FR-FR, DE-DE, PT-BR, JA-JP, KO-KR, ZH-CN, ZH-TW, HI-IN

Appendix D — Experiment Brief Template

Goal: Improve product page conversion
Hypothesis: If we lead with “Decide with confidence,” conversion will increase for users searching “decision app.”
Variable: First screenshot headline
Metric: Product page conversion rate
Guardrails: Retention day 1 not down > 3%
Sample Size: Calculated to detect 7% lift at alpha 0.10, power 0.80
Duration: Minimum 7 days
Result Logging: Link to dashboard and PR