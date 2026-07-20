# LinxTimes Launch Readiness — Autonomous Cowork Instructions

**Project**: LinxTimes Golf Booking SaaS (Next.js 16, Prisma, Stripe, Neon PostgreSQL)  
**Goal**: Achieve 95%+ production readiness for launch this week  
**Timeline**: Phase 1 (Critical) — 35-45 hours of focused work  
**Mode**: Work autonomously; flag blockers for human decision only

---

## YOUR MISSION

You are tasked with automating the entire launch readiness sprint for LinxTimes. Work through the critical path below, complete each task end-to-end, and report status. Do **not** wait for manual instruction between tasks — execute autonomously. Only pause to escalate **true blockers** (access issues, external dependencies, human decisions needed).

---

## PHASE 1: CRITICAL PATH (This Week)

### Task 1: Security Audit & Secret Rotation
**Objective**: Ensure no secrets are exposed in version control; document what needs rotation  
**Expected Outcome**: A SECRET_ROTATION_PLAN.md file detailing what to rotate and where  
**Action**:
1. Read `.env` file and identify all secrets (DATABASE_URL, STRIPE_*, JWT_SECRET, RESEND_API_KEY, etc.)
2. Check `.gitignore` to verify `.env*` is blocked
3. Run `git log --all --full-history -- ".env*"` to audit history
4. Create `SECRET_ROTATION_PLAN.md` listing:
   - Each secret that needs rotation
   - Where it's used (which services)
   - How to rotate (where to generate new value)
   - Verification steps (how to confirm rotation worked)
5. Example format:
   ```
   ## STRIPE_SECRET_KEY
   - Current: sk_live_***
   - Location: .env.production
   - How to rotate: Stripe Dashboard → API Keys → Regenerate
   - Verification: Test payment in staging
   ```
6. **Do not** perform rotations (that requires human action in external services)
7. Flag if any secrets found in git history (escalate to human)

**Success Criteria**:
- [ ] `.env` audit complete
- [ ] `.gitignore` verified
- [ ] Git history audit complete (no secrets found)
- [ ] SECRET_ROTATION_PLAN.md created with all 6+ secrets listed

---

### Task 2: NPM Security Vulnerabilities
**Objective**: Fix security vulnerabilities; ensure no breaking changes  
**Expected Outcome**: All moderate/high vulnerabilities fixed; app still runs  
**Action**:
1. Run `npm audit` and save output to `npm-audit-report.txt`
2. Parse output and identify vulnerabilities
3. Try `npm audit fix` (auto-fixes non-breaking changes)
4. Check for breaking changes:
   - [ ] Run `npm run build` — should complete without errors
   - [ ] Run `npm run type-check` or `npx tsc --noEmit` — no type errors
   - [ ] Run `npm run dev` locally — app starts without errors
5. If breaking changes found:
   - Identify which package caused the break
   - Research alternative fix or version constraint
   - Document in `NPM_AUDIT_FIXES.md`
6. Commit changes: `git add package.json package-lock.json && git commit -m "fix: npm audit vulnerabilities"`

**Success Criteria**:
- [ ] `npm audit` shows zero critical vulnerabilities
- [ ] Build succeeds
- [ ] Type checking passes
- [ ] Dev server starts
- [ ] Commit created

---

