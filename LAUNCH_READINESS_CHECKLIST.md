# LinxTimes Launch Readiness Checklist

**Project**: LinxTimes Golf Booking SaaS  
**Current Readiness**: ~60%  
**Target Readiness**: 95%+  
**Timeline**: This week (Phase 1) + Week 1 post-launch (Phase 2)

---

## 🔴 CRITICAL — DO NOT SHIP WITHOUT (Phase 1: This Week)

### 1. Rotate All Secrets
**Status**: ⚠️ URGENT — Secrets exposed in `.env` file  
**Effort**: 1 hour  
**Owner**: DevOps/Deployment  
**Description**: 
- `.env` file contains live credentials (Database URL, Stripe keys, JWT secrets, API keys)
- These must be rotated immediately and removed from version control
- Move all secrets to environment variables on hosting platform only

**Checklist**:
- [ ] Rotate DATABASE_URL (new password in Neon)
- [ ] Rotate STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY (get new from Stripe dashboard)
- [ ] Rotate JWT_SECRET (generate new random 32+ char string)
- [ ] Rotate NEXTAUTH_SECRET (generate new random 32+ char string)
- [ ] Rotate RESEND_API_KEY (regenerate in Resend account)
- [ ] Rotate STRIPE_WEBHOOK_SECRET (regenerate in Stripe)
- [ ] Verify `.gitignore` blocks `.env*` and `.env.*.local`
- [ ] Audit git history: `git log --all --full-history -- ".env*"` (should be empty)
- [ ] Update `.env.example` with placeholders (no real values)
- [ ] Store all secrets only in hosting platform environment (Vercel/Railway)
- [ ] Delete all local `.env` files after moving to hosting

**Why This Matters**: If repo ever becomes public or history is visible, all accounts are compromised.

---

### 2. Fix NPM Security Vulnerabilities
**Status**: ⚠️ OPEN — 5 moderate vulnerabilities  
**Effort**: 1-2 hours  
**Owner**: Backend Lead  
**Description**: 
- Run `npm audit` to see vulnerabilities
- Run `npm audit fix` to auto-patch
- Manually review and test any breaking changes
- Some vulnerabilities in transitive dependencies (may require updating parent packages)

**Checklist**:
- [ ] Run `npm audit` and document findings
- [ ] Run `npm audit fix --force` (if needed for critical issues)
- [ ] Test application still runs: `npm run dev`
- [ ] Check for breaking changes in dependencies
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Commit and push changes

---

### 3. Add Automated Testing (CRITICAL)
**Status**: ❌ MISSING — Zero tests  
**Effort**: 40-60 hours (Phase 1: start with 20 hrs core tests)  
**Owner**: QA/Backend Lead  
**Description**: 
- Currently zero test coverage. This is highest risk for production.
- Start with critical paths: payment processing, booking creation, auth
- Set up Jest/Vitest + testing framework
- Implement unit + integration tests
- Goal: 60%+ coverage on critical paths, 30%+ overall

**Checklist**:
- [ ] Install test framework: `npm install --save-dev jest @types/jest ts-jest`
- [ ] Create `jest.config.js` configuration
- [ ] Add test script to `package.json`: `"test": "jest"`
- [ ] Create test files:
  - [ ] `src/lib/__tests__/pricing.test.ts` — price calculation, discounts, taxes
  - [ ] `src/lib/__tests__/availability.test.ts` — slot availability logic
  - [ ] `src/lib/__tests__/cancellation.test.ts` — refund calculations, fee deduction
  - [ ] `src/lib/__tests__/rain-checks.test.ts` — credit consumption, restoration
  - [ ] `src/app/api/__tests__/bookings.test.ts` — booking creation flow
  - [ ] `src/app/api/__tests__/stripe-webhook.test.ts` — webhook signature verification, payment processing
- [ ] Run tests locally: `npm test`
- [ ] Verify tests pass before commit
- [ ] Target minimum: 10-15 tests covering payment + booking happy path + error cases

**Phase 1 Target**: Unit tests for critical library functions (lib/) — ~20 hrs  
**Phase 2**: Integration tests for API routes + E2E tests for booking flow — ~40 hrs

