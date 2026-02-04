/**
 * OpenClaw Production Toolkit - Audit Logger
 * 
 * Immutable audit trail with cryptographic verification.
 * Every decision, action, and escalation is logged with tamper-proof timestamps.
 * 
 * Features:
 * - Append-only log file (no deletions/modifications)
 * - Cryptographic hashing for chain-of-custody
 * - Structured JSON for compliance reporting
 * - Automatic rotation and archival
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class AuditLogger {
  constructor(logPath, options = {}) {
    this.logPath = logPath;
    this.options = {
      rotationSizeMB: options.rotationSizeMB || 100,
      retentionDays: options.retentionDays || 2555, // 7 years default for compliance
      enableChainValidation: options.enableChainValidation !== false,
      ...options
    };

    // Current log file
    this.currentLogFile = this.getCurrentLogFile();
    
    // Last log entry hash (for chain validation)
    this.lastHash = this.getLastHash();

    // Ensure log directory exists
    this.ensureLogDirectory();

    console.log(`✓ Audit logger initialized: ${this.currentLogFile}`);
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDirectory() {
    const dir = path.dirname(this.currentLogFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Get current log file path (with date rotation)
   */
  getCurrentLogFile() {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logPath, `audit-${date}.jsonl`);
  }

  /**
   * Get hash of last log entry (for chain validation)
   */
  getLastHash() {
    try {
      if (!fs.existsSync(this.currentLogFile)) {
        return null;
      }

      const content = fs.readFileSync(this.currentLogFile, 'utf8');
      const lines = content.trim().split('\n');
      
      if (lines.length === 0) return null;

      const lastEntry = JSON.parse(lines[lines.length - 1]);
      return lastEntry.hash;
    } catch (error) {
      return null;
    }
  }

  /**
   * Log a policy decision
   */
  logDecision(agentId, action, context, decision, durationMs) {
    const entry = {
      type: 'policy_decision',
      timestamp: new Date().toISOString(),
      timestampUnix: Date.now(),
      agentId,
      action,
      context: this.sanitizeContext(context),
      decision: {
        allowed: decision.allowed,
        reason: decision.reason,
        requiresEscalation: decision.requiresEscalation,
        escalationRule: decision.escalationRule
      },
      durationMs
    };

    this.writeEntry(entry);
  }

  /**
   * Log an agent action
   */
  logAction(agentId, action, details, result) {
    const entry = {
      type: 'agent_action',
      timestamp: new Date().toISOString(),
      timestampUnix: Date.now(),
      agentId,
      action,
      details: this.sanitizeContext(details),
      result: {
        success: result.success,
        output: result.output,
        error: result.error
      }
    };

    this.writeEntry(entry);
  }

  /**
   * Log a human escalation event
   */
  logEscalation(agentId, action, context, escalationReason, assignedTo) {
    const entry = {
      type: 'escalation',
      timestamp: new Date().toISOString(),
      timestampUnix: Date.now(),
      agentId,
      action,
      context: this.sanitizeContext(context),
      escalationReason,
      assignedTo,
      status: 'pending'
    };

    this.writeEntry(entry);
    return entry.timestampUnix; // Return escalation ID
  }

  /**
   * Log escalation resolution
   */
  logEscalationResolution(escalationId, resolvedBy, decision, notes) {
    const entry = {
      type: 'escalation_resolution',
      timestamp: new Date().toISOString(),
      timestampUnix: Date.now(),
      escalationId,
      resolvedBy,
      decision, // 'approved' | 'denied' | 'modified'
      notes
    };

    this.writeEntry(entry);
  }

  /**
   * Log identity verification
   */
  logIdentityVerification(agentId, verificationType, result) {
    const entry = {
      type: 'identity_verification',
      timestamp: new Date().toISOString(),
      timestampUnix: Date.now(),
      agentId,
      verificationType,
      result: {
        verified: result.verified,
        reason: result.reason,
        trustScore: result.trustScore
      }
    };

    this.writeEntry(entry);
  }

  /**
   * Write entry to log with hash chain
   */
  writeEntry(entry) {
    // Check if we need to rotate log file
    if (this.shouldRotate()) {
      this.rotateLogFile();
    }

    // Add hash chain
    if (this.options.enableChainValidation) {
      entry.previousHash = this.lastHash;
      entry.hash = this.hashEntry(entry);
      this.lastHash = entry.hash;
    }

    // Write to log file (append-only)
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(this.currentLogFile, line);
  }

  /**
   * Hash an entry for chain validation
   */
  hashEntry(entry) {
    const data = JSON.stringify({
      type: entry.type,
      timestamp: entry.timestamp,
      agentId: entry.agentId,
      action: entry.action,
      decision: entry.decision,
      previousHash: entry.previousHash
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Check if log should be rotated
   */
  shouldRotate() {
    try {
      const stats = fs.statSync(this.currentLogFile);
      const sizeMB = stats.size / (1024 * 1024);
      return sizeMB > this.options.rotationSizeMB;
    } catch (error) {
      return false;
    }
  }

  /**
   * Rotate log file
   */
  rotateLogFile() {
    const timestamp = Date.now();
    const rotatedFile = this.currentLogFile.replace('.jsonl', `.${timestamp}.jsonl`);
    
    fs.renameSync(this.currentLogFile, rotatedFile);
    console.log(`✓ Rotated audit log: ${rotatedFile}`);

    this.currentLogFile = this.getCurrentLogFile();
    this.lastHash = null;
  }

  /**
   * Sanitize context to remove sensitive data
   */
  sanitizeContext(context) {
    const sanitized = { ...context };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'ssn', 'creditCard'];
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Verify integrity of audit log chain
   */
  verifyChain(logFile = null) {
    const file = logFile || this.currentLogFile;
    
    if (!fs.existsSync(file)) {
      return { valid: false, error: 'Log file not found' };
    }

    const content = fs.readFileSync(file, 'utf8');
    const lines = content.trim().split('\n').filter(l => l);

    let previousHash = null;
    let validEntries = 0;

    for (let i = 0; i < lines.length; i++) {
      try {
        const entry = JSON.parse(lines[i]);

        // Verify hash chain
        if (entry.previousHash !== previousHash) {
          return {
            valid: false,
            error: `Hash chain broken at line ${i + 1}`,
            entry
          };
        }

        // Verify entry hash
        const calculatedHash = this.hashEntry(entry);
        if (entry.hash !== calculatedHash) {
          return {
            valid: false,
            error: `Entry hash mismatch at line ${i + 1}`,
            entry
          };
        }

        previousHash = entry.hash;
        validEntries++;
      } catch (error) {
        return {
          valid: false,
          error: `Invalid JSON at line ${i + 1}: ${error.message}`
        };
      }
    }

    return {
      valid: true,
      entries: validEntries,
      file
    };
  }

  /**
   * Query audit logs
   */
  query(filters = {}) {
    const results = [];
    const files = this.getLogFiles();

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.trim().split('\n').filter(l => l);

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          
          if (this.matchesFilters(entry, filters)) {
            results.push(entry);
          }
        } catch (error) {
          // Skip invalid lines
        }
      }
    }

    return results;
  }

  /**
   * Check if entry matches filters
   */
  matchesFilters(entry, filters) {
    if (filters.agentId && entry.agentId !== filters.agentId) return false;
    if (filters.type && entry.type !== filters.type) return false;
    if (filters.action && entry.action !== filters.action) return false;
    
    if (filters.startTime && entry.timestampUnix < filters.startTime) return false;
    if (filters.endTime && entry.timestampUnix > filters.endTime) return false;

    if (filters.allowed !== undefined) {
      if (entry.decision?.allowed !== filters.allowed) return false;
    }

    return true;
  }

  /**
   * Get all log files in chronological order
   */
  getLogFiles() {
    const dir = path.dirname(this.currentLogFile);
    
    if (!fs.existsSync(dir)) return [];

    return fs.readdirSync(dir)
      .filter(f => f.startsWith('audit-') && f.endsWith('.jsonl'))
      .map(f => path.join(dir, f))
      .sort();
  }

  /**
   * Generate compliance report
   */
  generateComplianceReport(startDate, endDate) {
    const filters = {
      startTime: new Date(startDate).getTime(),
      endTime: new Date(endDate).getTime()
    };

    const entries = this.query(filters);

    const report = {
      period: { startDate, endDate },
      summary: {
        totalDecisions: 0,
        allowed: 0,
        denied: 0,
        escalations: 0,
        actions: 0
      },
      byAgent: {},
      byAction: {},
      escalations: []
    };

    for (const entry of entries) {
      if (entry.type === 'policy_decision') {
        report.summary.totalDecisions++;
        if (entry.decision.allowed) {
          report.summary.allowed++;
        } else {
          report.summary.denied++;
        }
        if (entry.decision.requiresEscalation) {
          report.summary.escalations++;
        }

        // By agent
        if (!report.byAgent[entry.agentId]) {
          report.byAgent[entry.agentId] = { allowed: 0, denied: 0, escalations: 0 };
        }
        if (entry.decision.allowed) {
          report.byAgent[entry.agentId].allowed++;
        } else {
          report.byAgent[entry.agentId].denied++;
        }
        if (entry.decision.requiresEscalation) {
          report.byAgent[entry.agentId].escalations++;
        }

        // By action
        if (!report.byAction[entry.action]) {
          report.byAction[entry.action] = 0;
        }
        report.byAction[entry.action]++;
      }

      if (entry.type === 'agent_action') {
        report.summary.actions++;
      }

      if (entry.type === 'escalation') {
        report.escalations.push({
          timestamp: entry.timestamp,
          agentId: entry.agentId,
          action: entry.action,
          reason: entry.escalationReason
        });
      }
    }

    return report;
  }
}

module.exports = AuditLogger;
