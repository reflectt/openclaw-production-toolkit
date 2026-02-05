# Workflow Redesign Patterns
## From Automation to Transformation

**Reading Time:** 45 minutes  
**Complexity:** Intermediate  
**Prerequisites:** Understanding of your current workflow, stakeholder buy-in

---

## Table of Contents

1. [Introduction: Why Redesign?](#introduction-why-redesign)
2. [Pre-Automation Assessment](#pre-automation-assessment)
3. [The Four Core Patterns](#the-four-core-patterns)
4. [Human Oversight Integration](#human-oversight-integration)
5. [Rollback Procedures](#rollback-procedures)
6. [Progressive Autonomy Expansion](#progressive-autonomy-expansion)
7. [Case Studies](#case-studies)

---

## Introduction: Why Redesign?

### The Automation Trap

Most teams fail at production agent deployment because they try to **automate broken workflows**.

```
❌ WRONG: Current Workflow → Add Agent → Hope for the Best
✅ RIGHT: Current Workflow → Redesign → Add Agent → Validate → Expand
```

### The Core Principle

**You cannot automate your way out of a bad process.**

Before adding an agent, ask:
- If a new junior employee did this workflow, would they succeed?
- Are the decision criteria clear and documented?
- Do we have approval gates at the right places?
- Can we roll back if something goes wrong?

If the answer is "no," fix the workflow first.

---

## Pre-Automation Assessment

### Step 1: Map Your Current Workflow

Use this template to document your existing process:

```markdown
## Workflow: [Name]

### Trigger
What starts this workflow?
Example: "Customer submits support ticket with tag 'urgent'"

### Steps (Current State)
1. **Step:** Support agent reads ticket
   - **Who:** Human support agent
   - **Tools:** Zendesk, internal knowledge base
   - **Decision Point:** Is this truly urgent?
   - **Time:** 5-10 minutes
   - **Error Rate:** 15% misclassified urgency

2. **Step:** Look up customer history
   - **Who:** Same support agent
   - **Tools:** CRM, payment system, ticket history
   - **Decision Point:** What's their LTV? Past issues?
   - **Time:** 3-5 minutes
   - **Error Rate:** 20% miss relevant history

3. **Step:** Draft response
   - **Who:** Same support agent
   - **Tools:** Email, templates, knowledge base
   - **Decision Point:** Which template? Custom response?
   - **Time:** 10-15 minutes
   - **Error Rate:** 30% miss key info from knowledge base

4. **Step:** Manager review (if urgent)
   - **Who:** Support manager
   - **Tools:** Email, Slack
   - **Decision Point:** Approve response? Escalate?
   - **Time:** 30-60 minutes (waiting time)
   - **Error Rate:** 5% (mostly delays)

5. **Step:** Send response
   - **Who:** Original support agent
   - **Tools:** Zendesk
   - **Time:** 1 minute
   - **Error Rate:** <1%

### Total Metrics (Current)
- **End-to-End Time:** 49-91 minutes
- **Actual Work Time:** 19-31 minutes  
- **Wait Time:** 30-60 minutes
- **Overall Error Rate:** 70% of tickets have at least one issue
- **Cost:** $25-40 per ticket (labor)

### Pain Points
- Knowledge base is incomplete and hard to search
- Managers are bottlenecks for urgent tickets
- Support agents forget to check customer history
- Response quality varies wildly by agent experience
```

**📥 Template:** See `templates/workflow-assessment.md`

---

### Step 2: Risk Assessment Matrix

For each step, evaluate:

| Step | What Can Go Wrong? | Impact (1-5) | Likelihood (1-5) | Risk Score | Mitigation |
|------|-------------------|--------------|------------------|------------|------------|
| 1. Read ticket | Misclassify urgency | 4 | 3 | 12 | Clear urgency criteria |
| 2. Look up history | Miss critical context | 3 | 4 | 12 | Automated context gathering |
| 3. Draft response | Wrong info from KB | 5 | 3 | 15 | Human review required |
| 4. Manager review | Delay in approval | 2 | 5 | 10 | Async approval system |
| 5. Send response | Send to wrong customer | 5 | 1 | 5 | Pre-send validation |

**Risk Scoring:**
- **15-25:** Critical - Must have human oversight
- **10-14:** High - Agent + approval gate
- **5-9:** Medium - Agent with human review option
- **1-4:** Low - Full automation with monitoring

---

### Step 3: Identify Human Touchpoints

Map where humans MUST stay in the loop:

**Non-Negotiable Human Oversight (Legal/Compliance)**
- [ ] Financial transactions over $X
- [ ] Customer data access/modification
- [ ] Legal or regulatory communications
- [ ] Contract approvals
- [ ] Account deletions or suspensions

**High-Value Human Judgment**
- [ ] Strategic decisions (long-term impact)
- [ ] Creative work (brand voice, design)
- [ ] Conflict resolution (angry customers)
- [ ] Edge cases (unusual situations)
- [ ] New scenarios (not seen before)

**Optional Human Oversight (Progressive Trust)**
- [ ] Routine responses (gradually automate)
- [ ] Data gathering (validate quality first)
- [ ] Scheduling (low risk)
- [ ] Summarization (check accuracy initially)

---

### Step 4: Automation Readiness Scorecard

Score your workflow (1-5 for each):

| Criterion | Score | Notes |
|-----------|-------|-------|
| **Process Documentation** | __ | Are steps clearly documented? |
| **Decision Criteria** | __ | Are decisions rule-based or judgment calls? |
| **Data Availability** | __ | Can agent access all needed data? |
| **Error Recovery** | __ | Can we undo/rollback actions? |
| **Success Metrics** | __ | Can we measure if agent did it right? |
| **Stakeholder Buy-In** | __ | Do users trust agent involvement? |
| **Tool API Quality** | __ | Are APIs reliable and well-documented? |
| **Edge Case Handling** | __ | What % of cases fit the pattern? |
| **Compliance Requirements** | __ | Any regulatory blockers? |
| **Rollback Procedures** | __ | Can we return to manual easily? |

**Total Score: __ / 50**

- **40-50:** Ready for agent automation
- **30-39:** Redesign required first
- **20-29:** Major process improvements needed
- **<20:** Not ready - fix workflow manually first

---

## The Four Core Patterns

### Pattern 1: Request-Approve-Execute

**Best For:** High-risk actions, financial transactions, customer-facing communications

**Before: Manual Process**
```
Human analyzes → Human drafts action → Manager approves → Human executes
Time: 2 hours | Error Rate: 15% | Bottleneck: Manager availability
```

**After: Agent-Assisted with Approval**
```
Agent analyzes → Agent drafts action → HUMAN APPROVES → Agent executes
Time: 15 minutes | Error Rate: 8% | Bottleneck: Eliminated (async approval)
```

**Code Example:**

```typescript
// tools/request-approve-execute.ts

import { OpenClaw } from '@openclaw/core';
import { ApprovalGateway } from '@openclaw/governance';

interface RefundRequest {
  customerId: string;
  orderId: string;
  amount: number;
  reason: string;
}

async function processRefundRequest(request: RefundRequest) {
  const agent = new OpenClaw();
  
  // STEP 1: Agent gathers context
  const context = await agent.gatherContext({
    customer: await fetchCustomerHistory(request.customerId),
    order: await fetchOrderDetails(request.orderId),
    policy: await fetchRefundPolicy(),
  });
  
  // STEP 2: Agent analyzes and makes recommendation
  const analysis = await agent.think({
    task: 'analyze_refund_request',
    context: context,
    request: request,
  });
  
  // STEP 3: Request human approval
  const approval = await ApprovalGateway.request({
    type: 'refund',
    summary: `Refund $${request.amount} to ${context.customer.email}`,
    details: {
      customerLTV: context.customer.lifetimeValue,
      orderDate: context.order.createdAt,
      agentReasoning: analysis.reasoning,
      riskScore: analysis.riskScore,
    },
    approvers: ['manager@company.com', 'finance@company.com'],
    timeout: '24h',
    defaultAction: 'deny', // Safe default
    notificationChannels: ['slack', 'email'],
  });
  
  if (approval.status === 'approved') {
    // STEP 4: Agent executes
    const result = await executeRefund({
      orderId: request.orderId,
      amount: request.amount,
      method: context.order.paymentMethod,
    });
    
    // STEP 5: Notify customer
    await agent.notify({
      to: context.customer.email,
      template: 'refund_processed',
      data: {
        amount: request.amount,
        estimatedArrival: result.estimatedArrival,
        approvedBy: approval.approver,
      },
    });
    
    return { status: 'completed', refundId: result.id };
  } else {
    // Approval denied or timed out
    await agent.notify({
      to: request.submittedBy,
      template: 'refund_denied',
      data: {
        reason: approval.denialReason || 'Request timed out',
      },
    });
    
    return { status: 'denied', reason: approval.denialReason };
  }
}
```

**Approval UI (Slack Integration):**

```typescript
// integrations/slack-approval.ts

import { ApprovalGateway } from '@openclaw/governance';
import { WebClient } from '@slack/web-api';

ApprovalGateway.registerHandler({
  channel: 'slack',
  handler: async (approvalRequest) => {
    const slack = new WebClient(process.env.SLACK_TOKEN);
    
    await slack.chat.postMessage({
      channel: approvalRequest.approvers[0], // DM or channel
      text: `Approval Required: ${approvalRequest.summary}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Refund Request*\n${approvalRequest.summary}`,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Customer LTV:*\n$${approvalRequest.details.customerLTV}` },
            { type: 'mrkdwn', text: `*Risk Score:*\n${approvalRequest.details.riskScore}/10` },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Agent Reasoning:*\n${approvalRequest.details.agentReasoning}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Approve ✅' },
              style: 'primary',
              value: 'approve',
              action_id: `approve_${approvalRequest.id}`,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Deny ❌' },
              style: 'danger',
              value: 'deny',
              action_id: `deny_${approvalRequest.id}`,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Request More Info' },
              value: 'more_info',
              action_id: `info_${approvalRequest.id}`,
            },
          ],
        },
      ],
    });
  },
});
```

**Key Benefits:**
- Human stays in control of high-risk decisions
- Agent does 90% of the work (data gathering, analysis, execution)
- Async approval removes bottlenecks
- Full audit trail of who approved what

---

### Pattern 2: Bounded Exploration

**Best For:** Research tasks, data analysis, option generation (low-risk exploration, high-value synthesis)

**Before: Manual Process**
```
Human spends 4 hours searching → Compiles findings → Analyzes → Presents options
Time: 4 hours | Coverage: Limited by human stamina | Bias: Confirmation bias
```

**After: Agent Explores, Human Decides**
```
Agent searches 100+ sources in 10 minutes → Synthesizes findings → Presents options → HUMAN CHOOSES
Time: 30 minutes total | Coverage: Comprehensive | Bias: Reduced (more data)
```

**Code Example:**

```typescript
// tools/bounded-exploration.ts

