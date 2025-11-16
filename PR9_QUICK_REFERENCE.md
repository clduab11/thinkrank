# PR #9 Quick Reference Guide

**Last Updated:** 2025-11-16
**Deadline:** Nov 18, 11:59 PM CST (App Store Launch)
**Branch:** `claude/resolve-pr9-launch-01Qoi7se3KmWkugvd634NYhZ`

---

## 📊 Issue Priority Matrix

| Priority | Count | Total Effort | Status |
|----------|-------|--------------|--------|
| 🔴 CRITICAL | 2 | 6 hours | Not Started |
| 🟡 MAJOR | 4 | 16 hours | Not Started |
| 🔵 MINOR | 3 | 4 hours | Not Started |
| **Technical Debt** | 6 | 22 hours | Not Started |
| **TOTAL** | **15** | **48 hours** | **0%** |

---

## 🔴 CRITICAL Issues (Do First!)

### Issue #1: Perplexity API Field Mismatches
- **File:** `backend/services/ai-service/src/adapters/perplexity-adapter.ts`
- **Fix:** Change `data.citations` → `data.search_results/top_sources`
- **Fix:** Change `data.images` → `data.top_images`
- **Effort:** 2 hours
- **Impact:** API integration broken

### Issue #2: PII Exposure in Logging
- **Files:** All AI service tools, MCP server
- **Fix:** Create `sanitizeToolArgs()` utility, apply to all logging
- **Effort:** 4 hours
- **Impact:** GDPR/CCPA violation, security risk

---

## 🟡 MAJOR Issues (High Priority)

### Issue #3: Claude JSON Parsing
- **File:** `backend/services/ai-service/src/adapters/claude-adapter.ts`
- **Fix:** Create `SafeJSONParser` class with Zod validation
- **Effort:** 3 hours

### Issue #4: Gamification Negative Points
- **File:** `backend/services/game-service/src/services/gamification-service.ts`
- **Fix:** Add min/max bounds to point calculation
- **Effort:** 2 hours

### Issue #5: Redis KEYS Blocking
- **File:** `backend/services/game-service/src/services/leaderboard-service.ts`
- **Fix:** Replace `KEYS` with `SCAN` iterator
- **Effort:** 3 hours

### Issue #6: MCP Sensitive Logging
- **Files:** `backend/services/mcp-server/src/tools/*`
- **Fix:** Apply same sanitization from Issue #2
- **Effort:** 2 hours
- **Depends on:** Issue #2

---

## 🔵 MINOR Issues (Medium Priority)

### Issue #7: Copilot Comments
- **Fix:** Correct terminology, dates, imports
- **Effort:** 2 hours

### Issue #8: Mock Data Generator
- **Fix:** Make percentiles configurable
- **Effort:** 1 hour

### Issue #9: Documentation Paths
- **Fix:** Update broken links
- **Effort:** 1 hour

---

## 📋 Additional Technical Debt

### Issue #10: JWT Security (MAJOR)
- Migrate to AWS KMS/Azure Key Vault
- Implement Redis token blacklisting
- **Effort:** 6 hours

### Issue #11: Console.log Cleanup (MINOR)
- Replace 51 console.log statements
- **Effort:** 2 hours

### Issue #12: Package Lock (MAJOR)
- Generate package-lock.json
- **Effort:** 15 minutes

### Issue #13: Performance Optimization (MAJOR)
- API: 500ms → <200ms
- Bundle: 150MB → <100MB
- **Effort:** 16 hours

### Issue #14: Test Coverage (MAJOR)
- API Gateway: 0% → 80%+
- **Effort:** 12 hours

### Issue #15: App Store Prep (CRITICAL)
- iOS and Android submission packages
- **Effort:** 8 hours

---

## ⚡ Execution Plan

### Day 1 (Nov 16) - CRITICAL + MAJOR
**Morning (4 hours):**
- [ ] Issue #1: Perplexity API (2h)
- [ ] Issue #2: PII Sanitization (4h) ⬅️ START HERE

