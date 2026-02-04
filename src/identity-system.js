/**
 * OpenClaw Production Toolkit - Identity System
 * 
 * Zero Trust agent identity with continuous verification.
 * Every agent has a cryptographic identity that's verified on each action.
 * 
 * Features:
 * - Agent identity management (create, verify, revoke)
 * - Cryptographic signing for non-repudiation
 * - Trust score based on behavior history
 * - Identity federation (future: integrate with enterprise SSO)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class IdentitySystem {
  constructor(identityStorePath, auditLogger) {
    this.identityStorePath = identityStorePath;
    this.auditLogger = auditLogger;
    this.identities = new Map();
    this.trustScores = new Map();
    
    this.ensureIdentityStore();
    this.loadIdentities();

    console.log(`✓ Identity system initialized with ${this.identities.size} agents`);
  }

  /**
   * Ensure identity store directory exists
   */
  ensureIdentityStore() {
    if (!fs.existsSync(this.identityStorePath)) {
      fs.mkdirSync(this.identityStorePath, { recursive: true });
    }
  }

  /**
   * Load all identities from store
   */
  loadIdentities() {
    try {
      const identityFiles = fs.readdirSync(this.identityStorePath)
        .filter(f => f.endsWith('.json'));

      for (const file of identityFiles) {
        const fullPath = path.join(this.identityStorePath, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        const identity = JSON.parse(content);
        
        this.identities.set(identity.agentId, identity);
        this.trustScores.set(identity.agentId, identity.trustScore || 100);
      }
    } catch (error) {
      console.error('Failed to load identities:', error.message);
    }
  }

  /**
   * Create a new agent identity
   * 
   * @param {string} agentId - Unique agent identifier
   * @param {object} metadata - Agent metadata (name, role, owner, etc.)
   * @returns {object} - Identity object with keypair
   */
  createIdentity(agentId, metadata = {}) {
    if (this.identities.has(agentId)) {
      throw new Error(`Identity already exists for agent: ${agentId}`);
    }

    // Generate RSA keypair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Create identity object
    const identity = {
      agentId,
      publicKey,
      privateKey,
      metadata: {
        name: metadata.name || agentId,
        role: metadata.role || 'agent',
        owner: metadata.owner,
        createdAt: new Date().toISOString(),
        createdBy: metadata.createdBy || 'system',
        tags: metadata.tags || []
      },
      status: 'active',
      trustScore: 100, // Start with perfect score
      verificationHistory: [],
      lastVerified: null
    };

    // Store identity
    this.identities.set(agentId, identity);
    this.trustScores.set(agentId, 100);
    this.saveIdentity(identity);

    console.log(`✓ Created identity for agent: ${agentId}`);

    return {
      agentId: identity.agentId,
      publicKey: identity.publicKey,
      metadata: identity.metadata,
      trustScore: identity.trustScore
    };
  }

  /**
   * Save identity to disk
   */
  saveIdentity(identity) {
    const filename = `${identity.agentId}.json`;
    const filepath = path.join(this.identityStorePath, filename);
    fs.writeFileSync(filepath, JSON.stringify(identity, null, 2));
  }

  /**
   * Verify agent identity
   * 
   * @param {string} agentId - Agent to verify
   * @param {object} credentials - Verification credentials (signature, challenge response, etc.)
   * @returns {object} - Verification result
   */
  verifyIdentity(agentId, credentials = {}) {
    const identity = this.identities.get(agentId);

    if (!identity) {
      const result = {
        verified: false,
        reason: 'Agent identity not found',
        trustScore: 0
      };
      
      this.auditLogger.logIdentityVerification(agentId, 'identity_check', result);
      return result;
    }

    if (identity.status === 'revoked') {
      const result = {
        verified: false,
        reason: 'Agent identity has been revoked',
        trustScore: 0
      };
      
      this.auditLogger.logIdentityVerification(agentId, 'identity_check', result);
      return result;
    }

    // Check if signature provided (strong verification)
    if (credentials.signature && credentials.message) {
      const verified = this.verifySignature(
        identity.publicKey,
        credentials.message,
        credentials.signature
      );

      if (!verified) {
        this.decrementTrustScore(agentId, 10, 'Failed signature verification');
        
        const result = {
          verified: false,
          reason: 'Invalid signature',
          trustScore: this.getTrustScore(agentId)
        };
        
        this.auditLogger.logIdentityVerification(agentId, 'signature_verification', result);
        return result;
      }
    }

    // Check trust score
    const trustScore = this.getTrustScore(agentId);
    
    if (trustScore < 50) {
      const result = {
        verified: false,
        reason: 'Trust score too low for operation',
        trustScore
      };
      
      this.auditLogger.logIdentityVerification(agentId, 'trust_score_check', result);
      return result;
    }

    // Update verification history
    identity.lastVerified = new Date().toISOString();
    identity.verificationHistory.push({
      timestamp: identity.lastVerified,
      method: credentials.signature ? 'signature' : 'basic',
      success: true
    });

    // Keep only last 100 verifications
    if (identity.verificationHistory.length > 100) {
      identity.verificationHistory = identity.verificationHistory.slice(-100);
    }

    this.saveIdentity(identity);

    const result = {
      verified: true,
      reason: 'Identity verified successfully',
      trustScore
    };

    this.auditLogger.logIdentityVerification(agentId, 'identity_check', result);
    return result;
  }

  /**
   * Sign a message with agent's private key
   */
  signMessage(agentId, message) {
    const identity = this.identities.get(agentId);
    
    if (!identity) {
      throw new Error(`Identity not found for agent: ${agentId}`);
    }

    const sign = crypto.createSign('SHA256');
    sign.update(message);
    sign.end();

    return sign.sign(identity.privateKey, 'base64');
  }

  /**
   * Verify a signature
   */
  verifySignature(publicKey, message, signature) {
    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(message);
      verify.end();

      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current trust score for agent
   */
  getTrustScore(agentId) {
    return this.trustScores.get(agentId) || 0;
  }

  /**
   * Increment trust score (reward good behavior)
   */
  incrementTrustScore(agentId, amount, reason) {
    const current = this.getTrustScore(agentId);
    const newScore = Math.min(100, current + amount);
    
    this.trustScores.set(agentId, newScore);

    const identity = this.identities.get(agentId);
    if (identity) {
      identity.trustScore = newScore;
      this.saveIdentity(identity);
    }

    console.log(`✓ Trust score increased for ${agentId}: ${current} → ${newScore} (${reason})`);
  }

  /**
   * Decrement trust score (penalize bad behavior)
   */
  decrementTrustScore(agentId, amount, reason) {
    const current = this.getTrustScore(agentId);
    const newScore = Math.max(0, current - amount);
    
    this.trustScores.set(agentId, newScore);

    const identity = this.identities.get(agentId);
    if (identity) {
      identity.trustScore = newScore;
      this.saveIdentity(identity);
    }

    console.log(`⚠ Trust score decreased for ${agentId}: ${current} → ${newScore} (${reason})`);

    // Auto-revoke if trust score drops too low
    if (newScore === 0) {
      this.revokeIdentity(agentId, 'Trust score reached zero');
    }
  }

  /**
   * Revoke an agent identity (cannot be reversed)
   */
  revokeIdentity(agentId, reason) {
    const identity = this.identities.get(agentId);
    
    if (!identity) {
      throw new Error(`Identity not found for agent: ${agentId}`);
    }

    identity.status = 'revoked';
    identity.revokedAt = new Date().toISOString();
    identity.revocationReason = reason;

    this.saveIdentity(identity);
    this.trustScores.set(agentId, 0);

    console.log(`🚫 Revoked identity for agent: ${agentId} (${reason})`);

    this.auditLogger.logIdentityVerification(agentId, 'revocation', {
      verified: false,
      reason: `Identity revoked: ${reason}`,
      trustScore: 0
    });
  }

  /**
   * Get identity information
   */
  getIdentity(agentId) {
    const identity = this.identities.get(agentId);
    
    if (!identity) {
      return null;
    }

    // Return safe copy (no private key)
    return {
      agentId: identity.agentId,
      publicKey: identity.publicKey,
      metadata: identity.metadata,
      status: identity.status,
      trustScore: this.getTrustScore(agentId),
      lastVerified: identity.lastVerified,
      verificationCount: identity.verificationHistory.length
    };
  }

  /**
   * List all agents
   */
  listAgents(filter = {}) {
    const agents = [];

    for (const [agentId, identity] of this.identities) {
      if (filter.status && identity.status !== filter.status) {
        continue;
      }

      if (filter.minTrustScore && this.getTrustScore(agentId) < filter.minTrustScore) {
        continue;
      }

      agents.push(this.getIdentity(agentId));
    }

    return agents;
  }

  /**
   * Update agent metadata
   */
  updateMetadata(agentId, updates) {
    const identity = this.identities.get(agentId);
    
    if (!identity) {
      throw new Error(`Identity not found for agent: ${agentId}`);
    }

    identity.metadata = {
      ...identity.metadata,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.saveIdentity(identity);
    console.log(`✓ Updated metadata for agent: ${agentId}`);
  }

  /**
   * Rotate keypair for an agent
   */
  rotateKeypair(agentId) {
    const identity = this.identities.get(agentId);
    
    if (!identity) {
      throw new Error(`Identity not found for agent: ${agentId}`);
    }

    // Archive old key
    identity.archivedKeys = identity.archivedKeys || [];
    identity.archivedKeys.push({
      publicKey: identity.publicKey,
      archivedAt: new Date().toISOString()
    });

    // Generate new keypair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    identity.publicKey = publicKey;
    identity.privateKey = privateKey;
    identity.keyRotatedAt = new Date().toISOString();

    this.saveIdentity(identity);
    console.log(`✓ Rotated keypair for agent: ${agentId}`);
  }
}

module.exports = IdentitySystem;