import { OpenClaw } from '@openclaw/core';
import { ExplorationBounds } from '@openclaw/governance';

interface MarketResearchTask {
  topic: string;
  depth: 'quick' | 'standard' | 'deep';
  focus: string[];
  constraints: {
    maxSources: number;
    maxCost: number; // API costs
    maxTime: number; // minutes
    allowedDomains?: string[]; // whitelist
    blockedDomains?: string[]; // blacklist
  };
}

async function conductMarketResearch(task: MarketResearchTask) {
  const agent = new OpenClaw();
  
  // Define exploration boundaries
  const bounds = new ExplorationBounds({
    maxIterations: task.constraints.maxSources,
    maxCost: task.constraints.maxCost,
    maxTime: task.constraints.maxTime * 60 * 1000, // to ms
    allowedTools: ['web_search', 'web_fetch', 'pdf_extract'],
    blockedTools: ['email', 'message', 'exec'], // No outbound actions
    allowedDomains: task.constraints.allowedDomains,
    blockedDomains: task.constraints.blockedDomains,
    costTracking: true,
  });
  
  // Agent explores within bounds
  const exploration = await agent.explore({
    objective: `Research ${task.topic} focusing on: ${task.focus.join(', ')}`,
    bounds: bounds,
    strategy: task.depth === 'deep' ? 'comprehensive' : 'breadth-first',
    onProgress: (progress) => {
      console.log(`Progress: ${progress.sourcesProcessed}/${task.constraints.maxSources} sources`);
      console.log(`Cost so far: $${progress.costAccrued}`);
    },
  });
  
  // Agent synthesizes findings
  const synthesis = await agent.synthesize({
    data: exploration.findings,
    format: 'executive_summary',
    includeOptions: true, // Generate decision options
    includeSources: true, // Provenance for every claim
  });
  
  // Present to human for decision
  return {
    summary: synthesis.executiveSummary,
    options: synthesis.options.map(opt => ({
      title: opt.title,
      description: opt.description,
      pros: opt.pros,
      cons: opt.cons,
      confidence: opt.confidence, // How sure is the agent?
      sources: opt.sources, // Which sources support this?
    })),
    fullReport: synthesis.fullReport,
    metadata: {
      sourcesUsed: exploration.sourcesProcessed,
      timeElapsed: exploration.timeElapsed,
      costAccrued: exploration.costAccrued,
      boundariesRespected: exploration.boundariesRespected, // Did agent stay in bounds?
    },
  };
}
```

**Bounds Enforcement Example:**

```typescript
// governance/exploration-bounds.ts

export class ExplorationBounds {
  private costAccrued = 0;
  private iterationCount = 0;
  private startTime = Date.now();
  
  constructor(private config: BoundsConfig) {}
  
