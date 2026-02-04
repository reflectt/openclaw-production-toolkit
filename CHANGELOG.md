# Changelog

All notable changes to the OpenClaw Production Toolkit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-04

### Added
- **Policy Engine**: Declarative YAML policies with allow/deny/escalate rules
  - Wildcard pattern matching (`read:*`, `*:public_info`)
  - Fail-secure by default (deny unless explicitly allowed)
  - Hot-reloadable policies without agent restart
  
- **Identity System**: Zero-trust cryptographic agent identities
  - RSA keypair generation for each agent
  - Trust scoring based on action history (0-100)
  - Automatic revocation when trust drops to zero
  - Optional cryptographic message signing/verification
  
- **Audit Logger**: Immutable, compliance-ready logging
  - Append-only JSONL format with cryptographic chain validation
  - Configurable retention (default: 7 years for SOC2/HIPAA)
  - Query API for compliance reporting
  - Automatic PII redaction for sensitive fields
  
- **Production Agent Wrapper**: Unified governance layer
  - Simple `execute(action, context, handler)` API
  - Escalation workflow for human-in-the-loop
  - Health checks and status monitoring
  - ~8ms overhead per governed action
  
- **Documentation & Examples**
  - Comprehensive README with quick start
  - 4 working examples (basic, escalation, compliance, multi-agent)
  - Integration patterns for OpenClaw, Express, LangChain
  - Security best practices and compliance guides

### Initial Release
This is the first public release of the OpenClaw Production Toolkit, designed to help organizations bridge the "prototype purgatory" gap (66% experimenting → 11% in production) by providing governance-first infrastructure for agentic AI.

**Target Use Case**: Enterprise teams needing SOC2/GDPR/HIPAA compliance for AI agents without starting from scratch.

**18-Month Window**: First-mover advantage before Gartner's predicted 40% cancellation wave by end of 2027.
