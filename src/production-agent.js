/**
 * OpenClaw Production Toolkit - Production Agent Wrapper
 * 
 * Main integration layer for OpenClaw agents.
 * Wraps agent actions with governance, identity verification, and audit trails.
 * 
 * Usage:
 *   const ProductionAgent = require('./production-agent');
 *   const agent = new ProductionAgent('customer-service-agent', options);
 *   
 *   const result = await agent.execute('update:ticket_status', { ticketId: 123, status: 'resolved' });
 */

const PolicyEngine = require('./policy-engine');
const AuditLogger = require('./audit-logger');
const IdentitySystem = require('./identity-system');
const path = require('path');

class ProductionAgent {
  constructor(agentId, options = {}) {
    this.agentId = agentId;
    this.options = {
      policyPath: options.policyPath || path.join(process.cwd(), 'policies'),
      auditPath: options.auditPath || path.join(process.cwd(), 'logs', 'audit'),
      identityPath: options.identityPath || path.join(process.cwd(), 'identities'),
      requireSignature: options.requireSignature || false,
      autoCreateIdentity: options.autoCreateIdentity !== false,
      ...options
    };

    this.initialize();
  }

  /**
   * Initialize the production agent
   */
  initialize() {
    // Initialize audit logger first (needed by other components)
    this.auditLogger = new AuditLogger(this.options.auditPath, {
      retentionDays: this.options.retentionDays
    });

    // Initialize identity system
    this.identitySystem = new IdentitySystem(this.options.identityPath, this.auditLogger);

    // Initialize policy engine
    this.policyEngine = new PolicyEngine(this.options.policyPath, this.auditLogger);

    // Ensure agent has an identity
    this.ensureIdentity();

    console.log(`✓ Production agent initialized: ${this.agentId}`);
  }

  /**
   * Ensure agent has an identity (create if missing)
   */
  ensureIdentity() {
    const identity = this.identitySystem.getIdentity(this.agentId);

    if (!identity && this.options.autoCreateIdentity) {
      this.identitySystem.createIdentity(this.agentId, {
        name: this.options.name || this.agentId,
        role: this.options.role || 'agent',
        owner: this.options.owner,
        createdBy: 'auto'
      });
    } else if (!identity) {
      throw new Error(`No identity found for agent ${this.agentId} and autoCreateIdentity is false`);
    }
  }

  /**
   * Execute an action with full governance
   * 
   * @param {string} action - Action in format "verb:resource" (e.g., "read:customer_data")
   * @param {object} context - Action context (data, parameters, etc.)
   * @param {function} executor - Optional executor function that performs the actual action
   * @returns {object} - Execution result
   */
  async execute(action, context = {}, executor = null) {
    const startTime = Date.now();

    try {
      // Step 1: Verify identity
      const identityCheck = this.verifyIdentity(context);
      
      if (!identityCheck.verified) {
        return {
          success: false,
          error: `Identity verification failed: ${identityCheck.reason}`,
          trustScore: identityCheck.trustScore
        };
      }

      // Step 2: Check policy
      const policyCheck = this.policyEngine.checkPermission(this.agentId, action, context);

      // Handle escalation
      if (policyCheck.requiresEscalation) {
        const escalationId = this.auditLogger.logEscalation(
          this.agentId,
          action,
          context,
          policyCheck.reason,
          this.options.escalationHandler || 'human-review'
        );

        return {
          success: false,
          requiresEscalation: true,
          escalationId,
          reason: policyCheck.reason,
          escalationRule: policyCheck.escalationRule
        };
      }

      // Handle denial
      if (!policyCheck.allowed) {
        return {
          success: false,
          error: policyCheck.reason,
          policyDenied: true
        };
      }

      // Step 3: Execute the action (if executor provided)
      let result = { success: true };
      
      if (executor && typeof executor === 'function') {
        try {
          const output = await executor(context);
          result = {
            success: true,
            output
          };
        } catch (error) {
          result = {
            success: false,
            error: error.message
          };
        }
      }

      // Step 4: Log the action
      this.auditLogger.logAction(this.agentId, action, context, result);

      // Step 5: Update trust score
      if (result.success) {
        this.identitySystem.incrementTrustScore(this.agentId, 1, 'Successful action');
      } else {
        this.identitySystem.decrementTrustScore(this.agentId, 5, 'Failed action');
      }

      // Add execution metadata
      result.executionTime = Date.now() - startTime;
      result.agentId = this.agentId;
      result.trustScore = this.identitySystem.getTrustScore(this.agentId);

      return result;

    } catch (error) {
      console.error(`Error executing action ${action}:`, error);
      
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Verify identity for this execution
   */
  verifyIdentity(context) {
    const credentials = {};

    // If signature required, verify it
    if (this.options.requireSignature && context.signature) {
      credentials.signature = context.signature;
      credentials.message = context.message || JSON.stringify(context);
    }

    return this.identitySystem.verifyIdentity(this.agentId, credentials);
  }

  /**
   * Check if an action is allowed (without executing)
   */
  checkPermission(action, context = {}) {
    return this.policyEngine.checkPermission(this.agentId, action, context);
  }

  /**
   * Get current policy for this agent
   */
  getPolicy() {
    return this.policyEngine.getPolicyFor(this.agentId);
  }

  /**
   * Get identity information
   */
  getIdentity() {
    return this.identitySystem.getIdentity(this.agentId);
  }

  /**
   * Get trust score
   */
  getTrustScore() {
    return this.identitySystem.getTrustScore(this.agentId);
  }

  /**
   * Sign a message (for non-repudiation)
   */
  signMessage(message) {
    return this.identitySystem.signMessage(this.agentId, message);
  }

  /**
   * Query audit logs for this agent
   */
  getAuditHistory(filters = {}) {
    return this.auditLogger.query({
      agentId: this.agentId,
      ...filters
    });
  }

  /**
   * Generate compliance report
   */
  generateComplianceReport(startDate, endDate) {
    return this.auditLogger.generateComplianceReport(startDate, endDate);
  }

  /**
   * Resolve an escalation (typically called by human reviewer)
   */
  resolveEscalation(escalationId, decision, notes, resolvedBy = 'human') {
    this.auditLogger.logEscalationResolution(escalationId, resolvedBy, decision, notes);
    
    return {
      success: true,
      escalationId,
      decision,
      resolvedBy
    };
  }

  /**
   * Reload policies (for hot-reloading)
   */
  reloadPolicies() {
    this.policyEngine.reloadPolicies();
  }

  /**
   * Health check
   */
  healthCheck() {
    const identity = this.getIdentity();
    const policy = this.getPolicy();
    const trustScore = this.getTrustScore();

    return {
      agentId: this.agentId,
      status: identity?.status || 'unknown',
      trustScore,
      hasPolicy: !!policy,
      identityVerified: !!identity,
      healthy: !!(identity && policy && trustScore > 50)
    };
  }
}

module.exports = ProductionAgent;