  async checkToolCall(toolName: string, args: any): Promise<CheckResult> {
    // Check 1: Is tool allowed?
    if (this.config.blockedTools?.includes(toolName)) {
      return {
        allowed: false,
        reason: `Tool '${toolName}' is blocked in exploration mode`,
      };
    }
    
    if (this.config.allowedTools && !this.config.allowedTools.includes(toolName)) {
      return {
        allowed: false,
        reason: `Tool '${toolName}' not in allowlist`,
      };
    }
    
    // Check 2: Have we exceeded iteration limit?
    if (this.iterationCount >= this.config.maxIterations) {
      return {
        allowed: false,
        reason: `Max iterations (${this.config.maxIterations}) reached`,
      };
    }
    
    // Check 3: Have we exceeded cost limit?
    const estimatedCost = this.estimateToolCost(toolName, args);
    if (this.costAccrued + estimatedCost > this.config.maxCost) {
      return {
        allowed: false,
        reason: `Would exceed cost limit ($${this.config.maxCost})`,
      };
    }
    
    // Check 4: Have we exceeded time limit?
    const elapsed = Date.now() - this.startTime;
    if (elapsed > this.config.maxTime) {
      return {
        allowed: false,
        reason: `Time limit (${this.config.maxTime}ms) exceeded`,
      };
    }
    
    // Check 5: Domain restrictions (for web_fetch)
    if (toolName === 'web_fetch' && args.url) {
      const domain = new URL(args.url).hostname;
      
      if (this.config.blockedDomains?.some(d => domain.includes(d))) {
        return {
          allowed: false,
          reason: `Domain '${domain}' is blocked`,
        };
      }
      
      if (this.config.allowedDomains && 
          !this.config.allowedDomains.some(d => domain.includes(d))) {
        return {
          allowed: false,
          reason: `Domain '${domain}' not in allowlist`,
        };
      }
    }
    
    // All checks passed
    this.iterationCount++;
    this.costAccrued += estimatedCost;
    
    return {
      allowed: true,
      remainingIterations: this.config.maxIterations - this.iterationCount,
      remainingBudget: this.config.maxCost - this.costAccrued,
      remainingTime: this.config.maxTime - elapsed,
    };
  }
  
  private estimateToolCost(toolName: string, args: any): number {
    // Cost estimation logic (API pricing, token counts, etc.)
    const costMap = {
      web_search: 0.01,
      web_fetch: 0.005,
      pdf_extract: 0.02,
      llm_call: this.estimateLLMCost(args),
    };
    
    return costMap[toolName] || 0;
  }
}
```

**Key Benefits:**
- Agent can explore more thoroughly than humans
- Human judgment applied to synthesized options (not raw data overload)
- Cost and time bounded (predictable)
- No risk of agent taking actions (read-only)

---

### Pattern 3: Supervised Learning

**Best For:** Training agents on domain-specific judgment, improving accuracy over time

**Before: Manual Process**
```
Human handles every case → No learning → Same mistakes repeated
Time: 10 min/case | Accuracy: 85% | Improvement: None
```

**After: Agent Learns from Human Corrections**
```
Agent attempts case → Human reviews → Human corrects → Agent learns → Accuracy improves
Time: 3 min/case (agent) + 1 min/review (human) | Accuracy: 85% → 95% over time
```

**Code Example:**

```typescript
// tools/supervised-learning.ts

import { OpenClaw } from '@openclaw/core';
import { SupervisedTrainer } from '@openclaw/governance';

interface SupportTicketClassification {
  ticketId: string;
  content: string;
  suggestedCategory: string;
  suggestedPriority: 'low' | 'medium' | 'high' | 'urgent';
  confidence: number;
}

async function classifyTicketWithSupervision(ticketContent: string) {
  const agent = new OpenClaw();
  const trainer = new SupervisedTrainer('support_classification');
  
  // Agent makes initial prediction
  const prediction = await agent.classify({
    task: 'support_ticket_classification',
    input: ticketContent,
    categories: ['billing', 'technical', 'feature_request', 'bug', 'other'],
    priorities: ['low', 'medium', 'high', 'urgent'],
    context: await trainer.getSimilarExamples(ticketContent, limit: 5), // Few-shot learning
  });
  
  // If confidence is high enough, auto-apply
  if (prediction.confidence > 0.9 && trainer.getAccuracy() > 0.95) {
    await trainer.logDecision({
      input: ticketContent,
      prediction: prediction,
      autoApplied: true,
    });
    
    return {
      category: prediction.category,
      priority: prediction.priority,
      requiresReview: false,
    };
  }
  
  // Otherwise, request human review
  const humanReview = await requestHumanReview({
    ticketContent: ticketContent,
    agentSuggestion: {
      category: prediction.category,
      priority: prediction.priority,
      confidence: prediction.confidence,
      reasoning: prediction.reasoning,
    },
  });
  
  // Learn from human correction
  if (humanReview.corrected) {
    await trainer.addTrainingExample({
      input: ticketContent,
      correctCategory: humanReview.category,
      correctPriority: humanReview.priority,
      agentPrediction: prediction,
      feedback: humanReview.feedback,
    });
    
    // Retrain model if enough new examples
    if (trainer.getNewExampleCount() >= 50) {
      await trainer.retrain();
    }
  }
  
  return {
    category: humanReview.category,
    priority: humanReview.priority,
    requiresReview: false,
    wasCorrection: humanReview.corrected,
  };
}
```

**Training Data Storage:**

```typescript
// governance/supervised-trainer.ts

export class SupervisedTrainer {
  constructor(private taskName: string) {
    this.loadTrainingData();
  }
  
  async addTrainingExample(example: TrainingExample) {
    // Store in database with versioning
    await db.training_examples.insert({
      task: this.taskName,
      input: example.input,
      correctOutput: {
        category: example.correctCategory,
        priority: example.correctPriority,
      },
      agentPrediction: example.agentPrediction,
      humanFeedback: example.feedback,
      timestamp: new Date(),
      version: this.getCurrentModelVersion(),
    });
    
    // Update in-memory cache
    this.trainingExamples.push(example);
    
    // Track accuracy metrics
    const wasCorrect = 
      example.agentPrediction.category === example.correctCategory &&
      example.agentPrediction.priority === example.correctPriority;
    
    await this.updateAccuracyMetrics(wasCorrect);
  }
  
  async getSimilarExamples(input: string, limit: number = 5): Promise<TrainingExample[]> {
    // Semantic search for similar past examples
    const embedding = await this.getEmbedding(input);
    
    const similar = await db.training_examples
      .where({ task: this.taskName })
      .orderBy(db.cosineDistance('embedding', embedding))
      .limit(limit)
      .execute();
    
    return similar;
  }
  
  getAccuracy(): number {
    const recentExamples = this.trainingExamples.slice(-100); // Last 100
    const correct = recentExamples.filter(ex => ex.wasCorrect).length;
    return correct / recentExamples.length;
  }
  
