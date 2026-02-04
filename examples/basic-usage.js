/**
 * Basic Usage Example - OpenClaw Production Toolkit
 * 
 * Demonstrates how to use the Production Agent wrapper to add
 * governance, identity, and audit trails to your OpenClaw agents.
 */

const ProductionAgent = require('../src/production-agent');
const path = require('path');

async function main() {
  console.log('=== OpenClaw Production Toolkit - Basic Usage ===\n');

  // Initialize a production-ready agent
  const agent = new ProductionAgent('customer-service-agent', {
    policyPath: path.join(__dirname, '../policies'),
    auditPath: path.join(__dirname, '../logs/audit'),
    identityPath: path.join(__dirname, '../identities'),
    name: 'Customer Service Bot',
    role: 'support',
    owner: 'support-team'
  });

  // Example 1: Allowed action
  console.log('Example 1: Reading customer data (ALLOWED)');
  const result1 = await agent.execute('read:customer_data', {
    customerId: 12345,
    requestedBy: 'user@example.com'
  }, async (context) => {
    // Your actual logic here
    return {
      customerId: context.customerId,
      name: 'John Doe',
      email: 'john@example.com',
      tier: 'premium'
    };
  });
  console.log('Result:', result1);
  console.log('');

  // Example 2: Denied action
  console.log('Example 2: Deleting customer data (DENIED)');
  const result2 = await agent.execute('delete:customer_data', {
    customerId: 12345
  });
  console.log('Result:', result2);
  console.log('');

  // Example 3: Action requiring escalation
  console.log('Example 3: Processing refund (ESCALATION REQUIRED)');
  const result3 = await agent.execute('refund_requests', {
    customerId: 12345,
    amount: 599.99,
    reason: 'Product defect'
  });
  console.log('Result:', result3);
  console.log('');

  // Example 4: Check permission without executing
  console.log('Example 4: Checking permissions before execution');
  const check = agent.checkPermission('update:ticket_status', { ticketId: 789 });
  console.log('Permission check:', check);
  console.log('');

  // Example 5: Get agent health status
  console.log('Example 5: Agent health check');
  const health = agent.healthCheck();
  console.log('Health:', health);
  console.log('');

  // Example 6: Query audit history
  console.log('Example 6: Audit history for this session');
  const history = agent.getAuditHistory({ limit: 10 });
  console.log(`Found ${history.length} audit entries`);
  if (history.length > 0) {
    console.log('Latest entry:', {
      type: history[history.length - 1].type,
      action: history[history.length - 1].action,
      timestamp: history[history.length - 1].timestamp
    });
  }
  console.log('');

  // Example 7: Get agent identity
  console.log('Example 7: Agent identity');
  const identity = agent.getIdentity();
  console.log('Identity:', {
    agentId: identity.agentId,
    status: identity.status,
    trustScore: identity.trustScore,
    metadata: identity.metadata
  });
  console.log('');

  // Example 8: Sign a message (for non-repudiation)
  console.log('Example 8: Message signing');
  const message = 'I approved refund #12345 for $599.99';
  const signature = agent.signMessage(message);
  console.log('Message:', message);
  console.log('Signature:', signature.substring(0, 50) + '...');
  console.log('');

  console.log('=== Examples Complete ===');
}

// Run examples
main().catch(console.error);