---

### 4. Test Database Backup & Recovery
**Status**: ⚠️ INCOMPLETE — Backups assumed but not tested  
**Effort**: 2-3 hours  
**Owner**: DevOps/Database  
**Description**: 
- Neon PostgreSQL likely has automatic backups, but recovery procedure is untested
- If production data is lost, can you restore? Unknown.
- Must test before launch.

**Checklist**:
- [ ] Verify Neon backups are enabled (log into Neon → Settings → Backups)
- [ ] Document backup retention period (typically 7-30 days; confirm for your account)
- [ ] Request or perform point-in-time recovery test (restore to test database)
- [ ] Verify restored database contains all expected data (bookings, courses, users)
- [ ] Document recovery procedure step-by-step
- [ ] Set up backup monitoring alert (notify if backup fails)
- [ ] Document RPO/RTO targets in runbook:
  - Recovery Point Objective (RTO): <1 hour (willing to lose <1 hr of data)
  - Recovery Time Objective (RTO): <30 minutes to restore and verify
- [ ] Schedule monthly: Verify backup still works

---

### 5. Set Up CI/CD Pipeline
**Status**: ❌ MISSING — No automated testing or deployments  
**Effort**: 4-6 hours  
**Owner**: DevOps/Infra  
**Description**: 
- Automate testing, linting, security checks on every push
- Block merges if tests/security checks fail
- Automate deployments to staging/production

**Checklist**:
- [ ] Create `.github/workflows/test.yml`:
  - Trigger: on push to any branch, on PR
  - Jobs: 
    - [ ] Lint: `npm run lint`
    - [ ] Type check: `npx tsc --noEmit`
    - [ ] Tests: `npm test` (require coverage >60% on critical paths)
    - [ ] Security: `npm audit --audit-level=moderate` (fail if moderate+ vulnerabilities)
  - Report results on PR
- [ ] Create `.github/workflows/deploy.yml`:
  - Trigger: on merge to `main` branch
  - Jobs:
    - [ ] Run tests again
    - [ ] Deploy to staging environment
    - [ ] Run smoke tests on staging
    - [ ] Deploy to production (after manual approval)
    - [ ] Notify team on Slack
- [ ] Protect `main` branch: require PR review + CI checks pass
- [ ] Add branch protection rule: "Require branches to be up to date before merging"
- [ ] Configure GitHub → Vercel/Railway integration for automated deployments
- [ ] Test: make a PR, verify CI runs, verify tests block merge if failing

---

### 6. Set Up Basic Monitoring & Alerting
**Status**: 🟡 PARTIAL — Sentry partially configured  
**Effort**: 3-4 hours  
**Owner**: DevOps/Monitoring  
**Description**: 
- App crashes → you don't know until customers complain
- Add error alerts + uptime monitoring

**Checklist**:
- [ ] Configure Sentry alerts:
  - [ ] Alert on any error rate spike (>10 errors/min)
  - [ ] Alert on payment webhook failures
  - [ ] Alert on database connection errors
  - [ ] Configure Slack/email notification channels
- [ ] Add uptime monitoring (external service):
  - [ ] Sign up for UptimeRobot or Pingdom (free tier available)
  - [ ] Configure to ping `https://[your-domain]/health` every 5 minutes
  - [ ] Alert if API doesn't respond for >2 minutes
  - [ ] Create incident response escalation (who gets paged?)
- [ ] Create Sentry dashboard for:
  - Error rate (target: <0.1%)
  - Failed webhook count (target: 0)
  - Performance metrics (API response time p95)
- [ ] Test: manually trigger an error in staging and verify Sentry alert fires

---

### 7. Add Health Check Endpoint
**Status**: ❌ MISSING  
**Effort**: 30 minutes  
**Owner**: Backend  
**Description**: 
- Monitoring services need a way to verify app is alive
- Simple endpoint that returns `{ status: "ok" }`

**Checklist**:
- [ ] Create `src/app/api/health/route.ts`:
  ```typescript
  export async function GET() {
    return Response.json({ status: "ok", timestamp: new Date().toISOString() });
  }
  ```
