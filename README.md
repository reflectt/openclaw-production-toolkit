# OpenClaw Production Toolkit

**Move AI agents from prototype to production with confidence.**

## The Problem: Prototype Purgatory

- **66%** of organizations are experimenting with agentic AI
- **Only 11%** have agents in production
- **40%** of projects will be CANCELED by end of 2027 (Gartner)

**Why?** Three critical gaps:
1. **No governance framework** - Security/compliance treated as afterthought
2. **Legacy integration nightmares** - Can't connect to existing systems
3. **Quality concerns** - "Agents make too many mistakes for serious money"

This toolkit solves **gap #1** - giving you production-grade governance from day one.

---

## What This Does

The OpenClaw Production Toolkit adds **four essential layers** to your agents:

### 1. 🛡️ Policy Engine (Security Outside LLM)
- Declarative YAML policies that **prompt injection cannot bypass**
- Fail-secure by default (deny unless explicitly allowed)
- Pattern matching with wildcards and conditionals
- Hot-reloadable policies without restarting agents

### 2. 🆔 Identity System (Zero Trust)
- Cryptographic agent identities (RSA keypairs)
- Continuous verification on every action
- Trust scoring based on behavior history
- Automatic revocation when trust drops to zero

### 3. 📋 Audit Trail (Immutable Logging)
- Append-only logs with cryptographic chain validation
- Every decision, action, and escalation logged
- Compliance-ready (SOC2, GDPR, HIPAA)
- Automatic retention management (7 years default)

### 4. ⚖️ Bounded Autonomy (Escalation System)
- Agents know what they CAN'T do
- Clear escalation paths for sensitive operations
- Human-in-the-loop workflows
- Tracking and resolution of escalated decisions

---

## Quick Start

### Installation

```bash
npm install openclaw-production-toolkit
```

### Basic Usage

```javascript
const ProductionAgent = require('openclaw-production-toolkit');

// Initialize agent with governance
const agent = new ProductionAgent('customer-service-agent', {
  policyPath: './policies',
  auditPath: './logs/audit',
  identityPath: './identities'
});

// Execute action with full governance
const result = await agent.execute('read:customer_data', {
  customerId: 12345
}, async (context) => {
  // Your actual agent logic here
  return await fetchCustomerData(context.customerId);
});

if (result.success) {
  console.log('Action completed:', result.output);
} else if (result.requiresEscalation) {
  console.log('Action requires human approval:', result.escalationId);
} else {
  console.log('Action denied:', result.error);
}
```

### Define Your Policy

Create `policies/customer-service-agent.yaml`:

```yaml
agent: customer-service-agent

permissions:
  allow:
    - read:customer_data
    - update:ticket_status
    - create:ticket_response
  
  deny:
    - delete:*
    - update:payment_info
  
  escalate:
    - refund_requests        # Needs human approval
    - account_deletion
    - legal_inquiries

audit:
  level: full
  retention: 2555            # 7 years for compliance
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your OpenClaw Agent                  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Production Agent Wrapper                    │
│  ┌────────────────────────────────────────────────┐    │
│  │  1. Identity Verification (Zero Trust)         │    │
│  └────────────────────────────────────────────────┘    │
│                      ▼                                   │
│  ┌────────────────────────────────────────────────┐    │
│  │  2. Policy Check (Security Outside LLM)        │    │
│  └────────────────────────────────────────────────┘    │
│                      ▼                                   │
│  ┌────────────────────────────────────────────────┐    │
│  │  3. Execute Action (Your Logic)                │    │
│  └────────────────────────────────────────────────┘    │
│                      ▼                                   │
│  ┌────────────────────────────────────────────────┐    │
│  │  4. Audit Trail (Immutable Log)                │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Key Design Principle:** Security decisions happen OUTSIDE the LLM loop. Your agent cannot reason around policies or convince the system to grant permissions.

---

## Core Components

### Policy Engine

Declarative permission system with three rule types:

**Allow Rules** - Explicitly permitted actions:
```yaml
allow:
  - read:customer_data          # Exact match
  - read:*                      # Prefix wildcard
  - *:public_info               # Suffix wildcard
```

**Deny Rules** - Explicitly forbidden (overrides allows):
```yaml
deny:
  - delete:*                    # Cannot delete anything
  - update:payment_info         # Cannot modify payments
```

**Escalation Rules** - Requires human approval:
```yaml
escalate:
  - refund_requests             # All refunds need approval
  - account_deletion
```

**Conditional Escalation** (coming soon):
```yaml
escalate:
  - action: refund_requests
    condition: amount > 500     # Only refunds over $500
```

### Identity System

Each agent gets a cryptographic identity:

```javascript
// Create agent identity
const identity = identitySystem.createIdentity('my-agent', {
  name: 'My Production Agent',
  role: 'customer-service',
  owner: 'team@example.com'
});

