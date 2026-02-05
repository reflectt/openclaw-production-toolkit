# Production Readiness Checklist
## From Prototype to Production-Grade Agent System

**Reading Time:** 45 minutes  
**Complexity:** Advanced  
**Prerequisites:** Completed governance architecture setup

---

## Table of Contents

1. [Security Hardening](#security-hardening)
2. [Monitoring & Observability](#monitoring--observability)
3. [Error Handling & Recovery](#error-handling--recovery)
4. [Testing Strategies](#testing-strategies)
5. [Pre-Launch Checklist](#pre-launch-checklist)

---

## Security Hardening

### Authentication & Authorization

**1. API Key Management**

```typescript
// security-kit/api-key-management.ts

import { SecretsManager } from 'aws-sdk';

class APIKeyManager {
  private secretsManager: SecretsManager;
  private cache: Map<string, CachedSecret> = new Map();
  
  constructor() {
    this.secretsManager = new SecretsManager({
      region: process.env.AWS_REGION,
    });
  }
  
  async getSecret(secretName: string): Promise<string> {
    // Check cache first (with TTL)
    const cached = this.cache.get(secretName);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    
    // Fetch from AWS Secrets Manager
    const response = await this.secretsManager.getSecretValue({
      SecretId: secretName,
    }).promise();
    
    if (!response.SecretString) {
      throw new Error(`Secret ${secretName} not found`);
    }
    
    // Cache for 5 minutes
    this.cache.set(secretName, {
      value: response.SecretString,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    
    return response.SecretString;
  }
  
  async rotateKey(serviceName: string): Promise<void> {
    // Generate new API key
    const newKey = this.generateSecureKey();
    
    // Store new key with version
    await this.secretsManager.updateSecret({
      SecretId: `${serviceName}/api-key`,
      SecretString: newKey,
      VersionStages: ['AWSCURRENT'],
    }).promise();
    
    // Invalidate cache
    this.cache.delete(`${serviceName}/api-key`);
    
    // Log rotation
    await AuditLog.write({
      eventType: 'api_key_rotated',
      service: serviceName,
      timestamp: new Date(),
    });
  }
  
  private generateSecureKey(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }
}

// Usage in agent code
const keyManager = new APIKeyManager();

async function callExternalAPI() {
  const apiKey = await keyManager.getSecret('stripe/api-key');
  
  const response = await fetch('https://api.stripe.com/v1/charges', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });
  
  return response.json();
}
```

**2. Environment Isolation**

```bash
# .env.production
NODE_ENV=production
DATABASE_URL=postgresql://prod-db.example.com/agents
REDIS_URL=redis://prod-redis.example.com:6379

# Security settings
ENABLE_DEBUG_LOGS=false
ALLOW_EVAL=false
TRUST_PROXY=true
SESSION_SECRET=<stored-in-secrets-manager>

# Rate limiting
RATE_LIMIT_WINDOW=60000 # 1 minute
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=https://app.example.com
CORS_CREDENTIALS=true

# CSP (Content Security Policy)
CSP_DIRECTIVES="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
```

**3. Input Validation**

```typescript
// security-kit/input-validation.ts

import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// Schema validation
const CustomerInputSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100),
  message: z.string().max(5000),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(), // E.164 format
});

function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError({
        message: 'Invalid input',
        errors: error.errors,
      });
    }
    throw error;
  }
}

// XSS prevention
function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a'],
    ALLOWED_ATTR: ['href', 'target'],
  });
}

// SQL injection prevention (using parameterized queries)
async function getUserByEmail(email: string): Promise<User | null> {
  // DON'T DO THIS:
  // const query = `SELECT * FROM users WHERE email = '${email}'`;
  
  // DO THIS:
  const query = 'SELECT * FROM users WHERE email = $1';
  const result = await db.query(query, [email]);
  
  return result.rows[0] || null;
}

// Command injection prevention
function sanitizeCommand(input: string): string {
  // Allowlist of safe characters
  const safePattern = /^[a-zA-Z0-9_\-\.]+$/;
  
  if (!safePattern.test(input)) {
    throw new ValidationError('Invalid characters in input');
  }
  
  return input;
}

// Path traversal prevention
function sanitizePath(userPath: string): string {
  const path = require('path');
  const basePath = '/var/app/uploads';
  
  // Resolve to absolute path
  const absolutePath = path.resolve(basePath, userPath);
  
  // Ensure it's still within basePath
  if (!absolutePath.startsWith(basePath)) {
    throw new SecurityError('Path traversal detected');
  }
  
  return absolutePath;
}
```

**4. Rate Limiting**

```typescript
// security-kit/rate-limiting.ts

import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

// Per-IP rate limiting
const ipLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:ip',
  points: 100, // Number of requests
  duration: 60, // Per 60 seconds
  blockDuration: 60, // Block for 60 seconds if exceeded
});

// Per-user rate limiting (more generous)
const userLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:user',
  points: 1000,
  duration: 60,
  blockDuration: 60,
});

// Per-endpoint rate limiting (stricter for expensive operations)
const expensiveOpLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:expensive',
  points: 10,
  duration: 60,
  blockDuration: 300, // 5 minute block
});

// Middleware
async function rateLimitMiddleware(req, res, next) {
  try {
    // Check IP-based rate limit
    await ipLimiter.consume(req.ip);
    
    // If authenticated, check user-based rate limit
    if (req.user) {
      await userLimiter.consume(req.user.id);
    }
    
    // If expensive operation, check that too
    if (req.path.startsWith('/api/expensive/')) {
      await expensiveOpLimiter.consume(req.user?.id || req.ip);
    }
    
    next();
  } catch (rateLimitError) {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.round(rateLimitError.msBeforeNext / 1000),
    });
  }
}
```

**5. Encryption**

```typescript
// security-kit/encryption.ts

import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

class EncryptionService {
  private algorithm = 'aes-256-gcm';
  
  async encrypt(plaintext: string, password: string): Promise<string> {
    // Generate salt and IV
    const salt = randomBytes(16);
    const iv = randomBytes(16);
    
    // Derive key from password
    const key = (await scryptAsync(password, salt, 32)) as Buffer;
    
    // Encrypt
    const cipher = createCipheriv(this.algorithm, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    // Combine salt + iv + authTag + encrypted
    const combined = Buffer.concat([salt, iv, authTag, encrypted]);
    
    return combined.toString('base64');
  }
  
  async decrypt(ciphertext: string, password: string): Promise<string> {
    const combined = Buffer.from(ciphertext, 'base64');
    
    // Extract components
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 32);
    const authTag = combined.slice(32, 48);
    const encrypted = combined.slice(48);
    
    // Derive key
    const key = (await scryptAsync(password, salt, 32)) as Buffer;
    
    // Decrypt
    const decipher = createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    
    return decrypted.toString('utf8');
  }
}

// Encrypt PII at rest
async function storePII(userId: string, pii: any): Promise<void> {
  const encryption = new EncryptionService();
  const masterKey = await keyManager.getSecret('master-encryption-key');
  
  const encryptedPII = await encryption.encrypt(
    JSON.stringify(pii),
    masterKey
  );
  
  await db.pii.create({
    userId: userId,
    encryptedData: encryptedPII,
    encryptedAt: new Date(),
  });
}

async function retrievePII(userId: string): Promise<any> {
  const encryption = new EncryptionService();
  const masterKey = await keyManager.getSecret('master-encryption-key');
  
  const record = await db.pii.findUnique({ where: { userId } });
  
  if (!record) {
    return null;
  }
  
  const decryptedData = await encryption.decrypt(
    record.encryptedData,
    masterKey
  );
  
  return JSON.parse(decryptedData);
}
```

### Network Security

**1. TLS Configuration**

```typescript
// server.ts

import https from 'https';
import fs from 'fs';

const tlsOptions = {
  key: fs.readFileSync('/path/to/private-key.pem'),
  cert: fs.readFileSync('/path/to/certificate.pem'),
  ca: fs.readFileSync('/path/to/ca-bundle.pem'),
  
  // Modern TLS settings
  minVersion: 'TLSv1.3',
  maxVersion: 'TLSv1.3',
  
  // Strong ciphers only
  ciphers: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256',
  ].join(':'),
  
  // Security headers
  honorCipherOrder: true,
  requestCert: false,
  rejectUnauthorized: true,
};

const server = https.createServer(tlsOptions, app);
server.listen(443);
```

**2. Security Headers**

```typescript
// middleware/security-headers.ts

import helmet from 'helmet';

app.use(helmet({
  // Prevent clickjacking
  frameguard: {
    action: 'deny',
  },
  
  // XSS protection
  xssFilter: true,
  
  // Prevent MIME sniffing
  noSniff: true,
  
  // HSTS (force HTTPS)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Remove unsafe-inline in production
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.example.com'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  
  // Referrer policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
}));

// Additional custom headers
app.use((req, res, next) => {
  res.setHeader('X-API-Version', '1.0.0');
  res.setHeader('X-Request-ID', req.id);
  next();
});
```

**3. CORS Configuration**

```typescript
// middleware/cors.ts

import cors from 'cors';

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://app.example.com',
      'https://admin.example.com',
    ];
    
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  
  credentials: true,
  maxAge: 86400, // 24 hours
  
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-API-Key',
  ],
  
  exposedHeaders: [
    'X-Request-ID',
    'X-RateLimit-Remaining',
  ],
};

app.use(cors(corsOptions));
```

---

## Monitoring & Observability

### Metrics Collection

**1. Application Metrics**

```typescript
// observability-kit/metrics.ts

import { Counter, Histogram, Gauge, Registry } from 'prom-client';

const registry = new Registry();

// Agent activity metrics
const agentActionsTotal = new Counter({
  name: 'agent_actions_total',
  help: 'Total number of agent actions',
  labelNames: ['agent_id', 'action_type', 'status'],
  registers: [registry],
});

const agentActionDuration = new Histogram({
  name: 'agent_action_duration_seconds',
  help: 'Duration of agent actions',
  labelNames: ['agent_id', 'action_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30], // seconds
  registers: [registry],
});

const agentCostTotal = new Counter({
  name: 'agent_cost_total_dollars',
  help: 'Total cost of agent operations',
  labelNames: ['agent_id', 'cost_type'],
  registers: [registry],
});

// Policy metrics
const policyEvaluationsTotal = new Counter({
  name: 'policy_evaluations_total',
  help: 'Total policy evaluations',
  labelNames: ['policy_name', 'decision'],
  registers: [registry],
});

const policyEvaluationDuration = new Histogram({
  name: 'policy_evaluation_duration_seconds',
  help: 'Duration of policy evaluations',
  labelNames: ['policy_name'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  registers: [registry],
});

// Approval metrics
const approvalsTotal = new Counter({
  name: 'approvals_total',
  help: 'Total approval requests',
  labelNames: ['approval_type', 'decision'],
  registers: [registry],
});

const approvalWaitTime = new Histogram({
  name: 'approval_wait_time_seconds',
  help: 'Time waiting for approval',
  labelNames: ['approval_type'],
  buckets: [60, 300, 900, 1800, 3600, 7200, 14400], // seconds
  registers: [registry],
});

// System metrics
const activeAgents = new Gauge({
  name: 'active_agents',
  help: 'Number of currently active agents',
  registers: [registry],
});

const errorRate = new Gauge({
  name: 'error_rate',
  help: 'Current error rate (errors per second)',
  labelNames: ['error_type'],
  registers: [registry],
});

// Instrumentation helpers
export function recordAction(agentId: string, actionType: string, duration: number, status: 'success' | 'error') {
  agentActionsTotal.inc({ agent_id: agentId, action_type: actionType, status });
  agentActionDuration.observe({ agent_id: agentId, action_type: actionType }, duration);
}

export function recordPolicyEvaluation(policyName: string, decision: string, duration: number) {
  policyEvaluationsTotal.inc({ policy_name: policyName, decision });
  policyEvaluationDuration.observe({ policy_name: policyName }, duration);
}

export function recordApproval(approvalType: string, decision: string, waitTime: number) {
  approvalsTotal.inc({ approval_type: approvalType, decision });
  approvalWaitTime.observe({ approval_type: approvalType }, waitTime);
}

export function recordCost(agentId: string, costType: string, amount: number) {
  agentCostTotal.inc({ agent_id: agentId, cost_type: costType }, amount);
}

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});
```

**2. Distributed Tracing**

```typescript
// observability-kit/tracing.ts

import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

// Initialize tracer
const provider = new NodeTracerProvider();
const exporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
});

provider.addSpanProcessor(new BatchSpanProcessor(exporter));
provider.register();

const tracer = trace.getTracer('agent-system', '1.0.0');

// Trace agent actions
async function traceAgentAction<T>(
  agentId: string,
  actionType: string,
  fn: () => Promise<T>
): Promise<T> {
  const span = tracer.startSpan(`agent.${actionType}`, {
    attributes: {
      'agent.id': agentId,
      'action.type': actionType,
    },
  });
  
  try {
    const result = await context.with(
      trace.setSpan(context.active(), span),
      fn
    );
    
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}

// Usage
async function executeAgentWorkflow(agentId: string, workflow: Workflow) {
  return await traceAgentAction(agentId, 'execute_workflow', async () => {
    // Step 1: Policy check
    const policyDecision = await traceAgentAction(agentId, 'policy_check', async () => {
      return await policyEngine.evaluate(workflow.context);
    });
    
    if (!policyDecision.allowed) {
      throw new Error('Policy denied action');
    }
    
    // Step 2: Execute action
    const result = await traceAgentAction(agentId, 'execute_action', async () => {
      return await workflow.execute();
    });
    
    // Step 3: Log to audit trail
    await traceAgentAction(agentId, 'audit_log', async () => {
      return await auditLog.write({
        agentId,
        action: workflow.action,
        result,
      });
    });
    
    return result;
  });
}
```

**3. Structured Logging**

```typescript
// observability-kit/logging.ts

import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'agent-system',
    environment: process.env.NODE_ENV,
  },
  transports: [
    // Console (local dev)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    
    // File (structured JSON for parsing)
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

// Production: send to log aggregation service
if (process.env.NODE_ENV === 'production') {
  const { LogtailTransport } = require('@logtail/winston');
  
  logger.add(new LogtailTransport({
    sourceToken: process.env.LOGTAIL_TOKEN,
  }));
}

// Context-aware logging
export function createLogger(context: Record<string, any>) {
  return logger.child(context);
}

// Usage
const agentLogger = createLogger({
  agentId: 'agent-123',
  workflow: 'customer-support',
});

agentLogger.info('Starting workflow', {
  customerId: 'CUST-456',
  ticketId: 'TKT-789',
});

agentLogger.error('Failed to process ticket', {
  error: error.message,
  stack: error.stack,
  ticketId: 'TKT-789',
});
```

### Alerting

**1. Alert Rules**

```yaml
# observability-kit/alerts.yaml

groups:
  - name: agent_health
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(agent_actions_total{status="error"}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Agent {{ $labels.agent_id }} has error rate {{ $value }}%"
      
      - alert: SlowActionExecution
        expr: histogram_quantile(0.95, agent_action_duration_seconds) > 10
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Slow action execution"
          description: "95th percentile action duration is {{ $value }}s"
      
      - alert: HighCost
        expr: rate(agent_cost_total_dollars[1h]) > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High agent cost detected"
          description: "Agent {{ $labels.agent_id }} spending ${{ $value }}/hour"
      
      - alert: ApprovalBacklog
        expr: approval_wait_time_seconds > 3600
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Approval backlog building"
          description: "Approvals waiting > 1 hour"
  
  - name: policy_enforcement
    interval: 30s
    rules:
      - alert: PolicyViolationSpike
        expr: rate(policy_evaluations_total{decision="deny"}[5m]) > 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Spike in policy violations"
          description: "Unusual number of denied actions ({{ $value }}/s)"
      
      - alert: CircuitBreakerOpen
        expr: circuit_breaker_state{state="open"} == 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Circuit breaker opened"
          description: "Agent {{ $labels.agent_id }} paused due to errors"
  
  - name: security
    interval: 30s
    rules:
      - alert: UnauthorizedAccessAttempt
        expr: rate(http_requests_total{status="401"}[5m]) > 5
        for: 5m
        labels:
          severity: high
        annotations:
          summary: "Multiple unauthorized access attempts"
          description: "{{ $value }} 401 errors/second from {{ $labels.ip }}"
      
      - alert: RateLimitExceeded
        expr: rate(http_requests_total{status="429"}[5m]) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Rate limit frequently exceeded"
          description: "{{ $value }} rate limit errors/second"
```

**2. Alert Routing**

```typescript
// observability-kit/alerting.ts

import { PagerDuty } from 'pagerduty';
import { Slack } from '@slack/web-api';

interface Alert {
  name: string;
  severity: 'critical' | 'high' | 'warning' | 'info';
  message: string;
  labels: Record<string, string>;
}

class AlertManager {
  private pagerduty: PagerDuty;
  private slack: Slack;
  
  constructor() {
    this.pagerduty = new PagerDuty({
      token: process.env.PAGERDUTY_TOKEN,
    });
    
    this.slack = new Slack({
      token: process.env.SLACK_TOKEN,
    });
  }
  
  async route(alert: Alert): Promise<void> {
    // Route based on severity
    switch (alert.severity) {
      case 'critical':
        await this.sendToPagerDuty(alert);
        await this.sendToSlack(alert, '#incidents');
        break;
      
      case 'high':
        await this.sendToSlack(alert, '#alerts');
        await this.sendEmail(alert, ['oncall@example.com']);
        break;
      
      case 'warning':
        await this.sendToSlack(alert, '#monitoring');
        break;
      
      case 'info':
        // Just log, don't notify
        logger.info('Alert', alert);
        break;
    }
  }
  
  private async sendToPagerDuty(alert: Alert): Promise<void> {
    await this.pagerduty.incidents.create({
      incident: {
        type: 'incident',
        title: alert.name,
        service: {
          id: process.env.PAGERDUTY_SERVICE_ID,
          type: 'service_reference',
        },
        urgency: 'high',
        body: {
          type: 'incident_body',
          details: alert.message,
        },
      },
    });
  }
  
  private async sendToSlack(alert: Alert, channel: string): Promise<void> {
    const color = {
      critical: 'danger',
      high: 'warning',
      warning: 'warning',
      info: 'good',
    }[alert.severity];
    
    await this.slack.chat.postMessage({
      channel: channel,
      text: alert.name,
      attachments: [{
        color: color,
        fields: [
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true,
          },
          {
            title: 'Message',
            value: alert.message,
            short: false,
          },
          ...Object.entries(alert.labels).map(([key, value]) => ({
            title: key,
            value: value,
            short: true,
          })),
        ],
        footer: 'Agent Monitoring',
        ts: Math.floor(Date.now() / 1000).toString(),
      }],
    });
  }
}
```

### Dashboards

**1. Grafana Dashboard (JSON)**

```json
{
  "dashboard": {
    "title": "Agent System Overview",
    "panels": [
      {
        "title": "Agent Activity",
        "targets": [
          {
            "expr": "rate(agent_actions_total[5m])",
            "legendFormat": "{{ agent_id }} - {{ action_type }}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(agent_actions_total{status=\"error\"}[5m]) / rate(agent_actions_total[5m])",
            "legendFormat": "{{ agent_id }}"
          }
        ],
        "type": "graph",
        "alert": {
          "conditions": [
            {
              "evaluator": {
                "params": [0.05],
                "type": "gt"
              },
              "operator": {
                "type": "and"
              },
              "query": {
                "params": ["A", "5m", "now"]
              },
              "reducer": {
                "type": "avg"
              },
              "type": "query"
            }
          ],
          "executionErrorState": "alerting",
          "frequency": "60s",
          "handler": 1,
          "name": "Error Rate Alert",
          "noDataState": "no_data",
          "notifications": []
        }
      },
      {
        "title": "Policy Decisions",
        "targets": [
          {
            "expr": "sum by (decision) (rate(policy_evaluations_total[5m]))",
            "legendFormat": "{{ decision }}"
          }
        ],
        "type": "piechart"
      },
      {
        "title": "Cost Tracking",
        "targets": [
          {
            "expr": "rate(agent_cost_total_dollars[1h]) * 24 * 30",
            "legendFormat": "{{ agent_id }} (monthly projection)"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

---

## Error Handling & Recovery

### Error Classification

```typescript
// observability-kit/error-handling.ts

enum ErrorSeverity {
  RECOVERABLE = 'recoverable',
  DEGRADED = 'degraded',
  CRITICAL = 'critical',
}

enum ErrorCategory {
  TRANSIENT = 'transient', // Retry will likely succeed
  PERMANENT = 'permanent', // Retry will not help
  POLICY_VIOLATION = 'policy_violation',
  EXTERNAL_SERVICE = 'external_service',
  INTERNAL = 'internal',
}

class AgentError extends Error {
  constructor(
    message: string,
    public category: ErrorCategory,
    public severity: ErrorSeverity,
    public retryable: boolean,
    public metadata: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

// Specific error types
class TransientError extends AgentError {
  constructor(message: string, metadata = {}) {
    super(message, ErrorCategory.TRANSIENT, ErrorSeverity.RECOVERABLE, true, metadata);
    this.name = 'TransientError';
  }
}

class PolicyViolationError extends AgentError {
  constructor(message: string, policy: string, metadata = {}) {
    super(
      message,
      ErrorCategory.POLICY_VIOLATION,
      ErrorSeverity.CRITICAL,
      false,
      { ...metadata, policy }
    );
    this.name = 'PolicyViolationError';
  }
}

class ExternalServiceError extends AgentError {
  constructor(message: string, service: string, statusCode: number, metadata = {}) {
    super(
      message,
      ErrorCategory.EXTERNAL_SERVICE,
      statusCode >= 500 ? ErrorSeverity.RECOVERABLE : ErrorSeverity.DEGRADED,
      statusCode >= 500, // 5xx errors are retryable
      { ...metadata, service, statusCode }
    );
    this.name = 'ExternalServiceError';
  }
}
```

### Retry Strategies

```typescript
// observability-kit/retry.ts

interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

const defaultRetryConfig: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  jitter: true,
};

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const cfg = { ...defaultRetryConfig, ...config };
  let lastError: Error;
  
  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if not retryable
      if (error instanceof AgentError && !error.retryable) {
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === cfg.maxAttempts) {
        break;
      }
      
      // Calculate delay
      const baseDelay = Math.min(
        cfg.initialDelay * Math.pow(cfg.backoffMultiplier, attempt - 1),
        cfg.maxDelay
      );
      
      const delay = cfg.jitter
        ? baseDelay * (0.5 + Math.random() * 0.5) // ±50% jitter
        : baseDelay;
      
      logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, {
        error: error.message,
        attempt,
        maxAttempts: cfg.maxAttempts,
      });
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

// Circuit breaker pattern (already shown in governance section)

// Bulkhead pattern (isolate failures)
class Bulkhead {
  private semaphore: number;
  private queue: Array<() => void> = [];
  
  constructor(private maxConcurrent: number) {
    this.semaphore = maxConcurrent;
  }
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Wait for available slot
    if (this.semaphore === 0) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    
    this.semaphore--;
    
    try {
      return await fn();
    } finally {
      this.semaphore++;
      
      // Release next waiting task
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }
}

// Usage: limit concurrent external API calls
const stripeBulkhead = new Bulkhead(5); // Max 5 concurrent Stripe calls

async function callStripeAPI() {
  return await stripeBulkhead.execute(async () => {
    return await retryWithBackoff(async () => {
      const response = await fetch('https://api.stripe.com/v1/charges', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(chargeData),
      });
      
      if (!response.ok) {
        throw new ExternalServiceError(
          'Stripe API error',
          'stripe',
          response.status
        );
      }
      
      return response.json();
    });
  });
}
```

### Graceful Degradation

```typescript
// observability-kit/graceful-degradation.ts

class FeatureFlags {
  private flags: Map<string, boolean> = new Map();
  
  async getFlag(name: string): Promise<boolean> {
    // Try to fetch from config service
    try {
      const response = await fetch(`${CONFIG_SERVICE_URL}/flags/${name}`);
      const data = await response.json();
      this.flags.set(name, data.enabled);
      return data.enabled;
    } catch (error) {
      // Fallback to cached value or default
      return this.flags.get(name) ?? false;
    }
  }
  
  async setFlag(name: string, enabled: boolean): Promise<void> {
    this.flags.set(name, enabled);
    
    await fetch(`${CONFIG_SERVICE_URL}/flags/${name}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
  }
}

const featureFlags = new FeatureFlags();

async function processCustomerRequest(request: CustomerRequest): Promise<Response> {
  // Primary path: Use AI agent
  if (await featureFlags.getFlag('enable_ai_agent')) {
    try {
      return await aiAgent.process(request);
    } catch (error) {
      logger.error('AI agent failed, falling back to rule-based system', { error });
      
      // Degrade gracefully: disable AI agent temporarily
      await featureFlags.setFlag('enable_ai_agent', false);
      
      // Fall through to fallback
    }
  }
  
  // Fallback path: Rule-based system
  if (await featureFlags.getFlag('enable_rule_based_system')) {
    return await ruleBasedSystem.process(request);
  }
  
  // Last resort: Manual queue
  return await queueForHumanReview(request);
}
```

---

## Testing Strategies

### Unit Testing

```typescript
// tests/policy-engine.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine } from '../governance-kit/policy-engine';

describe('PolicyEngine', () => {
  let engine: PolicyEngine;
  
  beforeEach(async () => {
    engine = new PolicyEngine();
    await engine.loadPolicies('./test-policies');
  });
  
  describe('evaluateAction', () => {
    it('should allow permitted actions', async () => {
      const decision = await engine.evaluateAction({
        agent: { id: 'agent-1', name: 'test-agent' },
        action: { type: 'read_ticket', ticketId: 'TKT-123' },
        timestamp: new Date(),
      });
      
      expect(decision.allowed).toBe(true);
    });
    
    it('should deny forbidden actions', async () => {
      const decision = await engine.evaluateAction({
        agent: { id: 'agent-1', name: 'test-agent' },
        action: { type: 'delete_customer', customerId: 'CUST-456' },
        timestamp: new Date(),
      });
      
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Only humans');
    });
    
    it('should enforce cost limits', async () => {
      // Set up expensive action
      const decision = await engine.evaluateAction({
        agent: { id: 'agent-1', name: 'test-agent' },
        action: { type: 'expensive_operation', estimatedCost: 1000.00 },
        timestamp: new Date(),
      });
      
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('cost limit');
    });
    
    it('should require approval for low confidence', async () => {
      const decision = await engine.evaluateAction({
        agent: { id: 'agent-1', name: 'test-agent', confidence: 0.6 },
        action: { type: 'send_email', to: 'customer@example.com' },
        timestamp: new Date(),
      });
      
      expect(decision.requiresApproval).toBe(true);
      expect(decision.reason).toContain('confidence');
    });
    
    it('should enforce temporal constraints', async () => {
      // Try action outside business hours
      const decision = await engine.evaluateAction({
        agent: { id: 'agent-1', name: 'test-agent' },
        action: { type: 'send_email', to: 'customer@example.com' },
        timestamp: new Date('2026-02-05T22:00:00-05:00'), // 10 PM EST
      });
      
      expect(decision.requiresApproval).toBe(true);
      expect(decision.reason).toContain('business hours');
    });
  });
});
```

### Integration Testing

```typescript
// tests/integration/agent-workflow.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopTestServer } from './test-helpers';

describe('Agent Workflow Integration', () => {
  beforeAll(async () => {
    await startTestServer();
  });
  
  afterAll(async () => {
    await stopTestServer();
  });
  
  it('should execute full customer support workflow', async () => {
    // 1. Create customer request
    const request = await api.createRequest({
      customerId: 'CUST-TEST-1',
      message: 'I need help with my order',
    });
    
    expect(request.id).toBeDefined();
    
    // 2. Agent should process request
    await waitFor(async () => {
      const status = await api.getRequestStatus(request.id);
      return status.state === 'processed';
    }, { timeout: 10000 });
    
    // 3. Verify policy was checked
    const auditLogs = await api.getAuditLogs({
      correlationId: request.id,
      eventType: 'policy_evaluation',
    });
    
    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs[0].policyEvaluation.decision).toBe('allow');
    
    // 4. Verify response was generated
    const response = await api.getResponse(request.id);
    expect(response.message).toBeDefined();
    expect(response.message.length).toBeGreaterThan(0);
  });
  
  it('should handle approval flow for high-risk actions', async () => {
    // 1. Trigger action requiring approval
    const refundRequest = await api.requestRefund({
      customerId: 'CUST-TEST-1',
      amount: 150.00, // Above auto-approve limit
    });
    
    // 2. Verify approval was requested
    const approval = await api.getApproval(refundRequest.approvalId);
    expect(approval.status).toBe('pending');
    
    // 3. Simulate manager approval
    await api.approveRequest({
      approvalId: refundRequest.approvalId,
      approver: 'manager@example.com',
      decision: 'approved',
    });
    
    // 4. Verify refund was processed
    await waitFor(async () => {
      const status = await api.getRefundStatus(refundRequest.id);
      return status.state === 'completed';
    });
    
    // 5. Verify audit trail
    const auditLogs = await api.getAuditLogs({
      correlationId: refundRequest.id,
    });
    
    const approvalLog = auditLogs.find(log => log.eventType === 'approval_granted');
    expect(approvalLog).toBeDefined();
    expect(approvalLog.approval.approver).toBe('manager@example.com');
  });
});
```

### End-to-End Testing

```typescript
// tests/e2e/customer-journey.test.ts

import { test, expect } from '@playwright/test';

test.describe('Customer Support E2E', () => {
  test('customer can get help from AI agent', async ({ page }) => {
    // 1. Navigate to support page
    await page.goto('https://app.example.com/support');
    
    // 2. Start chat
    await page.click('[data-testid="start-chat"]');
    
    // 3. Send message
    await page.fill('[data-testid="chat-input"]', 'I need to return an item');
    await page.click('[data-testid="send-message"]');
    
    // 4. Wait for agent response
    await page.waitForSelector('[data-testid="agent-message"]', { timeout: 10000 });
    
    const agentMessage = await page.textContent('[data-testid="agent-message"]');
    expect(agentMessage).toContain('return');
    
    // 5. Verify agent provided helpful response
    expect(agentMessage.length).toBeGreaterThan(50);
    
    // 6. Verify response includes actionable next steps
    expect(agentMessage).toMatch(/click|visit|go to|follow/i);
  });
  
  test('escalation to human when agent unsure', async ({ page }) => {
    // 1. Navigate to support page
    await page.goto('https://app.example.com/support');
    
    // 2. Start chat
    await page.click('[data-testid="start-chat"]');
    
    // 3. Ask complex question
    await page.fill('[data-testid="chat-input"]', 'What is the meaning of life?');
    await page.click('[data-testid="send-message"]');
    
    // 4. Verify escalation message
    await page.waitForSelector('[data-testid="agent-message"]');
    const message = await page.textContent('[data-testid="agent-message"]');
    
    expect(message).toMatch(/connect you|transfer|human agent/i);
  });
});
```

### Load Testing

```typescript
// tests/load/agent-capacity.test.ts

import autocannon from 'autocannon';

async function runLoadTest() {
  const result = await autocannon({
    url: 'http://localhost:3000/api/agent/process',
    connections: 100, // Concurrent connections
    duration: 60, // 60 seconds
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_API_KEY}`,
    },
    body: JSON.stringify({
      customerId: 'CUST-LOAD-TEST',
      message: 'Test message',
    }),
  });
  
  console.log('Load Test Results:');
  console.log(`Requests: ${result.requests.total}`);
  console.log(`Throughput: ${result.throughput.average} req/sec`);
  console.log(`Latency p50: ${result.latency.p50}ms`);
  console.log(`Latency p95: ${result.latency.p95}ms`);
  console.log(`Latency p99: ${result.latency.p99}ms`);
  console.log(`Errors: ${result.errors}`);
  
  // Assert SLA requirements
  expect(result.latency.p95).toBeLessThan(1000); // 95% under 1s
  expect(result.errors).toBe(0); // No errors
  expect(result.throughput.average).toBeGreaterThan(50); // >50 req/sec
}
```

---

## Pre-Launch Checklist

### Security Audit

- [ ] All secrets stored in secrets manager (no hardcoded credentials)
- [ ] API keys rotated within last 90 days
- [ ] TLS 1.3 enforced for all connections
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] Input validation on all user inputs
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output sanitization)
- [ ] CSRF protection enabled
- [ ] Rate limiting configured
- [ ] PII encrypted at rest
- [ ] Audit logs immutable and retained for required period
- [ ] Vulnerability scan passed (no critical/high issues)
- [ ] Dependency audit passed (`npm audit`)
- [ ] OWASP Top 10 reviewed and mitigated

### Infrastructure

- [ ] Multi-region deployment configured
- [ ] Auto-scaling policies defined
- [ ] Health checks configured
- [ ] Load balancer configured
- [ ] Database backups automated (daily minimum)
- [ ] Disaster recovery plan documented
- [ ] RTO/RPO defined and tested
- [ ] SSL certificates auto-renewal configured
- [ ] DNS configured with failover
- [ ] CDN configured for static assets

### Monitoring

- [ ] Metrics collection active
- [ ] Dashboards created for key metrics
- [ ] Alerts configured for critical issues
- [ ] Log aggregation configured
- [ ] Distributed tracing enabled
- [ ] Error tracking configured (e.g., Sentry)
- [ ] Uptime monitoring configured
- [ ] Cost monitoring/alerts configured
- [ ] On-call rotation defined
- [ ] Runbooks created for common incidents

### Compliance

- [ ] Privacy policy updated
- [ ] Terms of service updated
- [ ] GDPR compliance verified (if applicable)
- [ ] HIPAA compliance verified (if applicable)
- [ ] SOC2 controls documented
- [ ] Data retention policy defined
- [ ] Data processing agreements signed
- [ ] Audit trail meets regulatory requirements

### Testing

- [ ] Unit test coverage >80%
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Load test completed (meets SLA)
- [ ] Security testing completed
- [ ] Accessibility testing completed
- [ ] Cross-browser testing completed
- [ ] Mobile responsiveness tested

### Documentation

- [ ] API documentation complete
- [ ] Architecture diagrams created
- [ ] Runbooks documented
- [ ] Incident response plan documented
- [ ] User documentation complete
- [ ] Deployment guide documented
- [ ] Rollback procedures documented
- [ ] Disaster recovery procedures documented

### Agent-Specific

- [ ] Policy engine configured and tested
- [ ] Audit trail verified
- [ ] Approval flows tested
- [ ] Cost limits configured
- [ ] Rate limits tuned
- [ ] Circuit breakers tested
- [ ] Fallback mechanisms tested
- [ ] Human escalation paths verified
- [ ] Agent behavior validated in production-like environment
- [ ] Kill switch tested

### Go-Live

- [ ] Stakeholder sign-off obtained
- [ ] Launch communication prepared
- [ ] Support team trained
- [ ] Rollback plan prepared
- [ ] Post-launch monitoring plan defined
- [ ] Gradual rollout plan (if applicable)
- [ ] Feature flags configured
- [ ] Canary deployment strategy defined

---

**Next:** [Reference Architecture →](./04-reference-architecture.md)