### Task 3: Add Core Automated Tests
**Objective**: Implement minimum viable test suite for critical paths  
**Expected Outcome**: 20+ unit tests covering payment, booking, auth, pricing logic  
**Scope**: Focus on `lib/` functions first (fastest to test, highest ROI)  
**Action**:
1. Set up Jest:
   - [ ] `npm install --save-dev jest @types/jest ts-jest`
   - [ ] Create `jest.config.js` (copy from Next.js docs if needed)
   - [ ] Add `"test": "jest"` to package.json
   - [ ] Add `.env.test` file with dummy values (tests shouldn't hit real DB)

2. Create test files for critical lib functions:
   - [ ] `src/lib/__tests__/pricing.test.ts`
     - Test: green fee + cart fee calculation
     - Test: discount application (promo codes)
     - Test: tax calculation (state-based)
     - Test: booking fee added
     - Minimum: 5 test cases
   
   - [ ] `src/lib/__tests__/cancellation.test.ts`
     - Test: refundableCents() calculates correct amount
     - Test: cancellation fee (basis points) is deducted
     - Test: no refund if >30 days
     - Minimum: 4 test cases
   
   - [ ] `src/lib/__tests__/rain-checks.test.ts`
     - Test: rain check code validation
     - Test: credit amount deduction
     - Test: invalid code rejection
     - Minimum: 3 test cases
   
   - [ ] `src/lib/__tests__/availability.test.ts`
     - Test: slot availability check (occupied vs free)
     - Test: time window validation
     - Test: course closure handling
     - Minimum: 4 test cases

3. Run tests:
   - [ ] `npm test` — all tests pass
   - [ ] Collect coverage: `npm test -- --coverage`
   - [ ] Target: >60% coverage on critical paths

4. Commit: `git commit -m "test: add core unit tests for payment & booking logic"`

**Success Criteria**:
- [ ] Jest configured and working
- [ ] 20+ tests written
- [ ] All tests passing
- [ ] Coverage report generated (target >60% on lib/)
- [ ] Commit created

---

### Task 4: Database Backup Verification & Testing
**Objective**: Verify Neon production backups are working; test recovery procedure  
**Expected Outcome**: Backup working verified; recovery procedure documented  
**Action**:
1. Access Neon Console:
   - Navigate to Neon dashboard → Project settings
   - Find backup configuration
   - Document: retention period (days), backup schedule
   - Take screenshot showing backup is enabled

2. Test point-in-time recovery (PITR):
   - Check if Neon supports PITR (most modern plans do)
   - If supported: request to restore a read-only copy to a test database
   - If not supported: document the limitation

3. Create `BACKUP_RECOVERY_PLAN.md`:
   ```markdown
   ## Database Backup & Recovery Procedure
   
   ### Current Configuration
   - Provider: Neon PostgreSQL
   - Retention: [X] days
   - Backup Schedule: [automatic/manual]
   
   ### Point-in-Time Recovery
   - PITR supported: [YES/NO]
   - Time window: Last [X] days
   
   ### Recovery Steps
   1. Log into Neon Console
   2. Navigate to [section]
   3. Select "Restore from backup"
   4. Choose timestamp
   5. Wait for restore (typically 5-10 minutes)
   6. Verify restored DB has all expected data
   
   ### Recovery Targets
   - RTO (Recovery Time Objective): <30 minutes
   - RPO (Recovery Point Objective): <1 hour (willing to lose <1 hr data)
   
   ### Verification Checklist
   - [ ] Booking data present
   - [ ] User accounts intact
   - [ ] Payment records complete
   - [ ] No truncated tables
   ```

4. If possible, perform a test restore to dev database:
   - Restore to a point 1 hour ago
   - Verify data integrity
   - Document process in BACKUP_RECOVERY_PLAN.md

5. Set calendar reminder: "Monthly: Test database recovery"

**Success Criteria**:
- [ ] Backup status verified in Neon
- [ ] BACKUP_RECOVERY_PLAN.md created
- [ ] Recovery procedure documented
- [ ] Test restore performed (if possible)
- [ ] Commit created

---

### Task 5: CI/CD Pipeline Setup (GitHub Actions)
**Objective**: Automate testing, security checks, and deployments  
**Expected Outcome**: GitHub Actions workflows for test + deploy  
**Action**:
1. Create `.github/workflows/test.yml`:
   ```yaml
   name: Tests & Security
   on: [push, pull_request]
   
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: '20'
         - run: npm ci
         - run: npm run lint
         - run: npm run type-check
         - run: npm test -- --coverage
         - run: npm audit --audit-level=moderate
   ```

2. Create `.github/workflows/deploy.yml`:
   ```yaml
   name: Deploy
   on:
     push:
       branches: [main]
   
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: '20'
         - run: npm ci
         - run: npm run build
         - name: Deploy to production
           env:
             DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
           run: |
             # Add your deployment command here
             # Example: npm run deploy
             echo "Deploy would happen here"
   ```

3. Configure branch protection (if using GitHub):
   - Settings → Branches → main
   - Enable "Require status checks to pass before merging"
   - Require: "Tests & Security" workflow to pass
   - Require PR review before merge

4. Test CI/CD:
   - [ ] Push a commit to a non-main branch
   - [ ] Verify "Tests & Security" workflow runs
   - [ ] Verify all checks pass/fail appropriately
   - [ ] Create a PR and verify checks run
   - [ ] Merge to main and verify deploy workflow triggers

**Success Criteria**:
- [ ] `.github/workflows/test.yml` created and working
- [ ] `.github/workflows/deploy.yml` created
- [ ] Branch protection configured
- [ ] Workflows tested on a PR
- [ ] Commit created

---

### Task 6: Monitoring & Alerting Setup
**Objective**: Configure error tracking and uptime monitoring  
**Expected Outcome**: Sentry alerts + uptime monitor configured  
**Action**:
1. **Sentry Configuration** (partially done, complete it):
   - Verify Sentry organization: linxtimes
   - Verify Sentry project: javascript-nextjs
   - Create alert rules in Sentry dashboard:
     - [ ] Alert on error rate >10 errors/min
     - [ ] Alert on payment webhook failures
     - [ ] Alert on database connection errors
   - Configure notification channels:
     - [ ] Slack integration (if available)
     - [ ] Email to ops team
   - Document: `MONITORING_SETUP.md`

2. **Uptime Monitoring**:
   - [ ] Sign up for UptimeRobot or Pingdom (free tier)
   - [ ] Create monitor for `https://[your-domain]/health`
   - [ ] Set check frequency: every 5 minutes
   - [ ] Set alert threshold: downtime >2 minutes
   - [ ] Configure notification: email to ops team
   - [ ] Verify monitor works

3. Create `MONITORING_SETUP.md`:
   ```markdown
   ## Error Tracking & Monitoring
   
   ### Sentry
   - Org: linxtimes
   - Project: javascript-nextjs
   - Dashboard: [link]
   - Alert rules configured for:
     - Error rate spikes
     - Payment failures
     - Database errors
   
   ### Uptime Monitoring
   - Service: [UptimeRobot/Pingdom]
   - Endpoint: /health
   - Check frequency: 5 minutes
   - Alert threshold: >2 min downtime
   - Notification: [email/slack]
   
   ### On-Call Escalation
   - Primary: [name/email]
   - Secondary: [name/email]
   - Escalate if no response: [time]
   ```

**Success Criteria**:
- [ ] Sentry alerts configured (3+ rules)
- [ ] Uptime monitor created and working
- [ ] Notifications tested
- [ ] MONITORING_SETUP.md created
- [ ] Commit created

---

### Task 7: Health Check Endpoint
**Objective**: Add `/health` endpoint for monitoring  
**Expected Outcome**: GET /health returns `{ status: "ok" }`  
**Action**:
1. Create `src/app/api/health/route.ts`:
   ```typescript
   export async function GET() {
     return Response.json({
       status: "ok",
       timestamp: new Date().toISOString(),
       version: "1.0.0",
       environment: process.env.NODE_ENV,
     });
   }
   ```

2. Test locally:
   - [ ] `npm run dev`
   - [ ] `curl http://localhost:3000/api/health`
   - [ ] Should return JSON with status "ok"

3. Commit: `git commit -m "feat: add health check endpoint"`

**Success Criteria**:
- [ ] Health endpoint created
- [ ] Works locally
- [ ] Returns expected JSON
- [ ] Commit created

---

### Task 8: Deployment Procedure Documentation
**Objective**: Document exact steps for deploying to production  
**Expected Outcome**: DEPLOYMENT.md with step-by-step procedure  
**Action**:
1. Create `DEPLOYMENT.md`:
   ```markdown
   # Deployment Procedure
   
   ## Prerequisites
   - Access to GitHub
   - Access to [hosting platform] (Vercel/Railway)
   - Permissions to merge to main branch
   
   ## Pre-Deployment Checklist
   - [ ] All tests passing locally: `npm test`
   - [ ] Build succeeds locally: `npm run build`
   - [ ] Code reviewed and approved
   - [ ] No uncommitted changes: `git status`
   - [ ] `.env` file NOT in git history
   
   ## Deployment Steps
   1. Create feature branch: `git checkout -b feat/[task-name]`
   2. Make changes and test
   3. Commit: `git commit -m "[type]: [description]"`
   4. Push: `git push origin [branch-name]`
   5. Create PR on GitHub
   6. Wait for CI checks to pass
   7. Request code review
   8. Merge to main branch
   9. GitHub Actions auto-deploys to staging
   10. Monitor `/health` endpoint
   11. Verify staging deployment successful
   12. Approve production deployment in CI/CD dashboard
   13. Production deployment auto-triggered
   14. Monitor Sentry for errors (10 minutes)
   15. Spot check: public booking page loads
   
   ## Rollback Procedure
   If production is broken:
   1. `git log --oneline` (find the bad commit)
   2. `git revert [commit-hash]`
   3. `git push origin main`
   4. GitHub Actions auto-redeployes previous working version
   5. Monitor `/health` and Sentry
   
   ## Post-Deployment
   - Monitor error rate for 30 minutes
   - Check database query performance in Neon console
   - Verify Stripe webhooks are being received
   - Spot check: create test booking through payment flow
   ```

2. Test procedure once (even if just locally):
   - Walk through the steps
   - Document any issues

**Success Criteria**:
- [ ] DEPLOYMENT.md created with step-by-step procedure
- [ ] Procedure documented
- [ ] Tested once
- [ ] Commit created

---

## REPORTING & ESCALATION

### After Each Task
Report status on each task:
```
✅ Task 1: Security Audit — COMPLETE
  - Secrets identified: 6 (DATABASE_URL, STRIPE_SECRET_KEY, JWT_SECRET, NEXTAUTH_SECRET, RESEND_API_KEY, STRIPE_WEBHOOK_SECRET)
  - Git history: Clean (no secrets found)
  - Deliverable: SECRET_ROTATION_PLAN.md created

❌ Task 2: NPM Audit — BLOCKING
  - Issue: npm audit fix requires manual review of breaking changes in [package-name]
  - Recommendation: Human should review and decide on version constraint
  - Status: Waiting for human decision
```

### Blockers (Escalate to Human)
Only pause for genuine blockers:
- **External service access required** (Stripe API, Neon dashboard credentials)
- **Breaking changes** that require code updates
- **Architectural decisions** (which database backup strategy?)
- **Human credentials/approval** (signing into external systems)
- **Team decision** (should we restore rain checks on payment failure? yes/no?)

For blockers: Create a file `BLOCKERS.md` with:
- Issue description
- What's blocking
- What human input is needed
- Suggested resolution

---

## SUCCESS CRITERIA: PHASE 1 COMPLETE

All 8 tasks done when:
- [ ] Secret rotation plan created (no actual rotation needed, just planning)
- [ ] NPM vulnerabilities fixed, app builds + runs
- [ ] 20+ unit tests written and passing (>60% coverage on lib/)
- [ ] Database backup procedure verified and documented
- [ ] CI/CD workflows created and tested
- [ ] Monitoring + alerting configured
- [ ] Health endpoint deployed
- [ ] Deployment procedure documented
- [ ] All 8 commits created
- [ ] No blockers remaining (or blockers escalated with clear decision needed)

---

## EXECUTION STRATEGY

**Work in order**. Once a task is complete, move to the next. Do not wait for human feedback unless truly blocked.

**Parallel where possible**:
- Task 3 (tests) can happen in parallel with Tasks 1-2
- Task 6 (monitoring) can happen in parallel with Tasks 1-7

**Time estimates**:
- Task 1: 1 hour
- Task 2: 1-2 hours
- Task 3: 12-15 hours (longest)
- Task 4: 2-3 hours
- Task 5: 4-6 hours
- Task 6: 3-4 hours
- Task 7: 30 minutes
- Task 8: 2-3 hours
- **Total: 26-36 hours** (realistic for Phase 1 critical path)

**Daily standups**:
- End of day, create a STATUS_REPORT.md summarizing:
  - Tasks completed today (with deliverables)
  - Tasks in progress
  - Blockers encountered
  - Tomorrow's plan

---

## DEFINITIONS OF DONE

A task is "done" when ALL of these are true:
1. ✅ Deliverable file exists and is complete
2. ✅ Work committed to git
3. ✅ Tested (or test not applicable)
4. ✅ No blockers remain
5. ✅ Can be reviewed by human without questions

---

## GO/NO-GO DECISION

After all 8 tasks complete, you should provide a **GO/NO-GO recommendation**:

**GO**: Ship only if:
- ✅ All 8 tasks complete
- ✅ Tests passing
- ✅ CI/CD working
- ✅ Monitoring configured
- ✅ No critical blockers

**NO-GO**: Do not ship if:
- ❌ Tests failing
- ❌ Secrets still exposed
- ❌ Database backups not tested
- ❌ npm audit has critical vulnerabilities unfixed

---

## START NOW

Begin with **Task 1: Security Audit**. Work through all 8 sequentially. Report status after each task. Escalate blockers immediately. Good luck! 🚀