  async retrain() {
    // Fine-tune model on accumulated examples
    console.log(`Retraining with ${this.trainingExamples.length} examples...`);
    
    // Export training data
    const trainingData = this.trainingExamples.map(ex => ({
      messages: [
        { role: 'system', content: 'You are a support ticket classifier.' },
        { role: 'user', content: ex.input },
        { role: 'assistant', content: JSON.stringify({
          category: ex.correctOutput.category,
          priority: ex.correctOutput.priority,
        })},
      ],
    }));
    
    // Trigger fine-tuning job (OpenAI, Anthropic, etc.)
    const job = await this.llmProvider.createFineTuningJob({
      trainingData: trainingData,
      baseModel: 'gpt-4',
      suffix: `support-classifier-v${this.getNextVersion()}`,
    });
    
    // Update model version when complete
    await this.monitorTrainingJob(job.id);
  }
}
```

**Human Review UI:**

```typescript
// ui/human-review.tsx

import React from 'react';

function TicketReviewInterface({ ticket, agentSuggestion }) {
  const [category, setCategory] = useState(agentSuggestion.category);
  const [priority, setPriority] = useState(agentSuggestion.priority);
  const [feedback, setFeedback] = useState('');
  
  const corrected = 
    category !== agentSuggestion.category || 
    priority !== agentSuggestion.priority;
  
  return (
    <div className="review-panel">
      <h3>Ticket #{ticket.id}</h3>
      <p>{ticket.content}</p>
      
      <div className="agent-suggestion">
        <h4>Agent Suggestion (Confidence: {agentSuggestion.confidence}%)</h4>
        <p><strong>Category:</strong> {agentSuggestion.category}</p>
        <p><strong>Priority:</strong> {agentSuggestion.priority}</p>
        <p><em>{agentSuggestion.reasoning}</em></p>
      </div>
      
      <div className="human-override">
        <h4>Your Classification</h4>
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="billing">Billing</option>
          <option value="technical">Technical</option>
          <option value="feature_request">Feature Request</option>
          <option value="bug">Bug</option>
          <option value="other">Other</option>
        </select>
        
        <select value={priority} onChange={e => setPriority(e.target.value)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        
        {corrected && (
          <div className="feedback">
            <label>Why did you correct this? (helps the agent learn)</label>
            <textarea 
              value={feedback} 
              onChange={e => setFeedback(e.target.value)}
              placeholder="e.g., 'Customer mentioned payment failure, which is billing not technical'"
            />
          </div>
        )}
      </div>
      
      <button onClick={() => submitReview(category, priority, feedback, corrected)}>
        {corrected ? 'Submit Correction' : 'Confirm & Apply'}
      </button>
    </div>
  );
}
```

**Key Benefits:**
- Agent improves over time (not static)
- Human expertise captured and scaled
- Gradual shift from human-in-loop to human-on-loop
- Confidence thresholds ensure quality

---

### Pattern 4: Gradual Handoff

**Best For:** Transitioning from manual to automated over weeks/months

**Before: All Manual**
```
Week 1: Human does 100% → Error Rate: 12%
Week 12: Human does 100% → Error Rate: 12% (no improvement)
```

**After: Progressive Automation**
```
Week 1: Agent observes (0% autonomy) → Learning
Week 2-3: Agent suggests (25% autonomy) → Human reviews every action
Week 4-6: Agent acts on low-risk (50% autonomy) → Human reviews exceptions
Week 7-10: Agent acts on medium-risk (75% autonomy) → Spot checks
Week 11+: Agent acts on high-confidence (90% autonomy) → Monthly audits
```

**Code Example:**

```typescript
// tools/gradual-handoff.ts

import { OpenClaw } from '@openclaw/core';
import { ProgressiveAutonomy } from '@openclaw/governance';

enum AutonomyLevel {
  OBSERVE = 0,    // Agent watches, doesn't act
  SUGGEST = 25,   // Agent recommends, human must approve
  ASSIST = 50,    // Agent acts on low-risk, human reviews
  LEAD = 75,      // Agent acts on most, human spot checks
  AUTONOMOUS = 90, // Agent acts on high-confidence, periodic audit
}

class GradualHandoffController {
  private autonomy: ProgressiveAutonomy;
  
  constructor(private taskName: string) {
    this.autonomy = new ProgressiveAutonomy(taskName);
  }
  
  async handleTask(task: any) {
    const currentLevel = await this.autonomy.getCurrentLevel();
    
    switch (currentLevel) {
      case AutonomyLevel.OBSERVE:
        return await this.observeMode(task);
      
      case AutonomyLevel.SUGGEST:
        return await this.suggestMode(task);
      
      case AutonomyLevel.ASSIST:
        return await this.assistMode(task);
      
      case AutonomyLevel.LEAD:
        return await this.leadMode(task);
      
      case AutonomyLevel.AUTONOMOUS:
        return await this.autonomousMode(task);
    }
  }
  
  private async observeMode(task: any) {
    // Agent watches human perform task
    const agent = new OpenClaw();
    
    // Log human actions for learning
    await agent.observe({
      task: task,
      humanActions: task.humanPerformedActions,
      outcome: task.outcome,
    });
    
    // Agent might suggest improvements (but doesn't act)
    const suggestion = await agent.think({
      task: 'analyze_workflow',
      humanActions: task.humanPerformedActions,
      outcome: task.outcome,
    });
    
    if (suggestion.hasImprovement) {
      await this.logSuggestion(suggestion);
    }
    
    return {
      autonomyLevel: 'OBSERVE',
      agentAction: 'none',
      suggestion: suggestion,
    };
  }
  
  private async suggestMode(task: any) {
    // Agent proposes action, human must approve
    const agent = new OpenClaw();
    
    const proposal = await agent.plan({
      task: task,
      context: await this.gatherContext(task),
    });
    
    const approval = await this.requestHumanApproval({
      task: task,
      agentProposal: proposal,
      allowedActions: ['approve', 'deny', 'modify'],
    });
    
    if (approval.status === 'approved') {
      const result = await agent.execute(proposal);
      
      await this.autonomy.recordSuccess({
        task: task,
        proposal: proposal,
        result: result,
      });
      
      return { autonomyLevel: 'SUGGEST', executed: true, result };
    } else {
      await this.autonomy.recordRejection({
        task: task,
        proposal: proposal,
        reason: approval.reason,
      });
      
      return { autonomyLevel: 'SUGGEST', executed: false, reason: approval.reason };
    }
  }
  
  private async assistMode(task: any) {
    // Agent acts on low-risk, escalates high-risk
    const agent = new OpenClaw();
    
    const plan = await agent.plan({
      task: task,
      context: await this.gatherContext(task),
    });
    
    // Risk assessment
    const risk = await this.assessRisk(task, plan);
    
    if (risk.score < 3) {
      // Low risk - agent acts autonomously
      const result = await agent.execute(plan);
      
      // Log for periodic human review
      await this.autonomy.logAction({
        task: task,
        plan: plan,
        result: result,
        risk: risk,
        reviewRequired: false,
      });
      
      return { autonomyLevel: 'ASSIST', executed: true, reviewRequired: false };
    } else {
      // High risk - escalate to human
      const approval = await this.requestHumanApproval({
        task: task,
        agentProposal: plan,
        riskScore: risk.score,
      });
      
      if (approval.status === 'approved') {
        const result = await agent.execute(plan);
        return { autonomyLevel: 'ASSIST', executed: true, reviewRequired: true };
      } else {
        return { autonomyLevel: 'ASSIST', executed: false, escalated: true };
      }
    }
  }
  
  private async leadMode(task: any) {
    // Agent acts on most tasks, human spot checks
    const agent = new OpenClaw();
    
    const plan = await agent.plan({
      task: task,
      context: await this.gatherContext(task),
    });
    
    // Execute immediately (async)
    const result = await agent.execute(plan);
    
    // Randomly sample for human review (10% of tasks)
    if (Math.random() < 0.1) {
      await this.requestPostHocReview({
        task: task,
        plan: plan,
        result: result,
        message: 'Random spot check - was this correct?',
      });
    }
    
    return { autonomyLevel: 'LEAD', executed: true, spotCheck: Math.random() < 0.1 };
  }
  
  private async autonomousMode(task: any) {
    // Agent acts fully autonomously
    const agent = new OpenClaw();
    
    const plan = await agent.plan({
      task: task,
      context: await this.gatherContext(task),
    });
    
    const result = await agent.execute(plan);
    
    // Monthly audit (not real-time review)
    await this.autonomy.logForMonthlyAudit({
      task: task,
      plan: plan,
      result: result,
      timestamp: new Date(),
    });
    
    return { autonomyLevel: 'AUTONOMOUS', executed: true };
  }
  
  // Progression logic
  async checkForLevelUp() {
    const metrics = await this.autonomy.getMetrics();
    
    // Criteria for advancing autonomy level
    const criteria = {
      tasksCompleted: 50,        // Minimum sample size
      errorRate: 0.05,           // <5% error rate
      humanApprovalRate: 0.95,   // >95% of suggestions approved
      timeInCurrentLevel: 14,    // Days
    };
    
    if (
      metrics.tasksCompleted >= criteria.tasksCompleted &&
      metrics.errorRate <= criteria.errorRate &&
      metrics.humanApprovalRate >= criteria.humanApprovalRate &&
      metrics.daysInLevel >= criteria.timeInCurrentLevel
    ) {
      await this.autonomy.levelUp();
      
      await this.notifyStakeholders({
        message: `Agent autonomy increased to ${this.autonomy.getCurrentLevel()}%`,
        metrics: metrics,
        nextReview: this.autonomy.getNextReviewDate(),
      });
    }
  }
}
```

**Autonomy Tracking Dashboard:**

```typescript
// ui/autonomy-dashboard.tsx

function AutonomyDashboard({ taskName }) {
  const autonomy = useAutonomyMetrics(taskName);
  
  return (
    <div className="dashboard">
      <h2>Gradual Handoff Progress: {taskName}</h2>
      
      <div className="current-level">
        <h3>Current Autonomy Level: {autonomy.currentLevel}%</h3>
        <ProgressBar value={autonomy.currentLevel} max={100} />
      </div>
      
      <div className="metrics">
        <MetricCard 
          title="Tasks Completed" 
          value={autonomy.tasksCompleted}
          target={50}
        />
        <MetricCard 
          title="Error Rate" 
          value={`${(autonomy.errorRate * 100).toFixed(1)}%`}
          target="<5%"
          status={autonomy.errorRate < 0.05 ? 'good' : 'needs-work'}
        />
        <MetricCard 
          title="Human Approval Rate" 
          value={`${(autonomy.humanApprovalRate * 100).toFixed(1)}%`}
          target=">95%"
          status={autonomy.humanApprovalRate > 0.95 ? 'good' : 'needs-work'}
        />
        <MetricCard 
          title="Time in Current Level" 
          value={`${autonomy.daysInLevel} days`}
          target="14 days minimum"
        />
      </div>
      
      <div className="timeline">
        <h3>Progression Timeline</h3>
        <Timeline events={[
          { date: '2026-01-01', level: 'OBSERVE', milestone: 'Agent started observing' },
          { date: '2026-01-15', level: 'SUGGEST', milestone: 'Promoted to suggest mode' },
          { date: '2026-02-01', level: 'ASSIST', milestone: 'Now handling low-risk tasks' },
          { date: '2026-02-20', level: 'ASSIST', milestone: 'Still in assist mode (error rate improving)' },
          { date: '2026-03-01', level: 'LEAD', milestone: 'Promoted to lead mode', projected: true },
        ]} />
      </div>
      
      <div className="next-level">
        <h3>Requirements for Next Level ({getNextLevel(autonomy.currentLevel)})</h3>
        <Checklist items={[
          { 
            label: 'Complete 50 tasks in current level',
            status: autonomy.tasksCompleted >= 50,
            current: autonomy.tasksCompleted,
          },
          {
            label: 'Error rate below 5%',
            status: autonomy.errorRate < 0.05,
            current: `${(autonomy.errorRate * 100).toFixed(1)}%`,
          },
          {
            label: 'Human approval rate above 95%',
            status: autonomy.humanApprovalRate > 0.95,
            current: `${(autonomy.humanApprovalRate * 100).toFixed(1)}%`,
          },
          {
            label: 'Minimum 14 days in current level',
            status: autonomy.daysInLevel >= 14,
            current: `${autonomy.daysInLevel} days`,
          },
        ]} />
      </div>
      
      <button onClick={() => manualLevelUp()}>
        Request Early Level Up (requires justification)
      </button>
    </div>
  );
}
```

**Key Benefits:**
- Risk is gradually introduced (not all at once)
- Clear progression criteria (objective, measurable)
- Stakeholders build trust over time
- Rollback to lower autonomy if quality degrades

---

## Human Oversight Integration

### Approval Workflow Design

**Principles:**
1. **Async by default** - Don't block the agent waiting for approval
2. **Context-rich** - Give approvers all info they need
3. **Low friction** - One-click approve/deny
4. **Audit trail** - Log who approved what and why

**Multi-Channel Approval:**

```typescript
// integrations/multi-channel-approval.ts

import { ApprovalGateway } from '@openclaw/governance';

// Register handlers for different channels
ApprovalGateway.registerHandler({
  channel: 'slack',
  handler: async (request) => {
    // Slack button interface (see Pattern 1 example)
  },
});

ApprovalGateway.registerHandler({
  channel: 'email',
  handler: async (request) => {
    await sendEmail({
      to: request.approvers,
      subject: `Approval Required: ${request.summary}`,
      body: renderEmailTemplate(request),
      replyToActions: true, // Email replies map to approve/deny
    });
  },
});

ApprovalGateway.registerHandler({
  channel: 'discord',
  handler: async (request) => {
    await discord.sendMessage({
      channelId: request.approvalChannel,
      content: `<@${request.approverId}> Approval needed:`,
      embeds: [createApprovalEmbed(request)],
      components: [createApprovalButtons(request)],
    });
  },
});

ApprovalGateway.registerHandler({
  channel: 'web_ui',
  handler: async (request) => {
    // Push to web dashboard
    await pushToApprovalQueue(request);
    
    // Send browser notification if user is online
    if (await isUserOnline(request.approverId)) {
      await sendBrowserNotification({
        title: 'Approval Required',
        body: request.summary,
        url: `/approvals/${request.id}`,
      });
    }
  },
});
```

**Escalation Ladder:**

```typescript
// governance/escalation-ladder.ts

interface EscalationRule {
  condition: (request: ApprovalRequest) => boolean;
  escalateTo: string[];
  timeoutMs: number;
}

const escalationRules: EscalationRule[] = [
  // Rule 1: High-value transactions escalate to finance
  {
    condition: (req) => req.metadata.amount > 10000,
    escalateTo: ['finance-team@company.com'],
    timeoutMs: 4 * 60 * 60 * 1000, // 4 hours
  },
  
  // Rule 2: If primary approver doesn't respond in 1 hour, escalate to manager
  {
    condition: (req) => Date.now() - req.createdAt > 60 * 60 * 1000 && !req.responded,
    escalateTo: ['manager@company.com'],
    timeoutMs: 2 * 60 * 60 * 1000, // 2 more hours
  },
  
  // Rule 3: If nobody responds in 3 hours and it's urgent, page on-call
  {
    condition: (req) => 
      req.priority === 'urgent' && 
      Date.now() - req.createdAt > 3 * 60 * 60 * 1000 && 
      !req.responded,
    escalateTo: ['pagerduty:on-call'],
    timeoutMs: 30 * 60 * 1000, // 30 minutes
  },
];

async function checkEscalations() {
  const pendingApprovals = await ApprovalGateway.getPending();
  
  for (const request of pendingApprovals) {
    for (const rule of escalationRules) {
      if (rule.condition(request) && !request.escalated) {
        await ApprovalGateway.escalate({
          requestId: request.id,
          escalateTo: rule.escalateTo,
          reason: 'Timeout exceeded',
          originalApprovers: request.approvers,
        });
        
        request.escalated = true;
      }
    }
  }
}

// Run every 5 minutes
setInterval(checkEscalations, 5 * 60 * 1000);
```

### Override Mechanisms

**Emergency Stop (Kill Switch):**

```typescript
// governance/kill-switch.ts

class AgentKillSwitch {
  private static instance: AgentKillSwitch;
  private killed = false;
  
  static async activate(reason: string, authorizedBy: string) {
    this.instance.killed = true;
    
    // Stop all running agents
    await AgentOrchestrator.stopAll({ reason: 'KILL_SWITCH_ACTIVATED' });
    
    // Log to audit trail
    await AuditLog.write({
      event: 'KILL_SWITCH_ACTIVATED',
      reason: reason,
      authorizedBy: authorizedBy,
      timestamp: new Date(),
      impact: 'ALL_AGENTS_STOPPED',
    });
    
    // Alert all stakeholders
    await notifyAllStakeholders({
      priority: 'CRITICAL',
      subject: '🚨 Agent Kill Switch Activated',
      body: `All agents have been stopped. Reason: ${reason}`,
      authorizedBy: authorizedBy,
    });
  }
  
  static async deactivate(authorizedBy: string) {
    // Require multiple approvers to reactivate
    const approvals = await requestMultiApproval({
      action: 'REACTIVATE_AGENTS',
      requiredApprovers: ['cto@company.com', 'security@company.com'],
      reason: 'Kill switch deactivation',
    });
    
    if (approvals.allApproved) {
      this.instance.killed = false;
      
      await AuditLog.write({
        event: 'KILL_SWITCH_DEACTIVATED',
        authorizedBy: authorizedBy,
        approvals: approvals,
        timestamp: new Date(),
      });
    }
  }
  
  static isActive(): boolean {
    return this.instance.killed;
  }
}

// Agents check kill switch before every action
async function executeAgentAction(action: Action) {
  if (AgentKillSwitch.isActive()) {
    throw new Error('Agent execution blocked: Kill switch is active');
  }
  
  // Proceed with action...
}
```

**Human Takeover:**

```typescript
// governance/human-takeover.ts

class HumanTakeover {
  async initiateIntercept(agentSessionId: string, humanUserId: string) {
    const session = await AgentSession.get(agentSessionId);
    
    // Pause agent
    await session.pause({ reason: 'HUMAN_INTERCEPT' });
    
    // Get current state
    const state = await session.getState();
    
    // Transfer context to human
    const humanInterface = await this.createHumanInterface({
      sessionState: state,
      agentPlan: session.getCurrentPlan(),
      executedSteps: session.getExecutedSteps(),
      pendingSteps: session.getPendingSteps(),
    });
    
    // Human can now:
    // 1. Review what agent has done
    // 2. Modify the plan
    // 3. Execute steps manually
    // 4. Hand back to agent
    
    return {
      interface: humanInterface,
      sessionId: agentSessionId,
      status: 'HUMAN_IN_CONTROL',
    };
  }
  
  async handBackToAgent(sessionId: string, modifications: any) {
    const session = await AgentSession.get(sessionId);
    
    // Update plan with human modifications
    if (modifications.plan) {
      await session.updatePlan(modifications.plan);
    }
    
    // Resume agent execution
    await session.resume({
      resumeFrom: modifications.resumeFrom || 'current',
      humanNotes: modifications.notes,
    });
    
    await AuditLog.write({
      event: 'AGENT_RESUMED_AFTER_HUMAN_INTERCEPT',
      sessionId: sessionId,
      modifications: modifications,
      timestamp: new Date(),
    });
  }
}
```

### Feedback Loops

**Capturing Human Corrections:**

```typescript
// governance/feedback-loop.ts

interface HumanCorrection {
  agentAction: Action;
  humanCorrection: Action;
  reason: string;
  category: 'wrong_tool' | 'wrong_params' | 'wrong_reasoning' | 'policy_violation';
  severity: 'minor' | 'major' | 'critical';
}

class FeedbackLoop {
  async recordCorrection(correction: HumanCorrection) {
    // Store correction
    await db.corrections.insert({
      ...correction,
      timestamp: new Date(),
    });
    
    // Analyze patterns
    const recentCorrections = await db.corrections
      .where({ category: correction.category })
      .limit(100)
      .orderBy('timestamp', 'desc')
      .execute();
    
    // If same mistake happening frequently, alert
    if (recentCorrections.length > 10) {
      await this.alertStakeholders({
        issue: `Repeated errors in category: ${correction.category}`,
        count: recentCorrections.length,
        examples: recentCorrections.slice(0, 3),
        recommendation: 'Consider retraining or updating policy',
      });
    }
    
    // Update agent prompt/policy
    if (correction.severity === 'critical') {
      await this.updateAgentGuidance({
        category: correction.category,
        newGuidance: `IMPORTANT: ${correction.reason}`,
        examples: [
          {
            wrong: correction.agentAction,
            correct: correction.humanCorrection,
          },
        ],
      });
    }
  }
  
  async getInsights() {
    // Generate insights from correction patterns
    const corrections = await db.corrections
      .where({ timestamp: { gte: thirtyDaysAgo() } })
      .execute();
    
    const insights = {
      topCategories: this.groupBy(corrections, 'category'),
      topTools: this.groupBy(corrections, 'agentAction.tool'),
      improvementTrend: this.calculateTrend(corrections),
      recommendations: this.generateRecommendations(corrections),
    };
    
    return insights;
  }
}
```

---

## Rollback Procedures

### State Snapshots

**Before/After Snapshots:**

```typescript
// governance/state-snapshot.ts

class StateSnapshot {
  async createSnapshot(context: any): Promise<string> {
    const snapshot = {
      timestamp: new Date(),
      context: context,
      checksum: this.calculateChecksum(context),
    };
    
    const snapshotId = await db.snapshots.insert(snapshot);
    
    return snapshotId;
  }
  
  async restore(snapshotId: string) {
    const snapshot = await db.snapshots.get(snapshotId);
    
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }
    
    // Verify integrity
    const currentChecksum = this.calculateChecksum(snapshot.context);
    if (currentChecksum !== snapshot.checksum) {
      throw new Error('Snapshot integrity check failed');
    }
    
    return snapshot.context;
  }
}

