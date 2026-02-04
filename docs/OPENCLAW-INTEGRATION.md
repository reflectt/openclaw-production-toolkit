# OpenClaw Integration Guide

This guide shows how to integrate the Production Toolkit with OpenClaw agents.

---

## Quick Start for OpenClaw Users

### 1. Install the Toolkit

```bash
cd ~/.openclaw/workspace/projects/production-toolkit
npm install
```

### 2. Create Your Agent Policy

Create `policies/my-agent.yaml`:

```yaml
agent: my-openclaw-agent

permissions:
  allow:
    - read:*                    # Can read anything
    - write:workspace           # Can write to workspace
    - exec:safe_commands        # Can execute safe commands
  
  deny:
    - exec:rm                   # Cannot delete files
    - write:system              # Cannot modify system
    - read:secrets              # No access to secrets
  
  escalate:
    - exec:sudo                 # Root commands need approval
    - write:production          # Production writes need review
    - send:email                # Emails need human approval

audit:
  level: full
  retention: 365                # 1 year retention
```

### 3. Wrap Your OpenClaw Tools

```javascript
const ProductionAgent = require('./production-toolkit/src/production-agent');
const path = require('path');

class ProductionOpenClawAgent {
  constructor(agentId) {
    this.agent = new ProductionAgent(agentId, {
      policyPath: path.join(process.cwd(), 'policies'),
      auditPath: path.join(process.cwd(), 'logs/audit'),
      identityPath: path.join(process.cwd(), 'identities')
    });
  }

  // Wrap the Read tool
  async readFile(filePath) {
    return await this.agent.execute('read:file', { filePath }, async (ctx) => {
      const fs = require('fs');
      return fs.readFileSync(ctx.filePath, 'utf8');
    });
  }

  // Wrap the Write tool
  async writeFile(filePath, content) {
    return await this.agent.execute('write:file', { filePath, content }, async (ctx) => {
      const fs = require('fs');
      fs.writeFileSync(ctx.filePath, ctx.content);
      return { success: true, bytes: ctx.content.length };
    });
  }

  // Wrap the Exec tool
  async executeCommand(command) {
    return await this.agent.execute('exec:command', { command }, async (ctx) => {
      const { execSync } = require('child_process');
      const output = execSync(ctx.command, { encoding: 'utf8' });
      return { output, success: true };
    });
  }

  // Wrap the Message tool
  async sendMessage(channel, message) {
    return await this.agent.execute('send:message', { channel, message }, async (ctx) => {
      // Your message sending logic
      console.log(`Sending to ${ctx.channel}: ${ctx.message}`);
      return { success: true, messageId: Date.now() };
    });
  }
}

// Usage
const agent = new ProductionOpenClawAgent('my-openclaw-agent');

// This will check policy before executing
const result = await agent.readFile('./data/customer-info.txt');

if (result.success) {
  console.log('File read:', result.output);
} else if (result.requiresEscalation) {
  console.log('Action needs human approval:', result.escalationId);
} else {
  console.log('Action denied:', result.error);
}
```

---

## Integration Patterns

### Pattern 1: Tool Middleware

Intercept all tool calls with governance:

```javascript
const originalTools = {
  read: readFileTool,
  write: writeFileTool,
  exec: execTool,
  message: messageTool
};

const governedTools = Object.keys(originalTools).reduce((acc, toolName) => {
  acc[toolName] = async (params) => {
    const action = `${toolName}:${params.resource || 'default'}`;
    
    return await agent.execute(action, params, async (ctx) => {
      return await originalTools[toolName](ctx);
    });
  };
  
  return acc;
}, {});

// Now use governedTools instead of originalTools
```

### Pattern 2: Session Wrapper

Wrap an entire OpenClaw session:

```javascript
class ProductionSession {
  constructor(sessionId, agentId) {
    this.sessionId = sessionId;
    this.agent = new ProductionAgent(agentId, options);
    this.history = [];
  }

  async executeAction(action, params) {
    // Add session context
    const context = {
      ...params,
      sessionId: this.sessionId,
      timestamp: Date.now()
    };

    const result = await this.agent.execute(action, context);
    
    // Track in session history
    this.history.push({
      action,
      params,
      result,
      timestamp: Date.now()
    });

    return result;
  }

  getSessionReport() {
    return {
      sessionId: this.sessionId,
      agentId: this.agent.agentId,
      actions: this.history.length,
      trustScore: this.agent.getTrustScore(),
      history: this.history
    };
  }
}
```