**Afternoon (4 hours):**
- [ ] Issue #3: JSON Parsing (3h)
- [ ] Issue #4: Gamification (2h)
- [ ] Issue #12: Package lock (15min)

**Evening (4 hours):**
- [ ] Issue #5: Redis SCAN (3h)
- [ ] Issue #6: MCP Logging (2h)
- [ ] Issue #10: JWT Security (6h) - START

### Day 2 (Nov 17) - Testing + Polish
**Morning (4 hours):**
- [ ] Issue #10: JWT Security (continued)
- [ ] Issue #11: Console cleanup (2h)
- [ ] Issues #7-9: Minor fixes (4h)

**Afternoon (4 hours):**
- [ ] Issue #13: Performance optimization (16h) - START
- [ ] Issue #14: Test coverage (12h) - PARALLEL

**Evening (4 hours):**
- [ ] Continue performance + testing
- [ ] Issue #15: App Store prep (8h) - START

### Day 3 (Nov 18) - Final Push
**All Day (12 hours):**
- [ ] Complete Issue #13: Performance
- [ ] Complete Issue #14: Testing
- [ ] Complete Issue #15: App Store submission
- [ ] Final validation and deployment

---

## 🚀 Quick Commands

### Check Current Status
```bash
# Run all checks
npm run lint
npm run typecheck
npm test
npm run check:doc-links

# Check for security issues
npm audit
grep -r "console\.log" backend/
grep -r "\.keys(" backend/ | grep redis
```

### Fix Quick Wins
```bash
# Generate package-lock.json
npm install --package-lock-only

# Fix linting
npm run lint:fix

# Update documentation paths
npm run fix:doc-paths
```

### Run Tests
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Performance tests
npm run test:performance
```

---

## 📁 File Locations

### Issue Documentation
- **Roadmap:** `/PR9_IMPROVEMENT_ROADMAP.md`
- **Issues:** `/.github/ISSUES/CRITICAL-*.md`, `MAJOR-*.md`, `MINOR-*.md`
- **Quick Ref:** `/PR9_QUICK_REFERENCE.md` (this file)

### Key Files to Modify
```
backend/services/ai-service/src/adapters/
├── perplexity-adapter.ts     # Issue #1
└── claude-adapter.ts          # Issue #3

backend/shared/src/utils/
├── sanitization.ts            # Issue #2 (NEW FILE)
├── json-parser.ts             # Issue #3 (NEW FILE)
└── redis-utils.ts             # Issue #5 (NEW FILE)

backend/services/game-service/src/services/
├── gamification-service.ts    # Issue #4
└── leaderboard-service.ts     # Issue #5

backend/services/mcp-server/src/
└── tools/**                   # Issue #6

backend/services/auth-service/src/
├── services/token-management.service.ts  # Issue #10
└── middleware/auth.middleware.ts         # Issue #10

backend/tests/utils/
└── mock-data-generator.ts     # Issue #8
```

---

## ✅ Success Criteria

### Pre-Merge Checklist
- [ ] All CRITICAL issues resolved
- [ ] All MAJOR issues resolved
- [ ] CodeRabbit approval received
- [ ] All CI/CD tests passing
- [ ] No high/critical security vulnerabilities
- [ ] Performance benchmarks met

### App Store Launch Checklist
- [ ] API response times <200ms
- [ ] Bundle size <100MB
- [ ] Test coverage >80%
- [ ] Crash rate <0.1%
- [ ] iOS submission approved
- [ ] Android submission approved

---

## 🆘 Emergency Contacts

- **Project Lead:** info@parallax-ai.app
- **Technical Issues:** Create issue in repo
- **Security Issues:** Mark as CRITICAL, notify immediately

---

## 📚 Resources

- **Full Roadmap:** `PR9_IMPROVEMENT_ROADMAP.md`
- **Individual Issues:** `.github/ISSUES/*.md`
- **Codebase Docs:** `docs/` directory
- **CI/CD Pipeline:** `.github/workflows/`

---

**Note:** This is a living document. Update as issues are completed or priorities change.