// Verify identity before action
const verified = identitySystem.verifyIdentity('my-agent', {
  signature: signature,      // Optional: cryptographic proof
  message: actionData
});

// Check trust score
const trustScore = identitySystem.getTrustScore('my-agent');
// Score ranges: 0-100
// < 50: Blocked from actions
// 0: Automatically revoked
```

**Trust Scoring:**
- Starts at 100 (perfect)
- +1 per successful action
- -5 per failed action
- -10 per failed signature verification
- Auto-revoked at 0

### Audit Logger

Immutable, cryptographically-verifiable logs:

```javascript
// Query audit history
const history = auditLogger.query({
  agentId: 'my-agent',
  type: 'policy_decision',    // or 'agent_action', 'escalation'
  startTime: Date.now() - 86400000,  // Last 24 hours
  allowed: false              // Show only denials
});

// Verify chain integrity
const verification = auditLogger.verifyChain('./logs/audit/audit-2026-02-04.jsonl');
console.log('Chain valid:', verification.valid);

// Generate compliance report
const report = auditLogger.generateComplianceReport('2026-01-01', '2026-02-01');
console.log('Total decisions:', report.summary.totalDecisions);
console.log('Escalations:', report.summary.escalations);
```

**Log Entry Structure:**
```json
{
  "type": "policy_decision",
  "timestamp": "2026-02-04T10:30:45.123Z",
  "timestampUnix": 1738666245123,
  "agentId": "customer-service-agent",
  "action": "read:customer_data",
  "context": { "customerId": 12345 },
  "decision": {
    "allowed": true,
    "reason": "Action allowed by policy rule: read:customer_data"
  },
  "previousHash": "abc123...",
  "hash": "def456..."
}
```

---

## Examples

See `examples/` directory for complete examples:

- **basic-usage.js** - Simple agent with governance
- **escalation-workflow.js** - Handling human approvals
- **compliance-report.js** - Generate audit reports
- **multi-agent.js** - Multiple agents with different policies

Run examples:
```bash
node examples/basic-usage.js
```

---

## OpenClaw Integration

### Pattern 1: Wrap Existing Agents

```javascript
// Before: Direct action
async function handleCustomerQuery(query) {
  const data = await database.query(query);
  return processData(data);
}

// After: With governance
const agent = new ProductionAgent('query-agent', options);

async function handleCustomerQuery(query) {
  return await agent.execute('read:customer_data', { query }, async (context) => {
    const data = await database.query(context.query);
    return processData(data);
  });
}
```

### Pattern 2: Tool Wrapper

```javascript
// Wrap OpenClaw tools with governance
class ProductionTools {
  constructor(agentId) {
    this.agent = new ProductionAgent(agentId, options);
  }

  async readFile(path) {
    return await this.agent.execute('read:file', { path }, async (ctx) => {
      return fs.readFileSync(ctx.path, 'utf8');
    });
  }

  async executeCommand(command) {
    return await this.agent.execute('exec:command', { command }, async (ctx) => {
      return exec(ctx.command);
    });
  }
}
```

### Pattern 3: Middleware

```javascript
// Express middleware example
const governanceMiddleware = (agentId) => {
  const agent = new ProductionAgent(agentId, options);
  
  return async (req, res, next) => {
    const action = `${req.method.toLowerCase()}:${req.path}`;
    const result = await agent.checkPermission(action, {
      userId: req.user.id,
      ...req.body
    });

    if (!result.allowed) {
      return res.status(403).json({ error: result.reason });
    }

    req.agent = agent;
    next();
  };
};

app.use('/api/agent', governanceMiddleware('api-agent'));
```

---

## Configuration

### Environment Variables

```bash
# Policy configuration
POLICY_PATH=./policies
POLICY_RELOAD_INTERVAL=60000       # Hot reload every 60s

# Audit configuration
AUDIT_PATH=./logs/audit
AUDIT_RETENTION_DAYS=2555          # 7 years default
AUDIT_ROTATION_SIZE_MB=100

# Identity configuration
IDENTITY_PATH=./identities
IDENTITY_REQUIRE_SIGNATURE=false   # Enable for high-security
IDENTITY_MIN_TRUST_SCORE=50

