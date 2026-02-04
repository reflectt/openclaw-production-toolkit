# Quick Start Guide

Get your first production-ready agent running in **5 minutes**.

---

## Step 1: Install (30 seconds)

```bash
cd projects/production-toolkit
npm install
```

---

## Step 2: Create Policy (2 minutes)

Create `policies/my-first-agent.yaml`:

```yaml
agent: my-first-agent

permissions:
  allow:
    - read:*                # Can read anything
    - write:logs            # Can write logs
  
  deny:
    - delete:*              # Cannot delete
  
  escalate:
    - write:production      # Production writes need approval

audit:
  level: full
  retention: 365
```

---

## Step 3: Run Example (1 minute)

```javascript
// my-agent.js
const ProductionAgent = require('./src/production-agent');

async function main() {
  // Initialize agent
  const agent = new ProductionAgent('my-first-agent', {
    policyPath: './policies',
    auditPath: './logs/audit',
    identityPath: './identities'
  });

  // Execute an action
  const result = await agent.execute('read:customer_data', {
    customerId: 123
  }, async (context) => {
    return { name: 'John Doe', email: 'john@example.com' };
  });

  console.log('Result:', result);
}

main();
```

Run it:
```bash
node my-agent.js
```

**Output:**
```
✓ Loaded policy for agent: my-first-agent
✓ Created identity for agent: my-first-agent
✓ Production agent initialized: my-first-agent
Result: {
  success: true,
  output: { name: 'John Doe', email: 'john@example.com' },
  executionTime: 3,
  agentId: 'my-first-agent',
  trustScore: 101
}
```

---

## Step 4: Test Governance (1 minute)

Try a denied action:

```javascript
const result = await agent.execute('delete:customer_data', {
  customerId: 123
});

console.log(result);
// { success: false, error: 'Action explicitly denied...', policyDenied: true }
```

Try an escalation:

```javascript
const result = await agent.execute('write:production', {
  file: 'important.txt'
});

console.log(result);
// { success: false, requiresEscalation: true, escalationId: 123456... }
```

---

## Step 5: Check Audit Logs (30 seconds)

```javascript
const history = agent.getAuditHistory();
console.log(`Logged ${history.length} actions`);

history.forEach(entry => {
  console.log(`${entry.timestamp}: ${entry.action} [${entry.decision?.allowed ? 'ALLOWED' : 'DENIED'}]`);
});
```

---

## What Just Happened?

✅ **Identity Created** - Agent got cryptographic identity (RSA keypair)  
✅ **Policy Loaded** - YAML policy enforced outside LLM control  
✅ **Actions Governed** - Every action checked against policy  
✅ **Audit Logged** - Immutable log with cryptographic chain  
✅ **Trust Scored** - Agent behavior tracked (starts at 100)

---

## Next Steps

### Learn More
- **Full README**: `README.md` - Complete documentation
- **OpenClaw Integration**: `docs/OPENCLAW-INTEGRATION.md` - Wrap OpenClaw tools
- **Examples**: `examples/` - More complex patterns

### Deploy to Production
- **Deployment Checklist**: `docs/DEPLOYMENT-CHECKLIST.md` - Pre-flight checks
- **Monitoring**: Set up trust score alerts
- **Escalations**: Configure human-in-the-loop workflow

### Customize
- **Add more policies**: `policies/` - One file per agent
- **Adjust trust scoring**: Tune increment/decrement values
- **Add conditions**: Escalate only if amount > $500

---

## Common Questions

**Q: Does this slow down my agent?**  
A: ~8ms overhead per action (negligible vs LLM latency)

**Q: Can the agent bypass policies?**  
A: No. Policy checks happen outside LLM control.

**Q: What if I update my policy?**  
A: Call `agent.reloadPolicies()` - no restart needed

**Q: How do I handle escalations?**  
A: Implement a human review workflow, then call `agent.resolveEscalation(id, decision, notes)`

---

**Ready for production?** → `docs/DEPLOYMENT-CHECKLIST.md`
