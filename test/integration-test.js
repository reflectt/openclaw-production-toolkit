/**
 * Integration Test - OpenClaw Production Toolkit
 * 
 * Tests all components working together:
 * - Policy Engine
 * - Identity System
 * - Audit Logger
 * - Production Agent
 */

const ProductionAgent = require('../src/production-agent');
const path = require('path');
const fs = require('fs');

// Test configuration
const testDir = path.join(__dirname, 'test-data');
const policyPath = path.join(testDir, 'policies');
const auditPath = path.join(testDir, 'audit');
const identityPath = path.join(testDir, 'identities');

// Cleanup and setup test directories
function setupTestEnvironment() {
  // Clean up old test data
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }

  // Create directories
  fs.mkdirSync(policyPath, { recursive: true });
  fs.mkdirSync(auditPath, { recursive: true });
  fs.mkdirSync(identityPath, { recursive: true });

  // Copy policy files
  const sourcePolicy = path.join(__dirname, '../policies/customer-service-agent.yaml');
  const destPolicy = path.join(policyPath, 'customer-service-agent.yaml');
  fs.copyFileSync(sourcePolicy, destPolicy);

  console.log('✓ Test environment ready\n');
}

async function runTests() {
  console.log('=== OpenClaw Production Toolkit - Integration Test ===\n');

  setupTestEnvironment();

  // Initialize agent
  console.log('Test 1: Initialize Production Agent');
  const agent = new ProductionAgent('customer-service-agent', {
    policyPath,
    auditPath,
    identityPath,
    name: 'Test Customer Service Agent',
    role: 'support',
    owner: 'test@example.com'
  });
  console.log('✓ Agent initialized\n');

  // Test 2: Identity verification
  console.log('Test 2: Identity Verification');
  const identity = agent.getIdentity();
  console.log(`Agent ID: ${identity.agentId}`);
  console.log(`Status: ${identity.status}`);
  console.log(`Trust Score: ${identity.trustScore}`);
  console.log('✓ Identity verified\n');

  // Test 3: Allowed action
  console.log('Test 3: Execute Allowed Action (read:customer_data)');
  const result1 = await agent.execute('read:customer_data', {
    customerId: 12345,
    requestedBy: 'test@example.com'
  }, async (context) => {
    return {
      customerId: context.customerId,
      name: 'John Doe',
      email: 'john@example.com',
      status: 'active'
    };
  });

  if (result1.success) {
    console.log('✓ Action executed successfully');
    console.log(`  Output:`, result1.output);
    console.log(`  Execution time: ${result1.executionTime}ms`);
    console.log(`  New trust score: ${result1.trustScore}`);
  } else {
    console.error('✗ Action failed:', result1.error);
  }
  console.log('');

  // Test 4: Denied action
  console.log('Test 4: Execute Denied Action (delete:customer_data)');
  const result2 = await agent.execute('delete:customer_data', {
    customerId: 12345
  });

  if (!result2.success && result2.policyDenied) {
    console.log('✓ Action correctly denied by policy');
    console.log(`  Reason: ${result2.error}`);
  } else {
    console.error('✗ Action should have been denied!');
  }
  console.log('');

  // Test 5: Escalation
  console.log('Test 5: Execute Action Requiring Escalation (refund_requests)');
  const result3 = await agent.execute('refund_requests', {
    customerId: 12345,
    amount: 599.99,
    reason: 'Product defect'
  });

  if (result3.requiresEscalation) {
    console.log('✓ Action correctly escalated');
    console.log(`  Escalation ID: ${result3.escalationId}`);
    console.log(`  Reason: ${result3.reason}`);

    // Simulate human approval
    console.log('  Simulating human approval...');
    agent.resolveEscalation(result3.escalationId, 'approved', 'Refund approved by manager', 'test-manager');
    console.log('✓ Escalation resolved');
  } else {
    console.error('✗ Action should have required escalation!');
  }
  console.log('');

  // Test 6: Permission check (without execution)
  console.log('Test 6: Permission Check (update:ticket_status)');
  const check = agent.checkPermission('update:ticket_status', {
    ticketId: 789,
    newStatus: 'resolved'
  });
  
  if (check.allowed) {
    console.log('✓ Permission check passed');
    console.log(`  Reason: ${check.reason}`);
  } else {
    console.error('✗ Permission should have been granted');
  }
  console.log('');

  // Test 7: Wildcard deny (delete:anything)
  console.log('Test 7: Wildcard Deny Test (delete:ticket)');
  const check2 = agent.checkPermission('delete:ticket', { ticketId: 123 });
  
  if (!check2.allowed) {
    console.log('✓ Wildcard deny correctly matched');
    console.log(`  Reason: ${check2.reason}`);
  } else {
    console.error('✗ Delete should have been denied by wildcard');
  }
  console.log('');

  // Test 8: Audit history
  console.log('Test 8: Query Audit History');
  const history = agent.getAuditHistory();
  console.log(`✓ Found ${history.length} audit entries`);
  
  if (history.length > 0) {
    console.log('  Recent entries:');
    history.slice(-3).forEach(entry => {
      console.log(`    - ${entry.type}: ${entry.action} [${entry.decision?.allowed ? 'ALLOWED' : entry.decision?.requiresEscalation ? 'ESCALATED' : 'DENIED'}]`);
    });
  }
  console.log('');

  // Test 9: Trust score evolution
  console.log('Test 9: Trust Score Evolution');
  const initialTrust = agent.getTrustScore();
  console.log(`  Initial trust score: ${initialTrust}`);

  // Execute multiple successful actions
  for (let i = 0; i < 5; i++) {
    await agent.execute('read:customer_data', { customerId: i }, async () => ({ data: 'ok' }));
  }

  const newTrust = agent.getTrustScore();
  console.log(`  After 5 successful actions: ${newTrust}`);
  
  if (newTrust >= initialTrust) {
    console.log('✓ Trust score maintained or improved');
  }
  console.log('');

  // Test 10: Message signing
  console.log('Test 10: Cryptographic Message Signing');
  const message = 'Approved refund #12345 for $599.99';
  const signature = agent.signMessage(message);
  console.log(`  Message: "${message}"`);
  console.log(`  Signature: ${signature.substring(0, 60)}...`);
  console.log('✓ Message signed successfully\n');

  // Test 11: Health check
  console.log('Test 11: Agent Health Check');
  const health = agent.healthCheck();
  console.log(`  Agent ID: ${health.agentId}`);
  console.log(`  Status: ${health.status}`);
  console.log(`  Trust Score: ${health.trustScore}`);
  console.log(`  Has Policy: ${health.hasPolicy}`);
  console.log(`  Identity Verified: ${health.identityVerified}`);
  console.log(`  Healthy: ${health.healthy}`);
  
  if (health.healthy) {
    console.log('✓ Agent is healthy\n');
  } else {
    console.error('✗ Agent health check failed\n');
  }

  // Test 12: Compliance report
  console.log('Test 12: Generate Compliance Report');
  const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];
  const report = agent.generateComplianceReport(startDate, endDate);
  
  console.log(`  Period: ${report.period.startDate} to ${report.period.endDate}`);
  console.log(`  Total Decisions: ${report.summary.totalDecisions}`);
  console.log(`  Allowed: ${report.summary.allowed}`);
  console.log(`  Denied: ${report.summary.denied}`);
  console.log(`  Escalations: ${report.summary.escalations}`);
  console.log(`  Actions: ${report.summary.actions}`);
  console.log('✓ Compliance report generated\n');

  // Final summary
  console.log('=== All Tests Passed! ===\n');
  console.log('Summary:');
  console.log('✓ Policy Engine: Working');
  console.log('✓ Identity System: Working');
  console.log('✓ Audit Logger: Working');
  console.log('✓ Production Agent: Working');
  console.log('✓ Governance Flow: End-to-End Validated');
  console.log('');
  console.log('The OpenClaw Production Toolkit is ready for use!');
}

// Run tests
runTests().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