// Usage example
async function executeWithRollback(action: Action) {
  // Take snapshot before
  const snapshotId = await StateSnapshot.createSnapshot({
    database: await db.export(),
    externalSystems: await gatherExternalState(),
  });
  
  try {
    const result = await execute(action);
    return result;
  } catch (error) {
    // Rollback on error
    console.error('Action failed, rolling back...', error);
    await StateSnapshot.restore(snapshotId);
    throw error;
  }
}
```

### Undo Mechanisms

**Idempotent Actions:**

```typescript
// governance/idempotency.ts

class IdempotentActionExecutor {
  private executedActions = new Map<string, ActionResult>();
  
  async execute(action: Action, idempotencyKey: string): Promise<ActionResult> {
    // Check if already executed
    if (this.executedActions.has(idempotencyKey)) {
      return this.executedActions.get(idempotencyKey)!;
    }
    
    // Execute action
    const result = await this.doExecute(action);
    
    // Store result
    this.executedActions.set(idempotencyKey, result);
    
    // Store undo action if possible
    if (action.undoable) {
      await this.storeUndoAction(idempotencyKey, action, result);
    }
    
    return result;
  }
  
  async undo(idempotencyKey: string) {
    const undoAction = await db.undo_actions.get(idempotencyKey);
    
    if (!undoAction) {
      throw new Error(`No undo action found for ${idempotencyKey}`);
    }
    
    // Execute undo
    await this.doExecute(undoAction.action);
    
    // Remove from executed actions
    this.executedActions.delete(idempotencyKey);
    
    await AuditLog.write({
      event: 'ACTION_UNDONE',
      idempotencyKey: idempotencyKey,
      originalAction: undoAction.originalAction,
      timestamp: new Date(),
    });
  }
  
