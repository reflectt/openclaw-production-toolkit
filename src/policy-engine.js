/**
 * OpenClaw Production Toolkit - Policy Engine
 * 
 * Security-first policy enforcement OUTSIDE LLM control.
 * Implements Cedar-like declarative permissions that prompt injection cannot bypass.
 * 
 * Core Principles:
 * - Declarative YAML policies (not LLM-controlled)
 * - Fail-secure by default (deny unless explicitly allowed)
 * - Immutable audit trail of all decisions
 * - Zero Trust verification on every action
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const crypto = require('crypto');

class PolicyEngine {
  constructor(policyPath, auditLogger) {
    this.policyPath = policyPath;
    this.auditLogger = auditLogger;
    this.policies = new Map();
    this.loadPolicies();
  }

  /**
   * Load all policy files from policy directory
   */
  loadPolicies() {
    try {
      const policyFiles = fs.readdirSync(this.policyPath)
        .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      for (const file of policyFiles) {
        const fullPath = path.join(this.policyPath, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        const policy = yaml.load(content);
        
        if (!policy.agent) {
          throw new Error(`Policy file ${file} missing required 'agent' field`);
        }

        this.policies.set(policy.agent, policy);
        console.log(`✓ Loaded policy for agent: ${policy.agent}`);
      }

      console.log(`Loaded ${this.policies.size} agent policies`);
    } catch (error) {
      console.error('Failed to load policies:', error.message);
      throw error;
    }
  }

  /**
   * Reload policies from disk (for hot-reloading)
   */
  reloadPolicies() {
    this.policies.clear();
    this.loadPolicies();
  }

  /**
   * Check if an action is allowed for an agent
   * 
   * @param {string} agentId - Agent identifier
   * @param {string} action - Action in format "verb:resource" (e.g., "read:customer_data")
   * @param {object} context - Additional context (user, amount, etc.)
   * @returns {object} - {allowed: boolean, reason: string, requiresEscalation: boolean}
   */
  checkPermission(agentId, action, context = {}) {
    const startTime = Date.now();
    
    // Get policy for this agent
    const policy = this.policies.get(agentId);
    
    if (!policy) {
      const result = {
        allowed: false,
        reason: `No policy found for agent: ${agentId}`,
        requiresEscalation: false
      };
      
      this.auditLogger.logDecision(agentId, action, context, result, Date.now() - startTime);
      return result;
    }

    // Check escalation rules first (these override allow/deny)
    if (policy.permissions?.escalate) {
      const escalation = this.checkEscalation(policy.permissions.escalate, action, context);
      if (escalation.requiresEscalation) {
        this.auditLogger.logDecision(agentId, action, context, escalation, Date.now() - startTime);
        return escalation;
      }
    }

    // Check deny rules (explicit denies override allows)
    if (policy.permissions?.deny) {
      const denied = this.matchesRules(action, policy.permissions.deny, context);
      if (denied.matches) {
        const result = {
          allowed: false,
          reason: `Action explicitly denied by policy rule: ${denied.rule}`,
          requiresEscalation: false
        };
        
        this.auditLogger.logDecision(agentId, action, context, result, Date.now() - startTime);
        return result;
      }
    }

    // Check allow rules
    if (policy.permissions?.allow) {
      const allowed = this.matchesRules(action, policy.permissions.allow, context);
      if (allowed.matches) {
        const result = {
          allowed: true,
          reason: `Action allowed by policy rule: ${allowed.rule}`,
          requiresEscalation: false
        };
        
        this.auditLogger.logDecision(agentId, action, context, result, Date.now() - startTime);
        return result;
      }
    }

    // Default deny (fail-secure)
    const result = {
      allowed: false,
      reason: 'Action not explicitly allowed (default deny)',
      requiresEscalation: false
    };
    
    this.auditLogger.logDecision(agentId, action, context, result, Date.now() - startTime);
    return result;
  }

  /**
   * Check if action requires escalation to human
   */
  checkEscalation(escalationRules, action, context) {
    for (const rule of escalationRules) {
      // Simple string match
      if (typeof rule === 'string') {
        if (this.matchesPattern(action, rule)) {
          return {
            allowed: false,
            reason: `Action requires human escalation: ${rule}`,
            requiresEscalation: true,
            escalationRule: rule
          };
        }
      }
      
      // Conditional escalation (e.g., "refund_requests > $500")
      if (typeof rule === 'object') {
        const matched = this.matchesConditional(rule, action, context);
        if (matched) {
          return {
            allowed: false,
            reason: `Action requires human escalation: ${JSON.stringify(rule)}`,
            requiresEscalation: true,
            escalationRule: rule
          };
        }
      }
    }

    return { requiresEscalation: false };
  }

  /**
   * Check if action matches any rule in a list
   */
  matchesRules(action, rules, context) {
    for (const rule of rules) {
      if (this.matchesPattern(action, rule)) {
        return { matches: true, rule };
      }
    }
    return { matches: false };
  }

  /**
   * Pattern matching with wildcards
   * Supports: exact match, prefix* wildcard, *suffix wildcard, *
   */
  matchesPattern(action, pattern) {
    // Exact match
    if (action === pattern) return true;

    // Wildcard *
    if (pattern === '*') return true;

    // Prefix wildcard: "read:*"
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return action.startsWith(prefix);
    }

    // Suffix wildcard: "*:customer_data"
    if (pattern.startsWith('*')) {
      const suffix = pattern.slice(1);
      return action.endsWith(suffix);
    }

    return false;
  }

  /**
   * Match conditional rules (e.g., amount > 500)
   */
  matchesConditional(rule, action, context) {
    // Example: { action: "refund", condition: "amount > 500" }
    if (rule.action && !this.matchesPattern(action, rule.action)) {
      return false;
    }

    if (rule.condition) {
      // Simple condition parser (extend as needed)
      return this.evaluateCondition(rule.condition, context);
    }

    return false;
  }

  /**
   * Simple condition evaluator
   */
  evaluateCondition(condition, context) {
    // Parse simple conditions like "amount > 500"
    const match = condition.match(/(\w+)\s*([><=!]+)\s*(.+)/);
    if (!match) return false;

    const [, field, operator, valueStr] = match;
    const contextValue = context[field];
    const value = parseFloat(valueStr.replace(/[$,]/g, ''));

    if (contextValue === undefined) return false;

    switch (operator) {
      case '>': return parseFloat(contextValue) > value;
      case '<': return parseFloat(contextValue) < value;
      case '>=': return parseFloat(contextValue) >= value;
      case '<=': return parseFloat(contextValue) <= value;
      case '==': return contextValue == value;
      case '!=': return contextValue != value;
      default: return false;
    }
  }

  /**
   * Get policy summary for an agent
   */
  getPolicyFor(agentId) {
    return this.policies.get(agentId);
  }

  /**
   * List all loaded agents
   */
  listAgents() {
    return Array.from(this.policies.keys());
  }
}

module.exports = PolicyEngine;
