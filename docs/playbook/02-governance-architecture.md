# Governance-First Architecture
## Building Trust Through Policy, Audit, and Bounded Autonomy

**Reading Time:** 60 minutes  
**Complexity:** Advanced  
**Prerequisites:** Understanding of policy enforcement, compliance requirements

---

## Table of Contents

1. [Introduction: Why Governance First?](#introduction-why-governance-first)
2. [Policy Engine Implementation](#policy-engine-implementation)
3. [Immutable Audit Trail](#immutable-audit-trail)
4. [Bounded Autonomy Patterns](#bounded-autonomy-patterns)
5. [Human Approval Gates](#human-approval-gates)
6. [Compliance & Regulatory Mapping](#compliance--regulatory-mapping)
7. [Real-World Examples](#real-world-examples)

---

## Introduction: Why Governance First?

### The Trust Problem

**Enterprise teams don't deploy agents because they can't answer:**
- "What if the agent does something wrong?"
- "How do we prove to auditors what the agent did?"
- "Can we limit what the agent is allowed to do?"
- "Who's responsible when things go wrong?"

### The Governance-First Approach

```
Traditional: Build Agent → Add Governance Later → Security Review Fails → Blocked
Our Way: Design Governance → Build Agent Within Bounds → Security Pre-Approved → Deploy
```

**Core Principle:** Governance is not a layer you add on top—it's the foundation you build on.

---

## Policy Engine Implementation

### Declarative Policy Language

Policies define what agents CAN and CANNOT do. Written in YAML for readability, enforced programmatically.

**Policy Structure:**

```yaml
# policies/customer-support-agent.yaml

name: customer_support_agent
version: 1.0.0
description: Policies for customer support AI agent

# Define who this policy applies to
applies_to:
  agents:
    - customer-support-bot
    - escalation-handler
  environments:
    - production
    - staging

# Data access policies
data_access:
  allowed_tables:
    - customers
    - tickets
    - knowledge_base
  
  forbidden_tables:
    - employees
    - financial_records
    - api_keys
  
  row_level_security:
    customers:
      # Only access customers assigned to this agent
      condition: "assigned_agent_id = {agent.id}"
    
    tickets:
      # Only tickets in allowed states
      condition: "status IN ('open', 'in_progress', 'pending_customer')"
  
  pii_handling:
    can_read:
      - customer_name
      - customer_email
    
    cannot_read:
      - ssn
      - credit_card
      - password_hash
    
    redaction_rules:
      - field: customer_phone
        redact_format: "XXX-XXX-{last4}"
      
      - field: customer_address
        redact_if: "agent.confidence < 0.95"

# Action policies
actions:
  allowed:
    - type: read_ticket
      constraints:
        max_per_minute: 100
    
    - type: create_ticket_response
      constraints:
        require_approval: false
        max_length_chars: 5000
        must_use_template: true
      
    - type: update_ticket_status
      constraints:
        allowed_transitions:
          open: [in_progress, pending_customer]
          in_progress: [pending_customer, resolved]
          pending_customer: [in_progress, resolved]
        
        forbidden_transitions:
          "*": [closed, deleted] # Only humans can close/delete
    
    - type: send_email
      constraints:
        require_approval: true # All emails need approval
        approval_timeout: 1h
        default_action: deny
        must_include_unsubscribe: true
    
    - type: issue_refund
      constraints:
        max_amount: 50.00 # Can refund up to $50
        require_approval:
          if: "amount > 50"
          approvers: ["manager@company.com"]
        
        rate_limit:
          max_per_hour: 5
          max_per_day: 20
  
  forbidden:
    - type: delete_customer
      reason: "Only humans can delete customer records"
    
    - type: modify_billing
      reason: "Billing changes require manual review"
    
    - type: exec
      reason: "No shell command execution"
    
    - type: send_http_request
      unless:
        - domain: "api.stripe.com" # Allowed for payments
        - domain: "api.sendgrid.com" # Allowed for emails
      reason: "Prevent data exfiltration"

# Time-based policies
temporal:
  business_hours:
    timezone: "America/New_York"
    allowed_hours:
      monday-friday: "09:00-17:00"
      saturday-sunday: null # No operations on weekends
  
  require_approval_outside_hours:
    enabled: true
    actions: ["send_email", "issue_refund"]
  
  auto_pause:
    on_us_holidays: true
    on_scheduled_maintenance: true

# Cost controls
cost_limits:
  max_per_action: 1.00 # Max $1 per action
  max_per_hour: 50.00
  max_per_day: 500.00
  max_per_month: 10000.00
  
  alert_thresholds:
    - threshold: 0.8 # 80% of limit
      notify: ["ops@company.com"]
    
    - threshold: 0.95 # 95% of limit
      notify: ["ops@company.com", "finance@company.com"]
      action: slow_down # Reduce rate
    
    - threshold: 1.0 # 100% of limit
      action: pause # Stop agent

# Escalation policies
escalation:
  # When to escalate to humans
  rules:
    - condition: "agent.confidence < 0.7"
      action: require_human_review
      message: "Agent confidence too low"
    
    - condition: "customer.is_vip = true"
      action: require_human_review
      message: "VIP customer - human touch required"
    
    - condition: "ticket.sentiment < -0.8"
      action: escalate_to_manager
      message: "Angry customer detected"
    
    - condition: "action.type = 'issue_refund' AND amount > 50"
      action: require_approval
      approvers: ["manager@company.com"]
    
    - condition: "error_rate_last_hour > 0.1"
      action: pause_agent
      message: "Error rate too high - pausing for investigation"

# Audit requirements
audit:
  log_level: detailed # minimal | standard | detailed
  
  capture:
    - agent_reasoning # Why agent made this decision
    - data_accessed # What data was read
    - actions_taken # What actions were executed
    - approvals_requested # What needed approval
    - policy_evaluations # Which policies were checked
  
  retention:
    duration: 7_years # Compliance requirement
    storage: immutable_s3
  
  export_formats:
    - json
    - csv
    - human_readable_pdf

# Incident response
incident_response:
  kill_switch:
    enabled: true
    authorized_users:
      - security@company.com
      - cto@company.com
  
  auto_pause_on:
    - policy_violation
    - repeated_errors
    - security_alert
    - cost_limit_exceeded
  
  notification_channels:
    critical: ["pagerduty", "slack:security"]
    high: ["slack:ops", "email:ops@company.com"]
    medium: ["email:ops@company.com"]
```

### Policy Enforcement Engine

**Architecture:**

```typescript
// governance-kit/policy-engine.ts

import { Policy } from './policy-schema';
import { AuditLog } from './audit-log';

export class PolicyEngine {
  private policies: Map<string, Policy> = new Map();
  private cache: PolicyCache;
  
  async loadPolicies(policiesPath: string) {
    const policyFiles = await fs.readdir(policiesPath);
    
    for (const file of policyFiles) {
      const policy = await this.parsePolicy(path.join(policiesPath, file));
      await this.validatePolicy(policy);
      this.policies.set(policy.name, policy);
    }
    
    console.log(`Loaded ${this.policies.size} policies`);
  }
  
  async evaluateAction(context: ActionContext): Promise<PolicyDecision> {
    const startTime = Date.now();
    
    // Get applicable policies
    const applicablePolicies = this.getApplicablePolicies(context);
    
    const evaluations: PolicyEvaluation[] = [];
    
    for (const policy of applicablePolicies) {
      const evaluation = await this.evaluatePolicy(policy, context);
      evaluations.push(evaluation);
      
      // Fail fast on explicit deny
      if (evaluation.decision === 'deny' && evaluation.explicit) {
        await this.logPolicyDecision(context, evaluations, 'denied', startTime);
        return {
          allowed: false,
          reason: evaluation.reason,
          violatedPolicies: [policy.name],
        };
      }
    }
    
    // Aggregate decisions (all must allow)
    const finalDecision = this.aggregateDecisions(evaluations);
    
    await this.logPolicyDecision(context, evaluations, finalDecision, startTime);
    
    return finalDecision;
  }
  
  private async evaluatePolicy(policy: Policy, context: ActionContext): Promise<PolicyEvaluation> {
    const checks: PolicyCheck[] = [];
    
    // Check 1: Is this action allowed at all?
    const actionAllowed = this.checkActionAllowed(policy, context);
    checks.push(actionAllowed);
    
    if (!actionAllowed.passed) {
      return {
        policy: policy.name,
        decision: 'deny',
        explicit: true,
        reason: actionAllowed.reason,
        checks: checks,
      };
    }
    
    // Check 2: Data access constraints
    if (context.dataAccess) {
      const dataCheck = this.checkDataAccess(policy, context);
      checks.push(dataCheck);
      
      if (!dataCheck.passed) {
        return {
          policy: policy.name,
          decision: 'deny',
          explicit: true,
          reason: dataCheck.reason,
          checks: checks,
        };
      }
    }
    
    // Check 3: Temporal constraints (business hours, etc.)
    const temporalCheck = this.checkTemporal(policy, context);
    checks.push(temporalCheck);
    
    if (!temporalCheck.passed) {
      // Might require approval instead of outright deny
      if (policy.temporal.require_approval_outside_hours) {
        return {
          policy: policy.name,
          decision: 'require_approval',
          reason: temporalCheck.reason,
          checks: checks,
        };
      } else {
        return {
          policy: policy.name,
          decision: 'deny',
          explicit: true,
          reason: temporalCheck.reason,
          checks: checks,
        };
      }
    }
    
    // Check 4: Cost limits
    const costCheck = this.checkCostLimits(policy, context);
    checks.push(costCheck);
    
    if (!costCheck.passed) {
      return {
        policy: policy.name,
        decision: 'deny',
        explicit: true,
        reason: costCheck.reason,
        checks: checks,
      };
    }
    
    // Check 5: Rate limits
    const rateLimitCheck = this.checkRateLimits(policy, context);
    checks.push(rateLimitCheck);
    
    if (!rateLimitCheck.passed) {
      return {
        policy: policy.name,
        decision: 'deny',
        explicit: false, // Temporary, will pass later
        reason: rateLimitCheck.reason,
        checks: checks,
        retryAfter: rateLimitCheck.retryAfter,
      };
    }
    
    // Check 6: Escalation conditions
    const escalationCheck = this.checkEscalation(policy, context);
    checks.push(escalationCheck);
    
    if (escalationCheck.requiresApproval) {
      return {
        policy: policy.name,
        decision: 'require_approval',
        reason: escalationCheck.reason,
        approvers: escalationCheck.approvers,
        checks: checks,
      };
    }
    
    // All checks passed
    return {
      policy: policy.name,
      decision: 'allow',
      checks: checks,
    };
  }
  
  private checkActionAllowed(policy: Policy, context: ActionContext): PolicyCheck {
    // Check forbidden list first
    const forbidden = policy.actions.forbidden.find(f => f.type === context.action.type);
    
    if (forbidden) {
      // Check if there's an exception
      if (forbidden.unless) {
        const exceptionMet = this.evaluateCondition(forbidden.unless, context);
        if (!exceptionMet) {
          return {
            name: 'action_forbidden',
            passed: false,
            reason: forbidden.reason,
          };
        }
      } else {
        return {
          name: 'action_forbidden',
          passed: false,
          reason: forbidden.reason,
        };
      }
    }
    
    // Check allowed list
    const allowed = policy.actions.allowed.find(a => a.type === context.action.type);
    
    if (!allowed) {
      return {
        name: 'action_not_in_allowlist',
        passed: false,
        reason: `Action '${context.action.type}' not in policy allowlist`,
      };
    }
    
    // Check constraints on allowed action
    if (allowed.constraints) {
      for (const [key, value] of Object.entries(allowed.constraints)) {
        if (key === 'require_approval' && value === true) {
          // Will be handled in escalation check
          continue;
        }
        
        const constraintMet = this.evaluateConstraint(key, value, context);
        if (!constraintMet.passed) {
          return {
            name: `constraint_${key}`,
            passed: false,
            reason: constraintMet.reason,
          };
        }
      }
    }
    
    return {
      name: 'action_allowed',
      passed: true,
    };
  }
  
  private checkDataAccess(policy: Policy, context: ActionContext): PolicyCheck {
    const tableName = context.dataAccess.table;
    
    // Check forbidden tables
    if (policy.data_access.forbidden_tables?.includes(tableName)) {
      return {
        name: 'data_access_forbidden',
        passed: false,
        reason: `Access to table '${tableName}' is forbidden`,
      };
    }
    
    // Check allowed tables
    if (policy.data_access.allowed_tables && 
        !policy.data_access.allowed_tables.includes(tableName)) {
      return {
        name: 'data_access_not_allowed',
        passed: false,
        reason: `Table '${tableName}' not in allowlist`,
      };
    }
    
    // Check row-level security
    if (policy.data_access.row_level_security?.[tableName]) {
      const rls = policy.data_access.row_level_security[tableName];
      const conditionMet = this.evaluateCondition(rls.condition, context);
      
      if (!conditionMet) {
        return {
          name: 'row_level_security_violation',
          passed: false,
          reason: `Row-level security condition not met: ${rls.condition}`,
        };
      }
    }
    
    // Check PII handling
    if (policy.data_access.pii_handling) {
      const requestedFields = context.dataAccess.fields;
      const forbiddenFields = policy.data_access.pii_handling.cannot_read || [];
      
      const violatingFields = requestedFields.filter(f => forbiddenFields.includes(f));
      
      if (violatingFields.length > 0) {
        return {
          name: 'pii_access_violation',
          passed: false,
          reason: `Cannot access PII fields: ${violatingFields.join(', ')}`,
        };
      }
    }
    
    return {
      name: 'data_access_allowed',
      passed: true,
    };
  }
  
  private checkTemporal(policy: Policy, context: ActionContext): PolicyCheck {
    if (!policy.temporal) {
      return { name: 'temporal_check', passed: true };
    }
    
    const now = new Date();
    const tz = policy.temporal.business_hours?.timezone || 'UTC';
    const zonedNow = toZonedTime(now, tz);
    
    // Check business hours
    if (policy.temporal.business_hours) {
      const dayOfWeek = zonedNow.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const allowedHours = policy.temporal.business_hours.allowed_hours[dayOfWeek];
      
      if (!allowedHours) {
        return {
          name: 'outside_business_hours',
          passed: false,
          reason: `No operations allowed on ${dayOfWeek}`,
        };
      }
      
      const currentTime = zonedNow.toTimeString().slice(0, 5); // HH:MM
      const [start, end] = allowedHours.split('-');
      
      if (currentTime < start || currentTime > end) {
        return {
          name: 'outside_business_hours',
          passed: false,
          reason: `Current time ${currentTime} outside allowed hours ${allowedHours}`,
        };
      }
    }
    
    // Check holiday calendar
    if (policy.temporal.auto_pause?.on_us_holidays) {
      if (this.isUSHoliday(zonedNow)) {
        return {
          name: 'holiday_pause',
          passed: false,
          reason: 'Agent paused for US holiday',
        };
      }
    }
    
    return { name: 'temporal_check', passed: true };
  }
  
  private checkCostLimits(policy: Policy, context: ActionContext): PolicyCheck {
    if (!policy.cost_limits) {
      return { name: 'cost_check', passed: true };
    }
    
    const estimatedCost = this.estimateActionCost(context);
    
    // Check per-action limit
    if (estimatedCost > policy.cost_limits.max_per_action) {
      return {
        name: 'cost_per_action_exceeded',
        passed: false,
        reason: `Action cost $${estimatedCost} exceeds limit $${policy.cost_limits.max_per_action}`,
      };
    }
    
    // Check aggregate limits (hour, day, month)
    const spent = {
      hour: this.getSpending('hour', context.agent.id),
      day: this.getSpending('day', context.agent.id),
      month: this.getSpending('month', context.agent.id),
    };
    
    if (spent.hour + estimatedCost > policy.cost_limits.max_per_hour) {
      return {
        name: 'cost_per_hour_exceeded',
        passed: false,
        reason: `Would exceed hourly limit ($${spent.hour + estimatedCost} > $${policy.cost_limits.max_per_hour})`,
      };
    }
    
    if (spent.day + estimatedCost > policy.cost_limits.max_per_day) {
      return {
        name: 'cost_per_day_exceeded',
        passed: false,
        reason: `Would exceed daily limit ($${spent.day + estimatedCost} > $${policy.cost_limits.max_per_day})`,
      };
    }
    
    if (spent.month + estimatedCost > policy.cost_limits.max_per_month) {
      return {
        name: 'cost_per_month_exceeded',
        passed: false,
        reason: `Would exceed monthly limit ($${spent.month + estimatedCost} > $${policy.cost_limits.max_per_month})`,
      };
    }
    
    // Check alert thresholds
    for (const alert of policy.cost_limits.alert_thresholds || []) {
      const percentUsed = (spent.day + estimatedCost) / policy.cost_limits.max_per_day;
      
      if (percentUsed >= alert.threshold && !this.alreadyAlerted(alert, context.agent.id)) {
        this.sendAlert({
          recipients: alert.notify,
          subject: `Cost Alert: ${Math.round(percentUsed * 100)}% of daily limit`,
          details: {
            spent: spent.day,
            limit: policy.cost_limits.max_per_day,
            percentUsed: percentUsed,
          },
        });
        
        if (alert.action === 'pause') {
          return {
            name: 'cost_alert_pause',
            passed: false,
            reason: 'Cost alert threshold triggered - agent paused',
          };
        }
      }
    }
    
    return { name: 'cost_check', passed: true };
  }
  
  private checkRateLimits(policy: Policy, context: ActionContext): PolicyCheck {
    const actionPolicy = policy.actions.allowed.find(a => a.type === context.action.type);
    
    if (!actionPolicy?.constraints?.rate_limit) {
      return { name: 'rate_limit_check', passed: true };
    }
    
    const rateLimit = actionPolicy.constraints.rate_limit;
    const actionCount = this.getActionCount(context.action.type, context.agent.id);
    
    if (rateLimit.max_per_minute) {
      if (actionCount.minute >= rateLimit.max_per_minute) {
        return {
          name: 'rate_limit_per_minute',
          passed: false,
          reason: `Rate limit exceeded: ${actionCount.minute}/${rateLimit.max_per_minute} per minute`,
          retryAfter: 60, // seconds
        };
      }
    }
    
    if (rateLimit.max_per_hour) {
      if (actionCount.hour >= rateLimit.max_per_hour) {
        return {
          name: 'rate_limit_per_hour',
          passed: false,
          reason: `Rate limit exceeded: ${actionCount.hour}/${rateLimit.max_per_hour} per hour`,
          retryAfter: 3600,
        };
      }
    }
    
    if (rateLimit.max_per_day) {
      if (actionCount.day >= rateLimit.max_per_day) {
        return {
          name: 'rate_limit_per_day',
          passed: false,
          reason: `Rate limit exceeded: ${actionCount.day}/${rateLimit.max_per_day} per day`,
          retryAfter: 86400,
        };
      }
    }
    
    return { name: 'rate_limit_check', passed: true };
  }
  
  private checkEscalation(policy: Policy, context: ActionContext): PolicyCheck {
    if (!policy.escalation?.rules) {
      return { name: 'escalation_check', passed: true };
    }
    
    for (const rule of policy.escalation.rules) {
      const conditionMet = this.evaluateCondition(rule.condition, context);
      
      if (conditionMet) {
        if (rule.action === 'require_approval' || rule.action === 'require_human_review') {
          return {
            name: 'escalation_required',
            passed: true, // Not a failure, just needs approval
            requiresApproval: true,
            reason: rule.message,
            approvers: rule.approvers || ['default@company.com'],
          };
        }
        
        if (rule.action === 'escalate_to_manager') {
          return {
            name: 'escalation_to_manager',
            passed: true,
            requiresApproval: true,
            reason: rule.message,
            approvers: [context.agent.manager_email],
          };
        }
        
        if (rule.action === 'pause_agent') {
          return {
            name: 'auto_pause',
            passed: false,
            reason: rule.message,
          };
        }
      }
    }
    
    return { name: 'escalation_check', passed: true };
  }
  
  private evaluateCondition(condition: string, context: ActionContext): boolean {
    // Simple expression evaluator (would use a proper parser in production)
    // Supports: agent.field, customer.field, comparisons, AND/OR
    
    try {
      // Replace variables with actual values
      let expr = condition;
      
      // Replace agent.* variables
      expr = expr.replace(/agent\.(\w+)/g, (match, field) => {
        return JSON.stringify(context.agent[field]);
      });
      
      // Replace customer.* variables
      expr = expr.replace(/customer\.(\w+)/g, (match, field) => {
        return JSON.stringify(context.customer?.[field]);
      });
      
      // Replace action.* variables
      expr = expr.replace(/action\.(\w+)/g, (match, field) => {
        return JSON.stringify(context.action[field]);
      });
      
      // Replace ticket.* variables
      expr = expr.replace(/ticket\.(\w+)/g, (match, field) => {
        return JSON.stringify(context.ticket?.[field]);
      });
      
      // Evaluate (use a safe expression evaluator in production)
      return eval(expr);
    } catch (error) {
      console.error(`Failed to evaluate condition: ${condition}`, error);
      return false;
    }
  }
}
```

### Policy Testing Tool

```typescript
// tools/policy-validator.ts

import { PolicyEngine } from '../governance-kit/policy-engine';

async function testPolicy() {
  const engine = new PolicyEngine();
  await engine.loadPolicies('./policies');
  
  // Test case 1: Allowed action
  const test1 = await engine.evaluateAction({
    agent: {
      id: 'agent-123',
      name: 'customer-support-bot',
    },
    action: {
      type: 'read_ticket',
      ticketId: 'TKT-456',
    },
    timestamp: new Date(),
  });
  
  console.assert(test1.allowed === true, 'Should allow reading ticket');
  
  // Test case 2: Forbidden action
  const test2 = await engine.evaluateAction({
    agent: { id: 'agent-123', name: 'customer-support-bot' },
    action: {
      type: 'delete_customer',
      customerId: 'CUST-789',
    },
    timestamp: new Date(),
  });
  
  console.assert(test2.allowed === false, 'Should forbid deleting customer');
  console.assert(test2.reason.includes('Only humans'), 'Should explain why');
  
  // Test case 3: Requires approval
  const test3 = await engine.evaluateAction({
    agent: { id: 'agent-123', name: 'customer-support-bot', confidence: 0.6 },
    action: {
      type: 'send_email',
      to: 'customer@example.com',
    },
    timestamp: new Date(),
  });
  
  console.assert(test3.requiresApproval === true, 'Should require approval (low confidence)');
  
  // Test case 4: Outside business hours
  const test4 = await engine.evaluateAction({
    agent: { id: 'agent-123', name: 'customer-support-bot' },
    action: {
      type: 'send_email',
      to: 'customer@example.com',
    },
    timestamp: new Date('2026-02-05T22:00:00-05:00'), // 10 PM EST
  });
  
  console.assert(test4.requiresApproval === true, 'Should require approval outside hours');
  
  // Test case 5: Cost limit exceeded
  const test5 = await engine.evaluateAction({
    agent: { id: 'agent-123', name: 'customer-support-bot' },
    action: {
      type: 'expensive_api_call',
      estimatedCost: 5.00,
    },
    timestamp: new Date(),
  });
  
  console.assert(test5.allowed === false, 'Should block action exceeding cost limit');
  
  console.log('All policy tests passed! ✅');
}
```

---

## Immutable Audit Trail

### Audit Log Architecture

**Requirements:**
1. **Immutable:** Logs cannot be modified after creation
2. **Complete:** Every action, decision, and policy evaluation logged
3. **Queryable:** Fast search/filter for investigations
4. **Compliant:** Meets SOC2, GDPR, HIPAA requirements
5. **Tamper-Evident:** Cryptographic proof of integrity

**Implementation:**

```typescript
// governance-kit/audit-log.ts

import { createHash } from 'crypto';
import { S3 } from 'aws-sdk';

interface AuditEntry {
  id: string;
  timestamp: Date;
  eventType: string;
  agent: {
    id: string;
    name: string;
    version: string;
  };
  action: {
    type: string;
    input: any;
    output: any;
    duration: number;
  };
  policyEvaluation: {
    policies: string[];
    decision: 'allow' | 'deny' | 'require_approval';
    checks: PolicyCheck[];
  };
  dataAccess?: {
    tables: string[];
    rowsRead: number;
    rowsModified: number;
    piiAccessed: string[];
  };
  approval?: {
    required: boolean;
    approver: string;
    timestamp: Date;
    decision: 'approved' | 'denied';
  };
  reasoning?: {
    thought: string;
    confidence: number;
    alternatives: string[];
  };
  cost?: {
    estimated: number;
    actual: number;
    breakdown: Record<string, number>;
  };
  error?: {
    message: string;
    stack: string;
    recoveryAction: string;
  };
  metadata: {
    environment: string;
    correlationId: string;
    parentId?: string; // For tracing multi-step workflows
  };
}

export class AuditLog {
  private s3: S3;
  private bucket: string;
  private previousHash: string | null = null;
  
  constructor(config: AuditConfig) {
    this.s3 = new S3({
      region: config.region,
      credentials: config.credentials,
    });
    this.bucket = config.bucket;
  }
  
  async write(entry: Partial<AuditEntry>): Promise<string> {
    // Generate unique ID
    const id = this.generateId();
    
    // Complete entry
    const completeEntry: AuditEntry = {
      id: id,
      timestamp: new Date(),
      ...entry,
    } as AuditEntry;
    
    // Calculate hash (includes previous hash for chain)
    const hash = this.calculateHash(completeEntry, this.previousHash);
    
    const signedEntry = {
      ...completeEntry,
      _signature: hash,
      _previousHash: this.previousHash,
    };
    
    // Write to immutable storage (S3 with Object Lock)
    const key = this.generateS3Key(completeEntry.timestamp, id);
    
    await this.s3.putObject({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(signedEntry, null, 2),
      ContentType: 'application/json',
      ObjectLockMode: 'COMPLIANCE',
      ObjectLockRetainUntilDate: this.calculateRetentionDate(completeEntry),
      Metadata: {
        'event-type': completeEntry.eventType,
        'agent-id': completeEntry.agent.id,
        'timestamp': completeEntry.timestamp.toISOString(),
      },
    }).promise();
    
    // Also write to database for fast querying
    await this.writeToDatabase(signedEntry);
    
    // Update previous hash for chain
    this.previousHash = hash;
    
    return id;
  }
  
  private calculateHash(entry: AuditEntry, previousHash: string | null): string {
    const data = JSON.stringify({
      ...entry,
      _previousHash: previousHash,
    });
    
    return createHash('sha256').update(data).digest('hex');
  }
  
  async verify(entryId: string): Promise<VerificationResult> {
    // Fetch entry
    const entry = await this.getEntry(entryId);
    
    if (!entry) {
      return { valid: false, reason: 'Entry not found' };
    }
    
    // Recalculate hash
    const calculatedHash = this.calculateHash(entry, entry._previousHash);
    
    if (calculatedHash !== entry._signature) {
      return {
        valid: false,
        reason: 'Hash mismatch - entry may have been tampered with',
        expected: entry._signature,
        actual: calculatedHash,
      };
    }
    
    // Verify chain (check previous entry)
    if (entry._previousHash) {
      const previousEntry = await this.getPreviousEntry(entry);
      
      if (!previousEntry) {
        return {
          valid: false,
          reason: 'Previous entry in chain not found',
        };
      }
      
      if (previousEntry._signature !== entry._previousHash) {
        return {
          valid: false,
          reason: 'Chain broken - previous hash mismatch',
        };
      }
    }
    
    return { valid: true };
  }
  
  async query(filter: AuditFilter): Promise<AuditEntry[]> {
    // Query database (much faster than S3)
    let query = db.audit_log.select();
    
    if (filter.eventType) {
      query = query.where({ eventType: filter.eventType });
    }
    
    if (filter.agentId) {
      query = query.where({ 'agent.id': filter.agentId });
    }
    
    if (filter.startTime && filter.endTime) {
      query = query.where({
        timestamp: {
          gte: filter.startTime,
          lte: filter.endTime,
        },
      });
    }
    
    if (filter.actionType) {
      query = query.where({ 'action.type': filter.actionType });
    }
    
    if (filter.policyDecision) {
      query = query.where({ 'policyEvaluation.decision': filter.policyDecision });
    }
    
    if (filter.includeErrors) {
      query = query.where({ error: { neq: null } });
    }
    
    const results = await query
      .orderBy('timestamp', 'desc')
      .limit(filter.limit || 100)
      .execute();
    
    return results;
  }
  
  async exportForCompliance(format: 'json' | 'csv' | 'pdf', filter: AuditFilter): Promise<Buffer> {
    const entries = await this.query(filter);
    
    switch (format) {
      case 'json':
        return Buffer.from(JSON.stringify(entries, null, 2));
      
      case 'csv':
        return this.convertToCSV(entries);
      
      case 'pdf':
        return this.generatePDF(entries);
    }
  }
  
  private async generatePDF(entries: AuditEntry[]): Promise<Buffer> {
    // Generate human-readable PDF report
    const pdf = new PDFDocument();
    
    pdf.fontSize(18).text('Agent Activity Audit Report', { align: 'center' });
    pdf.moveDown();
    
    pdf.fontSize(12).text(`Report Generated: ${new Date().toISOString()}`);
    pdf.text(`Total Entries: ${entries.length}`);
    pdf.moveDown();
    
    for (const entry of entries) {
      pdf.fontSize(14).text(`Entry ${entry.id}`, { underline: true });
      pdf.fontSize(10);
      pdf.text(`Timestamp: ${entry.timestamp.toISOString()}`);
      pdf.text(`Event Type: ${entry.eventType}`);
      pdf.text(`Agent: ${entry.agent.name} (${entry.agent.id})`);
      pdf.text(`Action: ${entry.action.type}`);
      pdf.text(`Policy Decision: ${entry.policyEvaluation.decision}`);
      
      if (entry.approval) {
        pdf.text(`Approval: ${entry.approval.decision} by ${entry.approval.approver}`);
      }
      
      if (entry.dataAccess) {
        pdf.text(`Data Accessed: ${entry.dataAccess.tables.join(', ')}`);
        if (entry.dataAccess.piiAccessed.length > 0) {
          pdf.text(`PII Accessed: ${entry.dataAccess.piiAccessed.join(', ')}`, { color: 'red' });
        }
      }
      
      if (entry.error) {
        pdf.text(`Error: ${entry.error.message}`, { color: 'red' });
      }
      
      pdf.moveDown();
    }
    
    return new Promise((resolve) => {
      const buffers: Buffer[] = [];
      pdf.on('data', buffers.push.bind(buffers));
      pdf.on('end', () => resolve(Buffer.concat(buffers)));
      pdf.end();
    });
  }
}
```

### Compliance Export Templates

**SOC2 Report:**

```typescript
// governance-kit/compliance-reports.ts

async function generateSOC2Report(startDate: Date, endDate: Date) {
  const auditLog = new AuditLog(config);
  
  const report = {
    reportType: 'SOC2 Type II',
    period: { start: startDate, end: endDate },
    controls: {},
  };
  
  // Control: Access Control (CC6.1)
  report.controls.CC6_1 = await auditLog.query({
    startTime: startDate,
    endTime: endDate,
    eventType: 'data_access',
  }).then(entries => ({
    description: 'Logical access controls restrict unauthorized access',
    testResults: {
      totalAccessAttempts: entries.length,
      unauthorizedAttempts: entries.filter(e => e.policyEvaluation.decision === 'deny').length,
      complianceRate: 1 - (entries.filter(e => e.policyEvaluation.decision === 'deny').length / entries.length),
    },
    evidence: entries.slice(0, 10), // Sample
  }));
  
  // Control: Logging & Monitoring (CC7.2)
  report.controls.CC7_2 = {
    description: 'System activities are logged and monitored',
    testResults: {
      totalEvents: await auditLog.count({ startTime: startDate, endTime: endDate }),
      loggingUptime: 0.9999, // 99.99% uptime
      averageLogDelay: 0.05, // 50ms
    },
  };
  
  // Control: Change Management (CC8.1)
  report.controls.CC8_1 = await auditLog.query({
    startTime: startDate,
    endTime: endDate,
    eventType: 'policy_change',
  }).then(entries => ({
    description: 'Changes to system components are controlled',
    testResults: {
      totalChanges: entries.length,
      approvedChanges: entries.filter(e => e.approval?.decision === 'approved').length,
      unapprovedChanges: entries.filter(e => !e.approval).length,
    },
    evidence: entries,
  }));
  
  return report;
}
```

---

## Bounded Autonomy Patterns

### Resource Limits

**Pattern: Sandbox Environment**

```typescript
// governance-kit/sandbox.ts

class AgentSandbox {
  private limits: SandboxLimits;
  private usage: ResourceUsage = {
    cpuTime: 0,
    memory: 0,
    apiCalls: 0,
    cost: 0,
  };
  
  constructor(limits: SandboxLimits) {
    this.limits = limits;
  }
  
  async executeWithinBounds(fn: () => Promise<any>): Promise<any> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    // Set up resource monitoring
    const monitor = this.startMonitoring();
    
    try {
      // Wrap execution with timeout
      const result = await Promise.race([
        fn(),
        this.timeout(this.limits.maxExecutionTime),
      ]);
      
      // Update usage
      this.usage.cpuTime += Date.now() - startTime;
      this.usage.memory = Math.max(this.usage.memory, process.memoryUsage().heapUsed - startMemory);
      
      return result;
    } catch (error) {
      if (error.message === 'TIMEOUT') {
        throw new Error(`Execution exceeded time limit (${this.limits.maxExecutionTime}ms)`);
      }
      throw error;
    } finally {
      monitor.stop();
    }
  }
  
  async checkApiCall(toolName: string, estimatedCost: number): Promise<boolean> {
    // Check if within limits
    if (this.usage.apiCalls >= this.limits.maxApiCalls) {
      throw new Error(`API call limit reached (${this.limits.maxApiCalls})`);
    }
    
    if (this.usage.cost + estimatedCost > this.limits.maxCost) {
      throw new Error(`Cost limit would be exceeded ($${this.usage.cost + estimatedCost} > $${this.limits.maxCost})`);
    }
    
    // Increment counters
    this.usage.apiCalls++;
    this.usage.cost += estimatedCost;
    
    return true;
  }
  
  getUsageReport(): ResourceUsage {
    return {
      ...this.usage,
      percentages: {
        cpuTime: (this.usage.cpuTime / this.limits.maxExecutionTime) * 100,
        apiCalls: (this.usage.apiCalls / this.limits.maxApiCalls) * 100,
        cost: (this.usage.cost / this.limits.maxCost) * 100,
      },
    };
  }
}
```

### Scope Limits

**Pattern: Tool Allowlisting**

```typescript
// governance-kit/tool-allowlist.ts

class ToolAllowlist {
  private allowedTools: Set<string>;
  private deniedTools: Set<string>;
  
  constructor(policy: Policy) {
    this.allowedTools = new Set(policy.allowedTools || []);
    this.deniedTools = new Set(policy.deniedTools || []);
  }
  
  canUseTool(toolName: string, context: ActionContext): boolean {
    // Explicit deny takes precedence
    if (this.deniedTools.has(toolName)) {
      return false;
    }
    
    // If allowlist exists, must be in it
    if (this.allowedTools.size > 0 && !this.allowedTools.has(toolName)) {
      return false;
    }
    
    return true;
  }
  
  getToolCapabilities(toolName: string): ToolCapabilities {
    // Return restricted capabilities for this tool
    const baseCapabilities = ToolRegistry.getCapabilities(toolName);
    const restrictions = this.getRestrictions(toolName);
    
    return this.applyRestrictions(baseCapabilities, restrictions);
  }
}
```

### Impact Limits

**Pattern: Blast Radius Containment**

```typescript
// governance-kit/blast-radius.ts

class BlastRadiusContainment {
  async estimateBlastRadius(action: Action): Promise<BlastRadiusEstimate> {
    const estimate = {
      affectedResources: [],
      affectedUsers: [],
      estimatedImpact: {
        financial: 0,
        reputation: 'low',
        legal: 'none',
      },
      reversibility: 'fully_reversible',
    };
    
    switch (action.type) {
      case 'send_email':
        estimate.affectedUsers = [action.to];
        estimate.reversibility = 'not_reversible';
        estimate.estimatedImpact.reputation = 'medium';
        break;
      
      case 'delete_record':
        estimate.affectedResources = [action.recordId];
        estimate.reversibility = await this.hasBackup(action.recordId) ? 
          'reversible_with_effort' : 
          'not_reversible';
        break;
      
      case 'issue_refund':
        estimate.affectedUsers = [action.customerId];
        estimate.estimatedImpact.financial = action.amount;
        estimate.reversibility = 'reversible_with_approval';
        break;
      
      case 'database_migration':
        estimate.affectedResources = await db.tables.count();
        estimate.affectedUsers = await db.users.count();
        estimate.reversibility = 'reversible_with_downtime';
        estimate.estimatedImpact.reputation = 'high';
        break;
    }
    
    return estimate;
  }
  
  async containDamage(action: Action, error: Error): Promise<void> {
    const blastRadius = await this.estimateBlastRadius(action);
    
    // Notify affected users
    for (const userId of blastRadius.affectedUsers) {
      await this.notifyUser(userId, {
        subject: 'System Action Failed',
        message: 'An automated action failed. Our team is investigating.',
      });
    }
    
    // Attempt rollback if possible
    if (blastRadius.reversibility === 'fully_reversible' || 
        blastRadius.reversibility === 'reversible_with_effort') {
      await this.attemptRollback(action);
    }
    
    // Escalate based on impact
    if (blastRadius.estimatedImpact.financial > 1000 || 
        blastRadius.estimatedImpact.reputation === 'high') {
      await this.escalateToOnCall({
        action: action,
        error: error,
        blastRadius: blastRadius,
      });
    }
  }
}
```

### Circuit Breakers

**Pattern: Auto-Pause on Anomalies**

```typescript
// governance-kit/circuit-breaker.ts

class CircuitBreaker {
  private state: 'closed' | 'open' | 'half_open' = 'closed';
  private errorCount = 0;
  private lastErrorTime: Date | null = null;
  
  constructor(private config: CircuitBreakerConfig) {}
  
  async execute(fn: () => Promise<any>): Promise<any> {
    if (this.state === 'open') {
      // Check if we should try half-open
      if (this.shouldAttemptReset()) {
        this.state = 'half_open';
      } else {
        throw new Error('Circuit breaker is OPEN - agent paused due to repeated errors');
      }
    }
    
    try {
      const result = await fn();
      
      // Success - reset if in half-open state
      if (this.state === 'half_open') {
        this.reset();
      }
      
      return result;
    } catch (error) {
      this.recordError(error);
      
      // Check if we should open circuit
      if (this.shouldOpenCircuit()) {
        this.open();
      }
      
      throw error;
    }
  }
  
  private recordError(error: Error): void {
    this.errorCount++;
    this.lastErrorTime = new Date();
    
    // Track error patterns
    this.trackErrorPattern(error);
  }
  
  private shouldOpenCircuit(): boolean {
    // Open if error count exceeds threshold
    if (this.errorCount >= this.config.errorThreshold) {
      return true;
    }
    
    // Open if error rate too high
    const errorRate = this.getErrorRate();
    if (errorRate > this.config.errorRateThreshold) {
      return true;
    }
    
    return false;
  }
  
  private open(): void {
    this.state = 'open';
    
    // Notify stakeholders
    this.notifyCircuitOpen({
      reason: 'Error threshold exceeded',
      errorCount: this.errorCount,
      errorRate: this.getErrorRate(),
      lastError: this.lastErrorTime,
    });
    
    // Log to audit trail
    AuditLog.write({
      eventType: 'circuit_breaker_opened',
      agent: this.config.agentId,
      reason: 'Error threshold exceeded',
      metadata: {
        errorCount: this.errorCount,
        errorRate: this.getErrorRate(),
      },
    });
  }
  
  private shouldAttemptReset(): boolean {
    if (!this.lastErrorTime) return false;
    
    const timeSinceLastError = Date.now() - this.lastErrorTime.getTime();
    return timeSinceLastError > this.config.resetTimeout;
  }
  
  private reset(): void {
    this.state = 'closed';
    this.errorCount = 0;
    
    AuditLog.write({
      eventType: 'circuit_breaker_reset',
      agent: this.config.agentId,
    });
  }
}
```

---

## Human Approval Gates

### Multi-Level Approval Flows

```typescript
// governance-kit/approval-flows.ts

interface ApprovalFlow {
  name: string;
  levels: ApprovalLevel[];
  parallelApproval: boolean; // All at once vs. sequential
}

interface ApprovalLevel {
  name: string;
  approvers: string[]; // Email addresses or role names
  minApprovals: number; // How many approvers must approve
  timeout: number; // Milliseconds
  timeoutAction: 'deny' | 'escalate' | 'allow';
}

const approvalFlows: Record<string, ApprovalFlow> = {
  'financial_transaction': {
    name: 'Financial Transaction Approval',
    parallelApproval: false, // Sequential
    levels: [
      {
        name: 'Manager Approval',
        approvers: ['manager@company.com'],
        minApprovals: 1,
        timeout: 2 * 60 * 60 * 1000, // 2 hours
        timeoutAction: 'escalate',
      },
      {
        name: 'Finance Approval',
        approvers: ['finance@company.com', 'cfo@company.com'],
        minApprovals: 1,
        timeout: 4 * 60 * 60 * 1000, // 4 hours
        timeoutAction: 'deny',
      },
    ],
  },
  
  'customer_communication': {
    name: 'Customer Communication Approval',
    parallelApproval: true, // Any one can approve
    levels: [
      {
        name: 'Support Manager Approval',
        approvers: ['support-manager@company.com', 'customer-success@company.com'],
        minApprovals: 1,
        timeout: 1 * 60 * 60 * 1000, // 1 hour
        timeoutAction: 'deny',
      },
    ],
  },
  
  'policy_change': {
    name: 'Policy Change Approval',
    parallelApproval: false,
    levels: [
      {
        name: 'Security Review',
        approvers: ['security@company.com'],
        minApprovals: 1,
        timeout: 24 * 60 * 60 * 1000, // 24 hours
        timeoutAction: 'deny',
      },
      {
        name: 'CTO Approval',
        approvers: ['cto@company.com'],
        minApprovals: 1,
        timeout: 24 * 60 * 60 * 1000,
        timeoutAction: 'deny',
      },
    ],
  },
};

class ApprovalFlowExecutor {
  async execute(flowName: string, request: ApprovalRequest): Promise<ApprovalResult> {
    const flow = approvalFlows[flowName];
    
    if (!flow) {
      throw new Error(`Unknown approval flow: ${flowName}`);
    }
    
    if (flow.parallelApproval) {
      return await this.executeParallel(flow, request);
    } else {
      return await this.executeSequential(flow, request);
    }
  }
  
  private async executeSequential(flow: ApprovalFlow, request: ApprovalRequest): Promise<ApprovalResult> {
    for (const level of flow.levels) {
      const levelResult = await this.executeLevel(level, request);
      
      if (levelResult.status === 'denied') {
        return {
          status: 'denied',
          level: level.name,
          reason: levelResult.reason,
        };
      }
      
      if (levelResult.status === 'timeout') {
        if (level.timeoutAction === 'deny') {
          return {
            status: 'denied',
            level: level.name,
            reason: 'Approval timeout',
          };
        } else if (level.timeoutAction === 'escalate') {
          // Escalate to next level
          continue;
        } else {
          // Allow
          return {
            status: 'approved',
            level: level.name,
            approvers: [],
            note: 'Auto-approved after timeout',
          };
        }
      }
    }
    
    return {
      status: 'approved',
      approvers: flow.levels.flatMap(l => l.approvers),
    };
  }
  
  private async executeLevel(level: ApprovalLevel, request: ApprovalRequest): Promise<LevelResult> {
    // Send approval requests to all approvers
    const approvalPromises = level.approvers.map(approver => 
      this.requestApproval({
        ...request,
        approver: approver,
        level: level.name,
      })
    );
    
    // Wait for enough approvals or timeout
    const approvals: ApprovalResponse[] = [];
    const startTime = Date.now();
    
    while (approvals.filter(a => a.decision === 'approved').length < level.minApprovals) {
      // Check timeout
      if (Date.now() - startTime > level.timeout) {
        return { status: 'timeout' };
      }
      
      // Wait for next response
      const response = await Promise.race([
        ...approvalPromises.filter((_, i) => !approvals[i]),
        this.delay(level.timeout - (Date.now() - startTime)),
      ]);
      
      if (!response) {
        return { status: 'timeout' };
      }
      
      approvals.push(response);
      
      // Check for denials
      if (response.decision === 'denied') {
        return {
          status: 'denied',
          reason: response.reason,
          denier: response.approver,
        };
      }
    }
    
    return {
      status: 'approved',
      approvers: approvals.filter(a => a.decision === 'approved').map(a => a.approver),
    };
  }
}
```

### Bulk Approval UX

For high-frequency approval scenarios:

```typescript
// ui/bulk-approval.tsx

function BulkApprovalInterface() {
  const [pending, setPending] = useState<ApprovalRequest[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    // Fetch pending approvals
    async function fetchPending() {
      const approvals = await api.getPendingApprovals();
      setPending(approvals);
    }
    
    fetchPending();
    
    // Poll for new approvals
    const interval = setInterval(fetchPending, 30000); // 30s
    return () => clearInterval(interval);
  }, []);
  
  async function approveSelected() {
    await api.bulkApprove({
      ids: Array.from(selected),
      approver: currentUser.email,
    });
    
    setPending(pending.filter(p => !selected.has(p.id)));
    setSelected(new Set());
  }
  
  async function denySelected(reason: string) {
    await api.bulkDeny({
      ids: Array.from(selected),
      approver: currentUser.email,
      reason: reason,
    });
    
    setPending(pending.filter(p => !selected.has(p.id)));
    setSelected(new Set());
  }
  
  return (
    <div className="bulk-approval">
      <h2>Pending Approvals ({pending.length})</h2>
      
      <div className="filters">
        <select onChange={e => filterByType(e.target.value)}>
          <option value="all">All Types</option>
          <option value="refund">Refunds</option>
          <option value="email">Emails</option>
          <option value="data_access">Data Access</option>
        </select>
        
        <select onChange={e => filterByAgent(e.target.value)}>
          <option value="all">All Agents</option>
          {uniqueAgents.map(agent => (
            <option key={agent} value={agent}>{agent}</option>
          ))}
        </select>
      </div>
      
      <table className="approval-table">
        <thead>
          <tr>
            <th><input type="checkbox" onChange={e => selectAll(e.target.checked)} /></th>
            <th>Time</th>
            <th>Agent</th>
            <th>Action</th>
            <th>Details</th>
            <th>Risk</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {pending.map(request => (
            <tr key={request.id} className={selected.has(request.id) ? 'selected' : ''}>
              <td>
                <input 
                  type="checkbox" 
                  checked={selected.has(request.id)}
                  onChange={e => toggleSelected(request.id, e.target.checked)}
                />
              </td>
              <td>{formatRelativeTime(request.timestamp)}</td>
              <td>{request.agent.name}</td>
              <td>{request.action.type}</td>
              <td>
                <button onClick={() => showDetails(request.id)}>View Details</button>
              </td>
              <td>
                <span className={`risk-${request.riskLevel}`}>{request.riskLevel}</span>
              </td>
              <td>
                <button onClick={() => approveOne(request.id)}>✓ Approve</button>
                <button onClick={() => denyOne(request.id)}>✗ Deny</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {selected.size > 0 && (
        <div className="bulk-actions">
          <button onClick={approveSelected}>
            Approve {selected.size} Selected
          </button>
          <button onClick={() => denySelected(prompt('Reason for denial:'))}>
            Deny {selected.size} Selected
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## Compliance & Regulatory Mapping

### GDPR Compliance

```typescript
// governance-kit/gdpr-compliance.ts

class GDPRCompliance {
  async handleDataAccess(context: ActionContext): Promise<void> {
    if (this.isPII(context.dataAccess.fields)) {
      // Log PII access (GDPR Article 30: Records of processing activities)
      await AuditLog.write({
        eventType: 'pii_access',
        agent: context.agent,
        dataSubject: context.customer.id,
        purpose: context.purpose,
        legalBasis: context.legalBasis, // e.g., "legitimate_interest", "consent"
        dataCategories: context.dataAccess.fields,
        timestamp: new Date(),
      });
      
      // Check consent (if basis is consent)
      if (context.legalBasis === 'consent') {
        const hasConsent = await this.checkConsent(context.customer.id, context.purpose);
        
        if (!hasConsent) {
          throw new Error('GDPR violation: No consent for PII access');
        }
      }
    }
  }
  
  async handleRightToErasure(customerId: string): Promise<void> {
    // GDPR Article 17: Right to erasure ("right to be forgotten")
    
    // Get all data for this customer
    const customerData = await this.getAllCustomerData(customerId);
    
    // Anonymize instead of delete (for audit compliance)
    await this.anonymizeData(customerData);
    
    // Log the erasure
    await AuditLog.write({
      eventType: 'data_erasure',
      dataSubject: customerId,
      dataCategories: Object.keys(customerData),
      timestamp: new Date(),
      compliance: 'GDPR Article 17',
    });
  }
  
  async handleDataPortability(customerId: string): Promise<Buffer> {
    // GDPR Article 20: Right to data portability
    
    const customerData = await this.getAllCustomerData(customerId);
    
    // Export in machine-readable format (JSON)
    const export = {
      customer: customerData,
      exportDate: new Date(),
      format: 'JSON',
    };
    
    await AuditLog.write({
      eventType: 'data_export',
      dataSubject: customerId,
      timestamp: new Date(),
      compliance: 'GDPR Article 20',
    });
    
    return Buffer.from(JSON.stringify(export, null, 2));
  }
}
```

### SOC2 Compliance

Already covered in Audit Trail section - see SOC2 report generation.

### HIPAA Compliance

```typescript
// governance-kit/hipaa-compliance.ts

class HIPAACompliance {
  async handlePHI(context: ActionContext): Promise<void> {
    // PHI = Protected Health Information
    
    if (this.isPHI(context.dataAccess.fields)) {
      // Ensure encrypted in transit and at rest
      if (!context.connection.encrypted) {
        throw new Error('HIPAA violation: PHI must be encrypted in transit');
      }
      
      // Log access (HIPAA requires audit trails)
      await AuditLog.write({
        eventType: 'phi_access',
        agent: context.agent,
        patient: context.patient.id,
        purpose: context.purpose,
        dataCategories: context.dataAccess.fields,
        timestamp: new Date(),
        compliance: 'HIPAA',
      });
      
      // Check minimum necessary (only access what's needed)
      const minimumNecessary = this.calculateMinimumNecessary(context.purpose);
      const excessFields = context.dataAccess.fields.filter(f => !minimumNecessary.includes(f));
      
      if (excessFields.length > 0) {
        throw new Error(`HIPAA violation: Accessing more PHI than necessary: ${excessFields.join(', ')}`);
      }
    }
  }
}
```

---

## Real-World Examples

### Example 1: E-commerce Refund Agent

```yaml
# policies/ecommerce-refund-agent.yaml

name: ecommerce_refund_agent
version: 1.0.0

applies_to:
  agents: [refund-bot]
  environments: [production]

data_access:
  allowed_tables: [orders, customers, payments]
  forbidden_tables: [employees, admin_logs]
  
  pii_handling:
    can_read: [customer_name, customer_email, order_history]
    cannot_read: [credit_card, ssn]

actions:
  allowed:
    - type: issue_refund
      constraints:
        max_amount: 100.00
        require_approval:
          if: "amount > 100 OR customer.refund_count_30_days > 2"
          approvers: [manager@shop.com]
        rate_limit:
          max_per_hour: 20

escalation:
  rules:
    - condition: "customer.lifetime_value > 10000"
      action: require_human_review
      message: "High-value customer - manual review required"

audit:
  log_level: detailed
  retention:
    duration: 7_years
```

### Example 2: Healthcare Appointment Scheduler

```yaml
# policies/healthcare-scheduler.yaml

name: healthcare_appointment_scheduler
version: 1.0.0

applies_to:
  agents: [appointment-bot]
  environments: [production]

data_access:
  allowed_tables: [appointments, patients, providers]
  
  pii_handling:
    can_read: [patient_name, dob, phone]
    cannot_read: [medical_history, diagnosis, medications]
    
  phi_handling:
    encryption_required: true
    minimum_necessary: true

actions:
  allowed:
    - type: schedule_appointment
      constraints:
        business_hours_only: true
        max_advance_days: 90
    
    - type: send_reminder
      constraints:
        must_include_unsubscribe: true

temporal:
  business_hours:
    timezone: "America/New_York"
    allowed_hours:
      monday-friday: "08:00-17:00"

compliance:
  hipaa:
    enabled: true
    minimum_necessary_rule: enforced
    access_logging: required
```

---

**Next:** [Production Readiness Checklist →](./03-production-readiness.md)