  private async storeUndoAction(key: string, original: Action, result: ActionResult) {
    const undoAction = this.generateUndoAction(original, result);
    
    await db.undo_actions.insert({
      idempotencyKey: key,
      originalAction: original,
      undoAction: undoAction,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });
  }
  
  private generateUndoAction(action: Action, result: ActionResult): Action {
    // Generate reverse action based on action type
    const undoMap = {
      'create_record': (a, r) => ({ type: 'delete_record', id: r.id }),
      'update_record': (a, r) => ({ type: 'update_record', id: a.id, data: r.previousData }),
      'delete_record': (a, r) => ({ type: 'create_record', data: r.deletedData }),
      'send_email': (a, r) => null, // Not undoable
      'charge_card': (a, r) => ({ type: 'refund_card', chargeId: r.chargeId }),
    };
    
    return undoMap[action.type]?.(action, result);
  }
}
```

**Compensation Actions:**

```typescript
// governance/compensation.ts

// For actions that can't be truly undone, define compensation
const compensationStrategies = {
  'send_email': async (original, result) => {
    // Can't unsend email, but can send clarification
    await sendEmail({
      to: original.recipient,
      subject: 'Correction: Previous Email',
      body: 'Please disregard our previous email. We are reviewing...',
    });
  },
  
  'post_social_media': async (original, result) => {
    // Delete the post
    await socialMedia.deletePost(result.postId);
    
    // Optionally post correction
    await socialMedia.createPost({
      content: 'We apologize for the previous post. It was sent in error.',
    });
  },
  
  'charge_customer': async (original, result) => {
    // Issue refund
    await payments.refund({
      chargeId: result.chargeId,
      amount: original.amount,
      reason: 'Agent error - refunding',
    });
    
    // Notify customer
    await notify({
      to: original.customerId,
      template: 'refund_issued',
      data: { amount: original.amount },
    });
  },
};
```

### Incident Response Playbooks

See Section 4 (Reference Architecture) for full incident response procedures.

**Quick Rollback Decision Tree:**

```
Error Detected
    |
    ├─ Critical (data loss, security breach, compliance violation)
    |   ├─ ACTIVATE KILL SWITCH
    |   ├─ Rollback to last known good state
    |   ├─ Page on-call team
    |   └─ Initiate incident response
    |
    ├─ High (customer impact, revenue impact)
    |   ├─ Pause affected agents
    |   ├─ Assess blast radius
    |   ├─ Rollback if safe, otherwise manual fix
    |   └─ Notify stakeholders
    |
    ├─ Medium (quality issues, minor bugs)
    |   ├─ Switch to human-approval mode
    |   ├─ Fix in next deployment
    |   └─ Monitor closely
    |
    └─ Low (cosmetic, performance)
        ├─ Log for later review
        ├─ Continue operations
        └─ Fix in backlog