### Pattern 3: AGENTS.md Integration

Add to your `AGENTS.md`:

```markdown
## Production Deployment

When deploying agents to production, use the Production Toolkit:

1. Define policy in `policies/YOUR-AGENT.yaml`
2. Wrap tools with governance: `agent.execute(action, context, executor)`
3. Monitor trust scores and audit logs
4. Review escalations regularly

See `projects/production-toolkit/docs/OPENCLAW-INTEGRATION.md` for details.
```

---

## Real-World Example: Production Customer Service Bot

```javascript
const ProductionAgent = require('./production-toolkit/src/production-agent');
const path = require('path');

class CustomerServiceBot {
  constructor() {
    this.agent = new ProductionAgent('customer-service-bot', {
      policyPath: path.join(__dirname, '../policies'),
      auditPath: path.join(__dirname, '../logs/audit'),
      identityPath: path.join(__dirname, '../identities'),
      name: 'Production Customer Service Bot',
      role: 'customer-support',
      owner: 'support-team@company.com'
    });

    // Check health on startup
    const health = this.agent.healthCheck();
    if (!health.healthy) {
      throw new Error('Agent failed health check');
    }

    console.log(`✓ Customer Service Bot ready (Trust: ${health.trustScore})`);
  }

  async handleCustomerQuery(customerId, query) {
    // 1. Read customer data (governed)
    const customerData = await this.agent.execute(
      'read:customer_data',
      { customerId },
      async (ctx) => {
        return await this.database.getCustomer(ctx.customerId);
      }
    );

    if (!customerData.success) {
      return { error: 'Cannot access customer data', reason: customerData.error };
    }

    // 2. Process query with LLM
    const response = await this.processWithLLM(query, customerData.output);

    // 3. If response includes actions, check permissions
    if (response.action === 'issue_refund') {
      const refund = await this.agent.execute(
        'refund_requests',
        {
          customerId,
          amount: response.refundAmount,
          reason: response.reason
        }
      );

      if (refund.requiresEscalation) {
        return {
          success: false,
          message: 'Refund request escalated to manager',
          escalationId: refund.escalationId,
          estimatedResolution: '24 hours'
        };
      }
    }

    // 4. Log the ticket update
    await this.agent.execute(
      'update:ticket_status',
      {
        customerId,
        status: 'resolved',
        resolution: response.message
      },
      async (ctx) => {
        return await this.database.updateTicket(ctx);
      }
    );

    return {
      success: true,
      message: response.message,
      trustScore: this.agent.getTrustScore()
    };
  }

  async processWithLLM(query, context) {
    // Your LLM logic here
    return {
      message: 'Your refund has been processed',
      action: 'issue_refund',
      refundAmount: 99.99,
      reason: 'Product defect reported'
    };
  }

  // Get daily report for monitoring
  async getDailyReport() {
    const today = new Date().toISOString().split('T')[0];
    const report = this.agent.generateComplianceReport(today, today);

    return {
      date: today,
      agent: this.agent.agentId,
      trustScore: this.agent.getTrustScore(),
      totalActions: report.summary.totalDecisions,
      escalations: report.summary.escalations,
      denials: report.summary.denied,
      health: this.agent.healthCheck()
    };
  }
}

// Deploy to production
const bot = new CustomerServiceBot();

// Handle incoming queries
app.post('/api/support/query', async (req, res) => {
  const { customerId, query } = req.body;
  const result = await bot.handleCustomerQuery(customerId, query);
  res.json(result);
});

// Monitoring endpoint
app.get('/api/support/health', async (req, res) => {
  const report = await bot.getDailyReport();
  res.json(report);
});

// Start server
app.listen(3000, () => {
  console.log('Production Customer Service Bot running on port 3000');
});
```

---

## Monitoring & Operations