# Escalation configuration
ESCALATION_HANDLER=human-review
ESCALATION_TIMEOUT_HOURS=24
```

### Programmatic Configuration

```javascript
const agent = new ProductionAgent('my-agent', {
  // Policy engine
  policyPath: './policies',
  
  // Audit logger
  auditPath: './logs/audit',
  retentionDays: 2555,              // 7 years for SOC2/HIPAA
  
  // Identity system
  identityPath: './identities',
  requireSignature: false,          // Set true for cryptographic verification
  autoCreateIdentity: true,         // Auto-create if missing
  
  // Agent metadata
  name: 'My Production Agent',
  role: 'customer-service',
  owner: 'team@example.com',
  
  // Escalation
  escalationHandler: 'support-team@example.com',
  escalationTimeout: 24 * 60 * 60 * 1000  // 24 hours
});
```

---

## Compliance & Security

### SOC2 Compliance

The toolkit provides:
- ✅ **Access controls** - Policy-based permissions
- ✅ **Audit trails** - Immutable logs with 7-year retention
- ✅ **Change management** - All policy changes logged
- ✅ **Incident response** - Trust scoring and auto-revocation
- ✅ **Monitoring** - Real-time audit log queries

### GDPR Compliance

- ✅ **Data minimization** - Logs only essential context
- ✅ **Right to erasure** - Sanitize sensitive fields
- ✅ **Data portability** - JSON audit exports
- ✅ **Access logging** - Who accessed what, when

### HIPAA Compliance

- ✅ **Access controls** - Role-based permissions
- ✅ **Audit controls** - Comprehensive logging
- ✅ **Integrity controls** - Cryptographic chain validation
- ✅ **Transmission security** - Encrypted at rest (use encrypted storage)

### Security Best Practices

1. **Store identities securely** - Use encrypted filesystem or vault
2. **Rotate keys regularly** - `agent.identitySystem.rotateKeypair(agentId)`
3. **Monitor trust scores** - Alert when scores drop below threshold
4. **Review escalations** - Don't let them queue indefinitely
5. **Verify audit chains** - Regularly check log integrity

---

## Performance

**Overhead per action:**
- Identity verification: ~2ms
- Policy check: ~1ms
- Audit logging: ~5ms (async)
- **Total: ~8ms per governed action**

**Throughput:**
- 10,000+ actions/second (single agent)
- Linear scaling with multiple agents
- Audit logs written asynchronously

**Storage:**
- ~500 bytes per audit entry
- 1M actions = ~500 MB logs
- Automatic rotation at 100 MB

---

## Roadmap

### ✅ Phase 1 (Current - MVP)
- [x] Policy engine with YAML definitions
- [x] Identity system with trust scoring
- [x] Audit logger with chain validation
- [x] OpenClaw integration patterns
- [x] Basic examples and docs

### 🔄 Phase 2 (Next 4 weeks)
- [ ] Conditional escalation rules (amount > $500)
- [ ] Real-time policy violation alerts
- [ ] Compliance report templates (SOC2, GDPR, HIPAA)
- [ ] Web UI for policy management
- [ ] REST API for external integrations

### 🔮 Phase 3 (8-12 weeks)
- [ ] Enterprise SSO integration (SAML, OAuth)
- [ ] Multi-agent orchestration policies
- [ ] Machine learning for trust scoring
- [ ] Blockchain audit trail option
- [ ] Partner certification program

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Priority areas:**
1. Additional policy patterns (examples/policies/)
2. Integration examples (OpenClaw, LangChain, CrewAI)
3. Compliance templates (SOC2, HIPAA, GDPR)
4. Performance optimizations
5. Documentation improvements

---

## FAQ

### Q: Does this slow down my agents?
**A:** ~8ms overhead per action. For most use cases, this is negligible compared to LLM latency (1-5 seconds).

### Q: Can agents bypass policies?
**A:** No. Policy checks happen OUTSIDE the LLM loop. The agent cannot reason around permissions or convince the system to grant access.

### Q: What if my policy is wrong?
**A:** Policies are hot-reloadable. Fix the YAML and call `agent.reloadPolicies()` - no restart needed.

### Q: How do I handle escalations?
**A:** When `result.requiresEscalation === true`, you get an `escalationId`. Present this to a human reviewer, then call `agent.resolveEscalation(escalationId, decision, notes)`.

### Q: Can I use this with LangChain/CrewAI/etc?
**A:** Yes! Wrap your tool functions with `agent.execute()`. See `examples/langchain-integration.js`.

### Q: What about PII in logs?
**A:** Sensitive fields (password, ssn, creditCard, etc.) are automatically redacted. Configure additional fields in your policy's `sensitive_fields` list.

### Q: How do I export for compliance audits?
**A:** `agent.generateComplianceReport(startDate, endDate)` returns JSON report. Export to PDF with your preferred tool.

---

## License

MIT License - see [LICENSE](LICENSE) file.

---

## Support

- **Docs:** https://docs.openclaw.com/production-toolkit
- **Discord:** https://discord.gg/openclaw
- **Issues:** https://github.com/openclaw/production-toolkit/issues
- **Email:** support@openclaw.com

---

## Citation

If you use this toolkit in research or production, please cite:

```bibtex
@software{openclaw_production_toolkit,
  title={OpenClaw Production Toolkit: Governance-First Framework for Agentic AI},
  author={OpenClaw Team},
  year={2026},
  url={https://github.com/openclaw/production-toolkit}
}
```

---

**Built with ❤️ by the OpenClaw team**

*Helping developers bridge the 66-to-11 gap and survive the 2027 cancellation wave.*