```

---

## Progressive Autonomy Expansion

### Phase-Based Rollout

**Phase 1: Shadow Mode (Weeks 1-2)**
- Agent observes human workflow
- Agent suggests improvements (not shown to humans)
- Collect baseline metrics
- Goal: Understand the task

**Phase 2: Advisor Mode (Weeks 3-4)**
- Agent makes suggestions to humans
- Human decides whether to follow
- Track suggestion acceptance rate
- Goal: Build trust

**Phase 3: Supervised Mode (Weeks 5-8)**
- Agent acts with human approval
- Every action requires sign-off
- Collect quality metrics
- Goal: Prove reliability

**Phase 4: Assisted Mode (Weeks 9-12)**
- Agent acts on low-risk items
- Human reviews exceptions
- Spot check 20% of actions
- Goal: Scale efficiency

**Phase 5: Autonomous Mode (Week 13+)**
- Agent acts independently
- Human audits monthly
- Continuous monitoring
- Goal: Full automation

### Success Criteria Per Phase

```typescript
// governance/phase-criteria.ts

const phaseCriteria = {
  'shadow': {
    duration: 14, // days
    metrics: {
      observationCount: 100, // Observed 100+ human actions
      understandingScore: 0.8, // 80% accuracy in predicting human actions
    },
  },
  
  'advisor': {
    duration: 14,
    metrics: {
      suggestionCount: 50,
      acceptanceRate: 0.7, // 70% of suggestions accepted
      feedbackScore: 4.0, // out of 5
    },
  },
  
  'supervised': {
    duration: 28,
    metrics: {
      actionsCompleted: 100,
      errorRate: 0.05, // <5% errors
      approvalRate: 0.95, // 95% of proposals approved
      humanTime: 0.2, // Human time reduced to 20% of original
    },
  },
  
  'assisted': {
    duration: 28,
    metrics: {
      actionsCompleted: 500,
      errorRate: 0.02, // <2% errors
      escalationRate: 0.1, // Only 10% need human review
      humanTime: 0.05, // Human time reduced to 5%
    },
  },
  
  'autonomous': {
    duration: Infinity, // Ongoing
    metrics: {
      errorRate: 0.01, // <1% errors
      auditPassing: 0.99, // 99% pass monthly audit
      costPerAction: 'decreasing',
      humanSatisfaction: 4.5, // out of 5
    },
  },
};

