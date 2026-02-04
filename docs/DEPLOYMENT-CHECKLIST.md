# Production Deployment Checklist

Use this checklist before deploying agents to production.

---

## ✅ Pre-Deployment

### Policies

- [ ] **Policy file exists** for each production agent
- [ ] **Permissions are restrictive** (allow only what's needed)
- [ ] **Deny rules cover dangerous actions** (delete:*, update:payment_info, etc.)
- [ ] **Escalation rules defined** for sensitive operations
- [ ] **Audit retention meets compliance** (7 years for SOC2/HIPAA)
- [ ] **Policy tested** with realistic scenarios
- [ ] **Wildcard patterns verified** (test that delete:* blocks all deletes)

### Identity

- [ ] **Identities created** for all production agents
- [ ] **Identity storage secured** (encrypted filesystem or vault)
- [ ] **Key rotation schedule** defined (quarterly recommended)
- [ ] **Trust score thresholds** configured (min: 50, recovery: 80)
- [ ] **Auto-revocation tested** (what happens at trust score 0?)

### Audit

- [ ] **Audit path configured** with sufficient disk space
- [ ] **Log rotation** enabled (default: 100 MB)
- [ ] **Retention policy** set (default: 7 years)
- [ ] **Chain verification** scheduled (weekly recommended)
- [ ] **Backup strategy** for audit logs (immutable storage)
- [ ] **Sensitive fields redacted** (password, ssn, credit_card, etc.)

### Testing

- [ ] **Integration test passes** (`node test/integration-test.js`)
- [ ] **Allowed actions tested** (verify they execute)
- [ ] **Denied actions tested** (verify they're blocked)
- [ ] **Escalations tested** (verify human loop works)
- [ ] **Trust score behavior tested** (success increments, failures decrement)
- [ ] **Performance tested** (measure overhead: should be <10ms)
- [ ] **Load tested** (can handle expected throughput)

---

## ✅ Infrastructure

### Storage

- [ ] **Audit logs** on persistent storage (not ephemeral containers)
- [ ] **Identity store** on encrypted storage
- [ ] **Backups** configured for both audit and identity stores
- [ ] **Disk space monitoring** (alert at 80% full)

### Monitoring

- [ ] **Trust score monitoring** (alert if drops below 70)
- [ ] **Escalation queue monitoring** (alert if >10 pending)
- [ ] **Policy denial rate monitoring** (alert if spike)
- [ ] **Audit chain verification** (alert on tampering)
- [ ] **Health check endpoint** exposed (`/health` → `agent.healthCheck()`)

### Alerting

- [ ] **On-call rotation** defined for escalations
- [ ] **Alert channels** configured (PagerDuty, Slack, email)
- [ ] **Escalation SLA** defined (e.g., 24h response time)
- [ ] **Incident response plan** documented

### Security

- [ ] **Audit logs** on immutable storage (append-only, no deletes)
- [ ] **Identity keys** encrypted at rest
- [ ] **Network policies** restrict agent access
- [ ] **Secrets management** (API keys, passwords) separate from audit logs
- [ ] **Access controls** on policy files (who can edit?)

---

## ✅ Operational Readiness

### Documentation

- [ ] **Runbook created** (how to operate this agent)
- [ ] **Policy documented** (what the agent can/can't do)
- [ ] **Escalation workflow** documented (who reviews, how to approve)
- [ ] **Incident response** documented (what to do if trust score drops)
- [ ] **Recovery procedures** documented (how to restore from failure)

### Team Readiness

- [ ] **Team trained** on escalation resolution
- [ ] **On-call schedule** published
- [ ] **Escalation review process** defined
- [ ] **Weekly report recipients** identified
- [ ] **Emergency contacts** documented

### Compliance

- [ ] **SOC2 requirements** mapped to toolkit features
- [ ] **GDPR requirements** verified (data minimization, right to erasure)
- [ ] **HIPAA requirements** verified (if handling PHI)
- [ ] **Industry-specific** compliance verified
- [ ] **Audit report format** approved by compliance team

---

## ✅ Launch

### Deployment

- [ ] **Staged rollout** planned (10% → 50% → 100%)
- [ ] **Rollback plan** defined
- [ ] **Feature flags** configured (can disable agent remotely)
- [ ] **Blue-green deployment** ready (zero-downtime)

### Day 1

- [ ] **Monitor trust scores** hourly for first 24h
- [ ] **Review all escalations** within 1 hour
- [ ] **Check audit logs** for anomalies
- [ ] **Verify chain integrity** after first 1000 actions
- [ ] **Performance metrics** (latency, throughput) tracked

### Week 1

- [ ] **Daily reports** generated and reviewed
- [ ] **Escalation response time** measured
- [ ] **Trust score trends** analyzed
- [ ] **Policy adjustments** identified (too restrictive? too permissive?)
- [ ] **User feedback** collected

---

## ✅ Post-Deployment

### Regular Operations

- [ ] **Weekly compliance reports** generated
- [ ] **Quarterly policy reviews** scheduled
- [ ] **Quarterly key rotation** performed
- [ ] **Monthly audit chain verification**
- [ ] **Annual SOC2 audit** preparation

### Continuous Improvement

- [ ] **Escalation patterns** analyzed (which actions escalate most?)
- [ ] **Policy optimization** (can we grant more permissions safely?)
- [ ] **Trust score tuning** (are thresholds appropriate?)
- [ ] **Performance optimization** (is overhead acceptable?)
- [ ] **Team retrospectives** (what's working, what's not?)

---

## 🚨 Red Flags - Do NOT Deploy If:

- ❌ No policy file exists
- ❌ Policy allows `*` (all actions) without restrictions
- ❌ No deny rules defined
- ❌ Audit logs on ephemeral storage
- ❌ Identity keys unencrypted
- ❌ No monitoring configured
- ❌ No escalation workflow defined
- ❌ Team not trained
- ❌ Integration tests failing
- ❌ No rollback plan

---

## 📊 Success Metrics

Track these KPIs post-deployment:

### Week 1
- **Uptime**: >99.9%
- **Trust score**: Stable >90
- **Escalation response time**: <2 hours
- **Policy denials**: <5% of actions
- **Performance overhead**: <10ms

### Month 1
- **Zero critical incidents**
- **Escalation resolution rate**: >95%
- **Audit chain integrity**: 100% verified
- **Team satisfaction**: >4/5
- **Compliance audit**: Pass

### Quarter 1
- **Cost savings** measured (vs manual process)
- **Quality improvement** measured (accuracy, speed)
- **Regulatory compliance** maintained
- **Production deployment count**: >3 additional agents
- **Executive review**: Approved for expansion

---

## Sample Timeline

### Day -7: Pre-Production Staging
- Deploy to staging environment
- Run integration tests
- Simulate escalations
- Load test at 2x expected traffic
- Security review

### Day -3: Final Preparations
- Freeze policy changes
- Final runbook review
- Team training session
- Alert channel tests
- Backup verification

### Day 0: Launch
- Deploy to 10% of traffic
- Monitor for 4 hours
- If healthy, scale to 50%
- Monitor for 4 hours
- If healthy, scale to 100%

### Day 1: Post-Launch
- Review first 24h metrics
- Clear escalation queue
- Team retrospective
- Update documentation
- Plan for week 1

---

## Support Contacts

- **Technical Issues**: support@openclaw.com
- **Security Concerns**: security@openclaw.com
- **Compliance Questions**: compliance@openclaw.com
- **Community**: https://discord.gg/openclaw

---

**Remember:** Production is a journey, not a destination. Start restrictive, monitor closely, adjust incrementally.

Good luck! 🚀