- [ ] Test: `curl http://localhost:3000/api/health` → should return JSON
- [ ] Deploy to production and verify uptime monitor can reach it

---

### 8. Create Deployment Procedure Documentation
**Status**: ❌ MISSING — No documented process  
**Effort**: 2-3 hours  
**Owner**: DevOps  
**Description**: 
- How do you deploy a new version? How do you rollback?
- Must be clear and repeatable.

**Checklist**:
- [ ] Create `DEPLOYMENT.md` with:
  - Prerequisites (who can deploy? what access needed?)
  - Pre-deployment checklist:
    - [ ] All tests passing
    - [ ] Code reviewed and approved
    - [ ] No uncommitted changes
    - [ ] Secrets not exposed
  - Deployment steps:
    - [ ] Merge to `main` branch (triggers CI/CD)
    - [ ] Verify all CI checks pass
    - [ ] Staging deployment auto-triggered
    - [ ] Manual approval for production in CI/CD dashboard
    - [ ] Production deployment auto-triggered
    - [ ] Verify `/health` endpoint returns 200
    - [ ] Spot check: public booking page loads
  - Rollback procedure:
    - [ ] If production broken: `git revert [commit]`
    - [ ] Push to `main` (triggers re-deployment)
    - [ ] Verify `/health` responds again
  - Post-deployment:
    - [ ] Monitor Sentry for errors for 10 minutes
    - [ ] Check database query performance (check Neon console)
- [ ] Test: actually deploy using this procedure, document any issues
- [ ] Share with team, collect feedback

---

## 🟡 HIGH PRIORITY (Week 1 Post-Launch)

### 9. Structured Logging
**Status**: ❌ MISSING — Only `console.log()`  
**Effort**: 6-8 hours  
**Owner**: Backend  
**Description**: 
- All logs go to `console.log` → unstructured, unsearchable
- In production, you can't find logs by request ID or correlate frontend → backend errors

**Checklist**:
- [ ] Install logging library: `npm install pino` (or winston/bunyan)
- [ ] Create `src/lib/logger.ts`:
  - Format: JSON with timestamp, level (INFO/WARN/ERROR), message, context
  - Include request ID for correlation
- [ ] Update all logging calls to use structured logger
- [ ] Log events:
  - [ ] Payment webhook received + processed
  - [ ] Booking created (with booking ID for tracing)
  - [ ] Refund issued
  - [ ] Email sent (with golfer email, status)
  - [ ] Auth failures (login attempt, reason)
  - [ ] Errors in critical paths (payment, webhook, email)
- [ ] Ship logs to Sentry or log aggregation service
- [ ] Create log retention policy:
  - [ ] Audit logs (payment events): 90 days
  - [ ] Application logs: 30 days
  - [ ] Debug logs: 7 days

---

### 10. Email Retry Queue
**Status**: ⚠️ INCOMPLETE — Failures are silent  
**Effort**: 4-6 hours  
**Owner**: Backend  
**Description**: 
- If Resend API is down, booking confirmation email never reaches golfer
- They think booking failed even though payment succeeded

**Checklist**:
- [ ] Create `EmailQueue` table in database:
  ```sql
  CREATE TABLE email_queue (
    id UUID PRIMARY KEY,
    to_email VARCHAR(255),
    subject VARCHAR(255),
    template_name VARCHAR(100),
    template_data JSONB,
    status VARCHAR(20), -- "pending", "sent", "failed"
    attempts INT DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP,
    sent_at TIMESTAMP
  );
  ```
- [ ] Update `src/lib/email.ts`:
  - On send success: mark as `sent`
  - On send failure: insert into queue instead of throwing error
- [ ] Create retry cron job (runs every 5 minutes):
  - [ ] Find entries with status=`pending` or `failed` where `attempts < 3`
  - [ ] Retry sending
  - [ ] Update status + attempt count
  - [ ] Log results
- [ ] Alert: if >5 emails stuck in queue for >30 min, notify ops
- [ ] Test: trigger email failure, verify email eventually sends on retry

---