async function checkPhaseProgression(currentPhase: string) {
  const criteria = phaseCriteria[currentPhase];
  const metrics = await getMetrics(currentPhase);
  
  const meetsAll = Object.keys(criteria.metrics).every(metric => {
    const target = criteria.metrics[metric];
    const actual = metrics[metric];
    
    if (typeof target === 'number') {
      return actual >= target;
    } else if (target === 'decreasing') {
      return metrics.trend[metric] < 0;
    }
    
    return false;
  });
  
  const durationMet = metrics.daysInPhase >= criteria.duration;
  
  if (meetsAll && durationMet) {
    return {
      readyForNextPhase: true,
      nextPhase: getNextPhase(currentPhase),
      metrics: metrics,
    };
  } else {
    return {
      readyForNextPhase: false,
      missingCriteria: Object.keys(criteria.metrics).filter(metric => {
        const target = criteria.metrics[metric];
        const actual = metrics[metric];
        return actual < target;
      }),
      metrics: metrics,
    };
  }
}
```

---

## Case Studies

### Case Study 1: Customer Support Automation

**Company:** B2B SaaS (500 employees)  
**Workflow:** Support ticket triage and response  
**Volume:** 500 tickets/day  
**Challenge:** High response time, inconsistent quality

**Before:**
- Average response time: 4 hours
- Quality score: 3.2/5
- Agent burnout: High
- Cost: $15/ticket

**Redesign Strategy:**
- Pattern: Request-Approve-Execute (for responses) + Supervised Learning
- Phase 1: Agent drafts responses, human reviews 100%
- Phase 2: Agent auto-responds to common issues, human reviews 20%
- Phase 3: Agent handles 80% autonomously

**After (6 months):**
- Average response time: 15 minutes
- Quality score: 4.1/5
- Agent burnout: Reduced (they handle edge cases only)
- Cost: $3/ticket

**Key Insights:**
- Quality actually improved because agent has perfect recall of knowledge base
- Humans focus on complex cases (more engaging)
- Confidence thresholds critical (agent escalates when uncertain)

### Case Study 2: Financial Reconciliation

**Company:** E-commerce (1000 employees)  
**Workflow:** Daily reconciliation of transactions  
**Volume:** 10,000 transactions/day  
**Challenge:** Manual process taking 6 hours daily, error-prone

**Before:**
- Time: 6 hours/day
- Error rate: 2% (200 errors daily)
- Cost: $500/day

**Redesign Strategy:**
- Pattern: Bounded Exploration (find discrepancies) + Human Oversight (resolve)
- Phase 1: Agent identifies discrepancies, human investigates all
- Phase 2: Agent categorizes discrepancies, auto-resolves low-risk
- Phase 3: Agent resolves 90%, human audits weekly

**After (4 months):**
- Time: 30 minutes/day (human review time)
- Error rate: 0.1% (10 errors daily, all flagged)
- Cost: $50/day

**Key Insights:**
- Agent finds patterns humans miss (systematic discrepancies)
- Weekly audits caught 2 bugs early (would have been disasters)
- ROI: 10x in 4 months

### Case Study 3: Content Moderation

**Company:** Social platform (200 employees)  
**Workflow:** Moderate user-reported content  
**Volume:** 5,000 reports/day  
**Challenge:** Slow moderation, PTSD risk for human moderators

**Before:**
- Time per report: 3 minutes
- Daily capacity: 2,000 reports (backlog growing)
- Moderator wellbeing: Poor

**Redesign Strategy:**
- Pattern: Supervised Learning + Gradual Handoff
- Phase 1: Agent handles clear-cut cases (obvious spam, duplicates)
- Phase 2: Agent handles low-risk categories (spam, self-promotion)
- Phase 3: Agent handles medium-risk (harassment detection)
- Never automate: CSAM, suicide/self-harm (always human + support)

**After (12 months):**
- Agent handles 70% of reports autonomously
- Human moderators focus on 30% (high-risk, edge cases)
- Backlog eliminated
- Moderator wellbeing: Improved (less traumatic content exposure)

**Key Insights:**
- Not all automation is desirable (some content should stay human-reviewed)
- Agent reduces moderator burnout by filtering obvious cases
- Continuous training critical (new abuse tactics emerge)

---

## Summary & Next Steps

### Key Takeaways

1. **Redesign Before Automate:** Fix the workflow before adding an agent
2. **Choose the Right Pattern:** Match pattern to risk profile
3. **Human Oversight is a Feature:** Not a sign of failure
4. **Start Slow, Expand Gradually:** Trust is earned, not assumed
5. **Measure Everything:** Metrics drive progression decisions

### Recommended Reading Order

1. Read this document (Workflow Redesign Patterns)
2. Read Section 2 (Governance-First Architecture) to implement policies
3. Read Section 3 (Production Readiness Checklist) before going live
4. Read Section 4 (Reference Architecture) for deployment blueprints

### Templates & Tools

- `templates/workflow-assessment.md` - Pre-automation assessment worksheet
- `examples/workflow-patterns/` - Code examples for each pattern
- `tools/autonomy-tracker` - CLI to track progressive rollout
- `ui/approval-dashboard` - Web UI for approval management

---

**Next:** [Governance-First Architecture →](./02-governance-architecture.md)