### Daily Health Checks

Add to your heartbeat checks in `HEARTBEAT.md`:

```markdown
## Production Agents

Check agent health every 6 hours:

- Trust scores above 70
- No escalations pending > 24h
- Audit logs verified
- No policy violations
```

### Alerting

Set up alerts for:

```javascript
// Trust score dropping
if (agent.getTrustScore() < 70) {
  alert('Agent trust score below threshold');
}

// Escalations piling up
const pendingEscalations = auditLogger.query({
  type: 'escalation',
  status: 'pending'
});

if (pendingEscalations.length > 10) {
  alert('Too many pending escalations');
}

// Policy violations
const deniedActions = auditLogger.query({
  agentId: 'my-agent',
  allowed: false,
  startTime: Date.now() - 3600000  // Last hour
});

if (deniedActions.length > 100) {
  alert('High rate of policy denials - check agent behavior');
}
```

### Weekly Reports

Generate weekly compliance reports:

```javascript
// Monday morning report
const startDate = getLastMonday();
const endDate = getLastSunday();

const report = agent.generateComplianceReport(startDate, endDate);

sendToSlack('#production-reports', {
  title: `Production Agent Report: ${startDate} - ${endDate}`,
  fields: {
    'Total Decisions': report.summary.totalDecisions,
    'Allowed': report.summary.allowed,
    'Denied': report.summary.denied,
    'Escalations': report.summary.escalations,
    'Trust Score': agent.getTrustScore()
  }
});
```

---

## Best Practices

### 1. Start Restrictive, Loosen Gradually

```yaml
# Day 1: Very restrictive
permissions:
  allow:
    - read:customer_data
  escalate:
    - update:*
    - delete:*
    - refund:*

# After 1 week of monitoring:
permissions:
  allow:
    - read:customer_data
    - update:ticket_status
  escalate:
    - update:customer_data
    - delete:*
    - refund:*
```

### 2. Monitor Trust Scores

```javascript
// Daily trust score tracking
setInterval(() => {
  const trustScore = agent.getTrustScore();
  logMetric('agent.trust_score', trustScore);
  
  if (trustScore < 80) {
    console.warn(`Trust score declining: ${trustScore}`);
  }
}, 60 * 60 * 1000); // Every hour
```

### 3. Review Escalations Promptly

```javascript
// Check escalations every hour
async function reviewEscalations() {
  const pending = auditLogger.query({
    type: 'escalation',
    // Add status tracking in your implementation
  });

  for (const escalation of pending) {
    const age = Date.now() - escalation.timestampUnix;
    
    if (age > 24 * 60 * 60 * 1000) {  // 24 hours
      notifyManager(`Escalation ${escalation.action} pending for >24h`);
    }
  }
}
```

### 4. Audit Log Verification

```javascript
// Weekly audit chain verification
const auditFiles = fs.readdirSync(auditPath)
  .filter(f => f.endsWith('.jsonl'));

for (const file of auditFiles) {
  const verification = auditLogger.verifyChain(path.join(auditPath, file));
  
  if (!verification.valid) {
    alert(`Audit chain compromised: ${file} - ${verification.error}`);
  }
}
```

---

## Troubleshooting

### "No policy found for agent"

Create a policy file at `policies/YOUR-AGENT-ID.yaml` with the agent name matching exactly.

### "Identity verification failed"

Check that identity files exist in `identities/` directory. If missing, enable `autoCreateIdentity: true`.

### "Trust score too low"

The agent has performed too many failed actions. Review recent audit history:

```javascript
const recentFailures = agent.getAuditHistory({
  type: 'agent_action',
  result: { success: false }
});

console.log('Recent failures:', recentFailures);
```

### "Action requires escalation"

This is expected behavior for sensitive actions. Implement an escalation review workflow or adjust policy if appropriate.

---

## Next Steps

1. **Define policies** for all your production agents
2. **Wrap tools** with governance layer
3. **Set up monitoring** for trust scores and escalations
4. **Create dashboards** for compliance reporting
5. **Document workflows** for escalation handling

---

**Questions?** Open an issue or join our Discord: https://discord.gg/openclaw