### 11. Missing GDPR Compliance Endpoints
**Status**: ⚠️ INCOMPLETE — Privacy Policy promises but no endpoints  
**Effort**: 3-4 hours  
**Owner**: Backend  
**Description**: 
- Privacy Policy promises "Right to Data Export" and "Right to Deletion"
- Must implement endpoints to fulfill these legal requirements

**Checklist**:
- [ ] Create `src/app/api/account/export/route.ts`:
  - Requires authentication
  - Returns JSON file with:
    - User profile (name, email, phone)
    - All bookings (dates, times, amounts, status)
    - Payment records (amounts, dates, methods)
    - Account creation date
  - Format: JSON with human-readable timestamps
  - Send as downloadable file
- [ ] Create `src/app/api/account/delete/route.ts`:
  - Requires authentication + email confirmation
  - Soft-delete user (mark `deletedAt`, don't hard-delete)
  - Anonymize PII: set name → "Deleted User", email → NULL, phone → NULL
  - Keep booking records for tax compliance (7-year requirement)
  - Log deletion for audit trail
- [ ] Test: export your own data, verify completeness
- [ ] Test: delete account, verify data is anonymized, bookings preserved
- [ ] Document in Privacy Policy: "Requests processed within 45 days"

---

### 12. Load Testing
**Status**: ❌ MISSING — Performance under load unknown  
**Effort**: 3-4 hours  
**Owner**: QA/Infra  
**Description**: 
- What happens when 100 people try to book simultaneously?
- Will database connection pool handle it? Will API response times degrade?

**Checklist**:
- [ ] Install load testing tool: `npm install -g k6` (or use Artillery)
- [ ] Create `tests/load/booking.js`:
  - Simulate 10 virtual users (ramp up over 30 sec)
  - Each user: 
    - GET `/winged-pheasant-golf-links` (browse page)
    - POST `/api/courses/winged-pheasant-golf-links/availability` (check times)
    - POST `/api/courses/winged-pheasant-golf-links/bookings` (create booking)
  - Run for 5 minutes
  - Collect metrics: response time, error rate, requests/sec
- [ ] Run test: `k6 run tests/load/booking.js`
- [ ] Performance targets:
  - API response time p95: <500ms
  - Error rate: <1%
  - Database connection pool usage: <80% of max
- [ ] If targets exceeded:
  - [ ] Identify slow queries (check Neon slow query log)
  - [ ] Add database indexes
  - [ ] Optimize N+1 queries (look for multiple queries in loops)
  - [ ] Re-run test to verify improvement
- [ ] Document results in README

---

### 13. Incident Runbooks
**Status**: ❌ MISSING — No documented procedures  
**Effort**: 2-3 hours  
**Owner**: DevOps/Ops  
**Description**: 
- Payment processing fails? Database won't connect? No playbook.
- Must document steps to diagnose and fix common issues.

**Checklist**:
- [ ] Create `RUNBOOKS.md` with procedures for:
  - **Stripe Webhook Failures**
    - Symptom: Sentry alert "Webhook handler error"
    - Steps: Check Stripe webhook logs in dashboard, verify DB connection, check error in Sentry
    - Recovery: Manually replay webhook from Stripe dashboard, or check if retry queue caught it
  - **Database Connection Errors**
    - Symptom: "too many connections" error in logs
    - Steps: Check Neon connection pool settings, check for long-running transactions
    - Recovery: Restart app, or scale connection pool
  - **Email Service Down**
    - Symptom: Emails not sending, retry queue building up
    - Steps: Check Resend status page, verify API key is correct
    - Recovery: Wait for service restore, retry queue will catch up automatically
  - **Payment Failures Spike**
    - Symptom: Alert fires for >10 failed payments in 5 min
    - Steps: Check Stripe status, verify webhook is receiving events, check for declined cards
    - Recovery: Communicate to affected golfers, offer manual re-booking
  - **High API Latency**
    - Symptom: Alert for API p95 >2 sec
    - Steps: Check Neon query logs for slow queries, check for high connection usage
    - Recovery: Kill long-running queries, scale database if persistent
- [ ] Each runbook should include:
  - [ ] How to diagnose the issue (logs to check, metrics to look at)
  - [ ] Immediate recovery action (what to do right now)
  - [ ] Root cause investigation (why did this happen?)
  - [ ] Prevention (how to avoid in future?)
  - [ ] Escalation path (who to page if not resolved in 15 min?)

---

### 14. Email Delivery Monitoring
**Status**: ⚠️ INCOMPLETE — No alerts if emails fail  
**Effort**: 2 hours  
**Owner**: Ops  
**Description**: 
- If email service is down, golfers don't get confirmation
- Need to detect this quickly

**Checklist**:
- [ ] Configure Resend alerts:
  - [ ] Webhook for delivery failures → send to internal Slack channel
  - [ ] Alert if bounce rate exceeds 2%
- [ ] Monitor email queue:
  - [ ] Create dashboard showing: pending emails, failed emails, success rate
  - [ ] Alert if >5 emails pending for >1 hour
- [ ] Test: send test email, verify delivery notification received

---

## 📋 SUMMARY TABLE

| Task | Effort | Difficulty | Phase | Owner |
|------|--------|------------|-------|-------|
| Rotate secrets | 1 hr | Easy | 1 | DevOps |
| npm audit fix | 1-2 hrs | Easy | 1 | Backend |
| Add core tests | 20 hrs | Medium | 1 | QA |
| Test DB backups | 2-3 hrs | Medium | 1 | DevOps |
| Set up CI/CD | 4-6 hrs | Medium | 1 | DevOps |
| Monitoring + alerts | 3-4 hrs | Medium | 1 | Ops |
| Health endpoint | 30 min | Easy | 1 | Backend |
| Deployment docs | 2-3 hrs | Easy | 1 | DevOps |
| Structured logging | 6-8 hrs | Medium | 2 | Backend |
| Email retry queue | 4-6 hrs | Medium | 2 | Backend |
| GDPR endpoints | 3-4 hrs | Easy | 2 | Backend |
| Load testing | 3-4 hrs | Medium | 2 | QA |
| Incident runbooks | 2-3 hrs | Easy | 2 | Ops |
| Email monitoring | 2 hrs | Easy | 2 | Ops |
| **TOTAL** | **60-70 hrs** | | | |

---

## 📅 PHASE BREAKDOWN

### Phase 1: This Week (Critical Path)
**Estimated**: 35-45 hours  
**Goal**: Safe to launch with monitoring

1. ✅ Rotate secrets (1 hr)
2. ✅ npm audit fix (1-2 hrs)
3. ✅ Core tests (20 hrs)
4. ✅ Test DB backups (2-3 hrs)
5. ✅ CI/CD pipeline (4-6 hrs)
6. ✅ Monitoring (3-4 hrs)
7. ✅ Health endpoint (30 min)
8. ✅ Deployment docs (2-3 hrs)

### Phase 2: Week 1 Post-Launch (Hardening)
**Estimated**: 25-30 hours  
**Goal**: Mature operations, compliance

9. Structured logging (6-8 hrs)
10. Email retry queue (4-6 hrs)
11. GDPR endpoints (3-4 hrs)
12. Load testing (3-4 hrs)
13. Incident runbooks (2-3 hrs)
14. Email monitoring (2 hrs)

---

## 🚀 GO/NO-GO LAUNCH DECISION

**Ship only if**:
- ✅ All Phase 1 tasks complete
- ✅ Tests passing
- ✅ Secrets rotated
- ✅ Database backup tested
- ✅ Monitoring + alerts configured
- ✅ Deployment procedure documented and tested once

**Do not ship if**:
- ❌ Secrets still in `.env` file
- ❌ No database backup tested
- ❌ No monitoring configured
- ❌ npm audit shows critical vulnerabilities unfixed

---

## 👥 OWNER ASSIGNMENTS

**Assign each task to a team member**:

| Owner | Tasks |
|-------|-------|
| **DevOps Lead** | Rotate secrets, Test DB backups, CI/CD, Deployment docs |
| **Backend Lead** | Health endpoint, Core tests, Email retry, GDPR endpoints, Structured logging |
| **QA Lead** | Full test suite (Phase 2), Load testing |
| **Ops Lead** | Monitoring setup, Incident runbooks, Email monitoring |

---

**Last Updated**: 2026-07-18  
**Status**: Ready for team distribution
