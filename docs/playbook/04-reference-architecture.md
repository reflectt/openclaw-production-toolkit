# Reference Architecture
## Production-Grade Multi-Environment Agent Infrastructure

**Reading Time:** 50 minutes  
**Complexity:** Advanced  
**Prerequisites:** Kubernetes, AWS/GCP/Azure knowledge, CI/CD experience

---

## Table of Contents

1. [Multi-Environment Setup](#multi-environment-setup)
2. [Deployment Patterns](#deployment-patterns)
3. [Infrastructure as Code](#infrastructure-as-code)
4. [Incident Response Playbook](#incident-response-playbook)
5. [Operational Excellence](#operational-excellence)

---

## Multi-Environment Setup

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRODUCTION                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Region 1 │  │ Region 2 │  │ Region 3 │  │ Region 4 │       │
│  │ (Primary)│  │ (Active) │  │ (Active) │  │  (DR)    │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │             │             │             │              │
└───────┼─────────────┼─────────────┼─────────────┼──────────────┘
        │             │             │             │
┌───────┼─────────────┼─────────────┼─────────────┘
│       │             │             │
│  ┌────▼─────┐  ┌────▼─────┐  ┌───▼──────┐
│  │  Staging │  │   UAT    │  │   QA     │
│  │ (1 Region│  │(1 Region)│  │(1 Region)│
│  └────┬─────┘  └────┬─────┘  └────┬─────┘
│       │             │              │
└───────┼─────────────┼──────────────┘
        │             │
   ┌────▼─────────────▼────┐
   │    Development        │
   │   (Local/Cloud)       │
   └───────────────────────┘
```

### Environment Specifications

**Development:**
- **Purpose:** Local development, rapid iteration
- **Infrastructure:** Docker Compose or local Kubernetes (minikube/kind)
- **Data:** Synthetic test data, mocks for external services
- **Cost:** Minimal (runs on developer laptops)
- **Deployment:** Manual, developer-triggered

**QA:**
- **Purpose:** Automated testing, CI/CD validation
- **Infrastructure:** Single-region Kubernetes cluster (small nodes)
- **Data:** Anonymized production subset + synthetic data
- **Cost:** Low ($500-1000/month)
- **Deployment:** Automated on every commit to `main`

**UAT (User Acceptance Testing):**
- **Purpose:** Business stakeholder validation, pre-production testing
- **Infrastructure:** Production-like, single region
- **Data:** Anonymized production data (refreshed weekly)
- **Cost:** Medium ($2000-5000/month)
- **Deployment:** Automated on tagged releases

**Staging:**
- **Purpose:** Final pre-production validation, performance testing
- **Infrastructure:** Identical to production (1 region)
- **Data:** Production clone (anonymized PII)
- **Cost:** Medium-High ($5000-10000/month)
- **Deployment:** Automated, matches production deployment process

**Production:**
- **Purpose:** Live customer traffic
- **Infrastructure:** Multi-region, auto-scaling, high availability
- **Data:** Real customer data
- **Cost:** Variable based on usage
- **Deployment:** Canary/blue-green with manual approval gates

### Environment Configuration

```typescript
// config/environments.ts

export interface EnvironmentConfig {
  name: string;
  apiUrl: string;
  databaseUrl: string;
  redisUrl: string;
  
  // Feature flags
  features: {
    aiAgent: boolean;
    advancedAnalytics: boolean;
    experimentalFeatures: boolean;
  };
  
  // Limits
  limits: {
    maxConcurrentAgents: number;
    maxActionsPerMinute: number;
    maxCostPerDay: number;
  };
  
  // Integrations
  integrations: {
    stripe: {
      apiKey: string;
      webhookSecret: string;
    };
    sendgrid: {
      apiKey: string;
    };
  };
  
  // Observability
  observability: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    metricsEnabled: boolean;
    tracingEnabled: boolean;
    sentryDsn?: string;
  };
}

const environments: Record<string, EnvironmentConfig> = {
  development: {
    name: 'development',
    apiUrl: 'http://localhost:3000',
    databaseUrl: 'postgresql://localhost/agents_dev',
    redisUrl: 'redis://localhost:6379',
    
    features: {
      aiAgent: true,
      advancedAnalytics: true,
      experimentalFeatures: true,
    },
    
    limits: {
      maxConcurrentAgents: 5,
      maxActionsPerMinute: 100,
      maxCostPerDay: 10,
    },
    
    integrations: {
      stripe: {
        apiKey: process.env.STRIPE_TEST_KEY!,
        webhookSecret: process.env.STRIPE_TEST_WEBHOOK_SECRET!,
      },
      sendgrid: {
        apiKey: process.env.SENDGRID_TEST_KEY!,
      },
    },
    
    observability: {
      logLevel: 'debug',
      metricsEnabled: true,
      tracingEnabled: true,
    },
  },
  
  qa: {
    name: 'qa',
    apiUrl: 'https://api-qa.example.com',
    databaseUrl: process.env.QA_DATABASE_URL!,
    redisUrl: process.env.QA_REDIS_URL!,
    
    features: {
      aiAgent: true,
      advancedAnalytics: true,
      experimentalFeatures: true,
    },
    
    limits: {
      maxConcurrentAgents: 10,
      maxActionsPerMinute: 500,
      maxCostPerDay: 50,
    },
    
    integrations: {
      stripe: {
        apiKey: process.env.STRIPE_TEST_KEY!,
        webhookSecret: process.env.STRIPE_TEST_WEBHOOK_SECRET!,
      },
      sendgrid: {
        apiKey: process.env.SENDGRID_TEST_KEY!,
      },
    },
    
    observability: {
      logLevel: 'info',
      metricsEnabled: true,
      tracingEnabled: true,
      sentryDsn: process.env.SENTRY_DSN_QA,
    },
  },
  
  staging: {
    name: 'staging',
    apiUrl: 'https://api-staging.example.com',
    databaseUrl: process.env.STAGING_DATABASE_URL!,
    redisUrl: process.env.STAGING_REDIS_URL!,
    
    features: {
      aiAgent: true,
      advancedAnalytics: true,
      experimentalFeatures: false,
    },
    
    limits: {
      maxConcurrentAgents: 50,
      maxActionsPerMinute: 2000,
      maxCostPerDay: 500,
    },
    
    integrations: {
      stripe: {
        apiKey: process.env.STRIPE_TEST_KEY!,
        webhookSecret: process.env.STRIPE_TEST_WEBHOOK_SECRET!,
      },
      sendgrid: {
        apiKey: process.env.SENDGRID_KEY!,
      },
    },
    
    observability: {
      logLevel: 'info',
      metricsEnabled: true,
      tracingEnabled: true,
      sentryDsn: process.env.SENTRY_DSN_STAGING,
    },
  },
  
  production: {
    name: 'production',
    apiUrl: 'https://api.example.com',
    databaseUrl: process.env.PROD_DATABASE_URL!,
    redisUrl: process.env.PROD_REDIS_URL!,
    
    features: {
      aiAgent: true,
      advancedAnalytics: true,
      experimentalFeatures: false,
    },
    
    limits: {
      maxConcurrentAgents: 1000,
      maxActionsPerMinute: 10000,
      maxCostPerDay: 10000,
    },
    
    integrations: {
      stripe: {
        apiKey: process.env.STRIPE_LIVE_KEY!,
        webhookSecret: process.env.STRIPE_LIVE_WEBHOOK_SECRET!,
      },
      sendgrid: {
        apiKey: process.env.SENDGRID_KEY!,
      },
    },
    
    observability: {
      logLevel: 'warn',
      metricsEnabled: true,
      tracingEnabled: true,
      sentryDsn: process.env.SENTRY_DSN_PROD,
    },
  },
};

export function getConfig(): EnvironmentConfig {
  const env = process.env.NODE_ENV || 'development';
  
  if (!environments[env]) {
    throw new Error(`Unknown environment: ${env}`);
  }
  
  return environments[env];
}
```

---

## Deployment Patterns

### Canary Deployment

**What:** Deploy new version to small percentage of traffic, gradually increase if healthy.

**When:** Production deployments, high-risk changes

**Architecture:**

```
                    Load Balancer
                          │
                    ┌─────┴─────┐
                    │           │
                   95%         5%
                    │           │
              ┌─────▼─────┐   ┌─▼─────┐
              │  Stable   │   │Canary │
              │  v1.0.0   │   │v1.1.0 │
              └───────────┘   └───────┘
```

**Implementation:**

```yaml
# k8s/canary-deployment.yaml

apiVersion: v1
kind: Service
metadata:
  name: agent-api
spec:
  selector:
    app: agent-api
  ports:
    - port: 80
      targetPort: 3000

---
# Stable deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-api-stable
  labels:
    version: stable
spec:
  replicas: 9  # 90% of traffic
  selector:
    matchLabels:
      app: agent-api
      version: stable
  template:
    metadata:
      labels:
        app: agent-api
        version: stable
    spec:
      containers:
      - name: agent-api
        image: registry.example.com/agent-api:v1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: VERSION
          value: "1.0.0"
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 1Gi

---
# Canary deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-api-canary
  labels:
    version: canary
spec:
  replicas: 1  # 10% of traffic
  selector:
    matchLabels:
      app: agent-api
      version: canary
  template:
    metadata:
      labels:
        app: agent-api
        version: canary
    spec:
      containers:
      - name: agent-api
        image: registry.example.com/agent-api:v1.1.0
        ports:
        - containerPort: 3000
        env:
        - name: VERSION
          value: "1.1.0-canary"
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 1Gi
```

**Automated Canary Promotion:**

```typescript
// scripts/canary-promotion.ts

interface CanaryMetrics {
  errorRate: number;
  latencyP95: number;
  throughput: number;
}

async function getMetrics(version: string): Promise<CanaryMetrics> {
  // Query Prometheus
  const response = await fetch(`${PROMETHEUS_URL}/api/v1/query`, {
    method: 'POST',
    body: new URLSearchParams({
      query: `
        rate(http_requests_total{version="${version}",status=~"5.."}[5m]) /
        rate(http_requests_total{version="${version}"}[5m])
      `,
    }),
  });
  
  const data = await response.json();
  const errorRate = parseFloat(data.data.result[0]?.value[1] || '0');
  
  // Get latency
  const latencyResponse = await fetch(`${PROMETHEUS_URL}/api/v1/query`, {
    method: 'POST',
    body: new URLSearchParams({
      query: `histogram_quantile(0.95, http_request_duration_seconds{version="${version}"})`,
    }),
  });
  
  const latencyData = await latencyResponse.json();
  const latencyP95 = parseFloat(latencyData.data.result[0]?.value[1] || '0');
  
  return {
    errorRate,
    latencyP95,
    throughput: 0, // TODO: Calculate
  };
}

async function promoteCanary() {
  const stableMetrics = await getMetrics('stable');
  const canaryMetrics = await getMetrics('canary');
  
  console.log('Stable metrics:', stableMetrics);
  console.log('Canary metrics:', canaryMetrics);
  
  // Check if canary is healthy
  const canaryHealthy = 
    canaryMetrics.errorRate <= stableMetrics.errorRate * 1.1 && // Max 10% more errors
    canaryMetrics.latencyP95 <= stableMetrics.latencyP95 * 1.2;  // Max 20% slower
  
  if (!canaryHealthy) {
    console.error('Canary unhealthy, rolling back');
    await rollbackCanary();
    return;
  }
  
  // Gradually increase canary traffic
  const stages = [
    { replicas: { stable: 9, canary: 1 }, wait: 300 },   // 10% - 5 min
    { replicas: { stable: 7, canary: 3 }, wait: 600 },   // 30% - 10 min
    { replicas: { stable: 5, canary: 5 }, wait: 900 },   // 50% - 15 min
    { replicas: { stable: 3, canary: 7 }, wait: 600 },   // 70% - 10 min
    { replicas: { stable: 0, canary: 10 }, wait: 0 },    // 100%
  ];
  
  for (const stage of stages) {
    console.log(`Promoting canary to ${(stage.replicas.canary / 10) * 100}%`);
    
    // Update replica counts
    await kubectl(`scale deployment agent-api-stable --replicas=${stage.replicas.stable}`);
    await kubectl(`scale deployment agent-api-canary --replicas=${stage.replicas.canary}`);
    
    // Wait for rollout
    await kubectl('rollout status deployment agent-api-canary');
    
    // Wait observation period
    if (stage.wait > 0) {
      console.log(`Waiting ${stage.wait}s for metrics...`);
      await sleep(stage.wait * 1000);
      
      // Check metrics again
      const newMetrics = await getMetrics('canary');
      
      if (newMetrics.errorRate > stableMetrics.errorRate * 1.1) {
        console.error('Canary degraded during rollout, rolling back');
        await rollbackCanary();
        return;
      }
    }
  }
  
  console.log('Canary successfully promoted to stable');
  
  // Update stable to canary version
  await kubectl('set image deployment/agent-api-stable agent-api=registry.example.com/agent-api:v1.1.0');
  
  // Scale down old canary
  await kubectl('scale deployment agent-api-canary --replicas=0');
}

async function rollbackCanary() {
  console.log('Rolling back canary deployment');
  
  // Scale down canary
  await kubectl('scale deployment agent-api-canary --replicas=0');
  
  // Ensure stable is at full capacity
  await kubectl('scale deployment agent-api-stable --replicas=10');
  
  // Send alert
  await sendAlert({
    severity: 'high',
    title: 'Canary Rollback',
    message: 'Canary deployment rolled back due to health issues',
  });
}
```

### Blue-Green Deployment

**What:** Deploy new version alongside old, switch traffic instantly, easy rollback.

**When:** Zero-downtime deployments, database migrations

**Architecture:**

```
                Load Balancer
                      │
              ┌───────┴───────┐
              │ Switch Route  │
              └───┬───────┬───┘
                  │       │
            ┌─────▼──┐  ┌─▼──────┐
            │ Blue   │  │ Green  │
            │ v1.0.0 │  │ v1.1.0 │
            │(Active)│  │(Idle)  │
            └────────┘  └────────┘
                  │       │
            ┌─────▼───────▼─────┐
            │   Shared Database │
            └───────────────────┘
```

**Implementation:**

```yaml
# k8s/blue-green-deployment.yaml

apiVersion: v1
kind: Service
metadata:
  name: agent-api-live
spec:
  selector:
    app: agent-api
    slot: blue  # Switch to 'green' to cutover
  ports:
    - port: 80
      targetPort: 3000

---
# Blue deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-api-blue
spec:
  replicas: 10
  selector:
    matchLabels:
      app: agent-api
      slot: blue
  template:
    metadata:
      labels:
        app: agent-api
        slot: blue
    spec:
      containers:
      - name: agent-api
        image: registry.example.com/agent-api:v1.0.0

---
# Green deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-api-green
spec:
  replicas: 10
  selector:
    matchLabels:
      app: agent-api
      slot: green
  template:
    metadata:
      labels:
        app: agent-api
        slot: green
    spec:
      containers:
      - name: agent-api
        image: registry.example.com/agent-api:v1.1.0
```

**Cutover Script:**

```bash
#!/bin/bash
# scripts/blue-green-cutover.sh

CURRENT_SLOT=$(kubectl get service agent-api-live -o jsonpath='{.spec.selector.slot}')
NEW_SLOT=$([ "$CURRENT_SLOT" = "blue" ] && echo "green" || echo "blue")

echo "Current slot: $CURRENT_SLOT"
echo "New slot: $NEW_SLOT"

# 1. Deploy new version to inactive slot
echo "Deploying to $NEW_SLOT slot..."
kubectl set image deployment/agent-api-$NEW_SLOT agent-api=registry.example.com/agent-api:$NEW_VERSION

# 2. Wait for rollout
echo "Waiting for rollout..."
kubectl rollout status deployment/agent-api-$NEW_SLOT

# 3. Run smoke tests
echo "Running smoke tests..."
NEW_SLOT_IP=$(kubectl get pods -l slot=$NEW_SLOT -o jsonpath='{.items[0].status.podIP}')
curl -f http://$NEW_SLOT_IP:3000/health || exit 1

# 4. Switch traffic
echo "Switching traffic to $NEW_SLOT..."
kubectl patch service agent-api-live -p "{\"spec\":{\"selector\":{\"slot\":\"$NEW_SLOT\"}}}"

# 5. Monitor for issues
echo "Monitoring for 5 minutes..."
sleep 300

ERROR_RATE=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=rate(http_requests_total{status=~\"5..\"}[5m])" | jq -r '.data.result[0].value[1]')

if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
  echo "Error rate too high, rolling back to $CURRENT_SLOT"
  kubectl patch service agent-api-live -p "{\"spec\":{\"selector\":{\"slot\":\"$CURRENT_SLOT\"}}}"
  exit 1
fi

echo "Deployment successful!"
```

### Rolling Deployment

**What:** Gradually replace instances one-by-one.

**When:** Low-risk changes, standard deployments

```yaml
# k8s/rolling-deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-api
spec:
  replicas: 10
  
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2        # Max 2 extra pods during rollout
      maxUnavailable: 1  # Max 1 pod down during rollout
  
  selector:
    matchLabels:
      app: agent-api
  
  template:
    metadata:
      labels:
        app: agent-api
    spec:
      containers:
      - name: agent-api
        image: registry.example.com/agent-api:v1.1.0
        
        # Readiness probe (traffic only when ready)
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          successThreshold: 1
          failureThreshold: 3
        
        # Liveness probe (restart if unhealthy)
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          successThreshold: 1
          failureThreshold: 3
        
        # Graceful shutdown
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 15"]
```

---

## Infrastructure as Code

### Terraform Configuration

**Project Structure:**

```
infra/
├── modules/
│   ├── agent-cluster/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── database/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── monitoring/
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   │   ├── main.tf
│   │   └── terraform.tfvars
│   └── production/
│       ├── main.tf
│       └── terraform.tfvars
└── backend.tf
```

**Backend Configuration:**

```hcl
# infra/backend.tf

terraform {
  backend "s3" {
    bucket         = "example-terraform-state"
    key            = "agent-system/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}
```

**Agent Cluster Module:**

```hcl
# infra/modules/agent-cluster/main.tf

resource "aws_eks_cluster" "agent_cluster" {
  name     = var.cluster_name
  role_arn = aws_iam_role.cluster.arn
  version  = var.kubernetes_version
  
  vpc_config {
    subnet_ids              = var.subnet_ids
    endpoint_private_access = true
    endpoint_public_access  = var.environment == "production" ? false : true
    security_group_ids      = [aws_security_group.cluster.id]
  }
  
  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  
  encryption_config {
    resources = ["secrets"]
    provider {
      key_arn = aws_kms_key.eks.arn
    }
  }
  
  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_eks_node_group" "agents" {
  cluster_name    = aws_eks_cluster.agent_cluster.name
  node_group_name = "agent-workers"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.subnet_ids
  
  scaling_config {
    desired_size = var.desired_capacity
    max_size     = var.max_capacity
    min_size     = var.min_capacity
  }
  
  instance_types = var.instance_types
  
  labels = {
    role = "agent-worker"
  }
  
  tags = {
    Environment = var.environment
  }
}

# Auto-scaling based on CPU
resource "aws_autoscaling_policy" "scale_up" {
  name                   = "${var.cluster_name}-scale-up"
  scaling_adjustment     = 2
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 300
  autoscaling_group_name = aws_eks_node_group.agents.resources[0].autoscaling_groups[0].name
}

resource "aws_autoscaling_policy" "scale_down" {
  name                   = "${var.cluster_name}-scale-down"
  scaling_adjustment     = -1
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 300
  autoscaling_group_name = aws_eks_node_group.agents.resources[0].autoscaling_groups[0].name
}
```

**Database Module:**

```hcl
# infra/modules/database/main.tf

resource "aws_db_instance" "postgres" {
  identifier     = var.db_identifier
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.instance_class
  
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.rds.arn
  
  db_name  = var.database_name
  username = var.master_username
  password = random_password.master.result
  
  vpc_security_group_ids = [aws_security_group.database.id]
  db_subnet_group_name   = aws_db_subnet_group.database.name
  
  backup_retention_period = var.backup_retention_days
  backup_window           = "03:00-04:00"
  maintenance_window      = "mon:04:00-mon:05:00"
  
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  
  deletion_protection = var.environment == "production" ? true : false
  skip_final_snapshot = var.environment == "production" ? false : true
  final_snapshot_identifier = var.environment == "production" ? "${var.db_identifier}-final-snapshot" : null
  
  tags = {
    Environment = var.environment
  }
}

# Read replica for production
resource "aws_db_instance" "postgres_replica" {
  count = var.environment == "production" ? var.read_replica_count : 0
  
  identifier          = "${var.db_identifier}-replica-${count.index + 1}"
  replicate_source_db = aws_db_instance.postgres.identifier
  instance_class      = var.replica_instance_class
  
  publicly_accessible = false
  
  tags = {
    Environment = var.environment
    Role        = "read-replica"
  }
}

# Store password in Secrets Manager
resource "aws_secretsmanager_secret" "db_password" {
  name = "${var.db_identifier}/master-password"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.master.result
}
```

**Production Environment:**

```hcl
# infra/environments/production/main.tf

module "agent_cluster_us_east_1" {
  source = "../../modules/agent-cluster"
  
  cluster_name        = "agent-prod-us-east-1"
  environment         = "production"
  kubernetes_version  = "1.28"
  
  subnet_ids = [
    aws_subnet.private_us_east_1a.id,
    aws_subnet.private_us_east_1b.id,
    aws_subnet.private_us_east_1c.id,
  ]
  
  instance_types   = ["c6i.2xlarge", "c6i.4xlarge"]
  desired_capacity = 10
  min_capacity     = 5
  max_capacity     = 50
}

module "agent_cluster_us_west_2" {
  source = "../../modules/agent-cluster"
  
  providers = {
    aws = aws.us_west_2
  }
  
  cluster_name        = "agent-prod-us-west-2"
  environment         = "production"
  kubernetes_version  = "1.28"
  
  subnet_ids = [
    aws_subnet.private_us_west_2a.id,
    aws_subnet.private_us_west_2b.id,
    aws_subnet.private_us_west_2c.id,
  ]
  
  instance_types   = ["c6i.2xlarge", "c6i.4xlarge"]
  desired_capacity = 10
  min_capacity     = 5
  max_capacity     = 50
}

module "database" {
  source = "../../modules/database"
  
  db_identifier         = "agent-prod"
  environment           = "production"
  instance_class        = "db.r6g.2xlarge"
  allocated_storage     = 500
  max_allocated_storage = 2000
  
  database_name   = "agents"
  master_username = "postgres"
  
  backup_retention_days = 30
  read_replica_count    = 2
}

module "monitoring" {
  source = "../../modules/monitoring"
  
  environment   = "production"
  cluster_names = [
    module.agent_cluster_us_east_1.cluster_name,
    module.agent_cluster_us_west_2.cluster_name,
  ]
}
```

### CI/CD Pipeline

**GitHub Actions Workflow:**

```yaml
# .github/workflows/deploy.yml

name: Deploy Agent System

on:
  push:
    branches:
      - main
      - develop
  pull_request:
    branches:
      - main

env:
  REGISTRY: registry.example.com
  IMAGE_NAME: agent-api

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
  
  build:
    needs: test
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Log in to registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix=,format=short
      
      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:buildcache
          cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:buildcache,mode=max
  
  deploy-qa:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    environment: qa
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure kubectl
        uses: azure/k8s-set-context@v3
        with:
          method: kubeconfig
          kubeconfig: ${{ secrets.QA_KUBECONFIG }}
      
      - name: Deploy to QA
        run: |
          kubectl set image deployment/agent-api agent-api=${{ needs.build.outputs.image-tag }}
          kubectl rollout status deployment/agent-api
      
      - name: Run smoke tests
        run: npm run test:smoke -- --env=qa
  
  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure kubectl
        uses: azure/k8s-set-context@v3
        with:
          method: kubeconfig
          kubeconfig: ${{ secrets.STAGING_KUBECONFIG }}
      
      - name: Deploy to Staging
        run: |
          kubectl set image deployment/agent-api agent-api=${{ needs.build.outputs.image-tag }}
          kubectl rollout status deployment/agent-api
      
      - name: Run E2E tests
        run: npm run test:e2e -- --env=staging
  
  deploy-production:
    needs: [build, deploy-staging]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure kubectl (US-East-1)
        uses: azure/k8s-set-context@v3
        with:
          method: kubeconfig
          kubeconfig: ${{ secrets.PROD_US_EAST_1_KUBECONFIG }}
      
      - name: Deploy canary to US-East-1
        run: |
          kubectl set image deployment/agent-api-canary agent-api=${{ needs.build.outputs.image-tag }}
          kubectl rollout status deployment/agent-api-canary
      
      - name: Monitor canary
        run: npm run monitor-canary -- --duration=600 # 10 minutes
      
      - name: Promote canary
        run: npm run promote-canary
      
      - name: Configure kubectl (US-West-2)
        uses: azure/k8s-set-context@v3
        with:
          method: kubeconfig
          kubeconfig: ${{ secrets.PROD_US_WEST_2_KUBECONFIG }}
      
      - name: Deploy to US-West-2
        run: |
          kubectl set image deployment/agent-api agent-api=${{ needs.build.outputs.image-tag }}
          kubectl rollout status deployment/agent-api
      
      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Production deployment complete: ${{ needs.build.outputs.image-tag }}",
              "channel": "#deployments"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## Incident Response Playbook

### Incident Classification

**P0 (Critical):**
- Complete system outage
- Data breach/security incident
- Data loss
- **Response Time:** Immediate (page on-call)
- **Resolution SLA:** 1 hour

**P1 (High):**
- Partial outage affecting >50% users
- Performance degradation >50%
- Circuit breaker opened
- **Response Time:** 15 minutes
- **Resolution SLA:** 4 hours

**P2 (Medium):**
- Partial outage affecting <50% users
- Non-critical feature down
- High error rate (>5%)
- **Response Time:** 1 hour
- **Resolution SLA:** 24 hours

**P3 (Low):**
- Minor issues
- Low error rate (<5%)
- **Response Time:** Next business day
- **Resolution SLA:** 1 week

### Incident Response Process

**1. Detection**

```typescript
// observability-kit/incident-detection.ts

class IncidentDetector {
  async detectIncidents(): Promise<Incident[]> {
    const incidents: Incident[] = [];
    
    // Check error rate
    const errorRate = await this.getErrorRate();
    if (errorRate > 0.05) {
      incidents.push({
        severity: 'P1',
        title: 'High Error Rate',
        description: `Error rate at ${(errorRate * 100).toFixed(2)}%`,
        affectedService: 'agent-api',
      });
    }
    
    // Check latency
    const latencyP95 = await this.getLatencyP95();
    if (latencyP95 > 5000) {
      incidents.push({
        severity: 'P2',
        title: 'High Latency',
        description: `P95 latency at ${latencyP95}ms`,
        affectedService: 'agent-api',
      });
    }
    
    // Check circuit breakers
    const openCircuits = await this.getOpenCircuits();
    if (openCircuits.length > 0) {
      incidents.push({
        severity: 'P1',
        title: 'Circuit Breaker Opened',
        description: `Circuits open: ${openCircuits.join(', ')}`,
        affectedService: 'agent-system',
      });
    }
    
    return incidents;
  }
}
```

**2. Alerting**

```typescript
// observability-kit/incident-alerting.ts

class IncidentAlerter {
  async alert(incident: Incident): Promise<void> {
    // Create PagerDuty incident
    const pdIncident = await this.pagerduty.incidents.create({
      incident: {
        type: 'incident',
        title: incident.title,
        service: { id: process.env.PAGERDUTY_SERVICE_ID, type: 'service_reference' },
        urgency: incident.severity === 'P0' ? 'high' : 'low',
        body: { type: 'incident_body', details: incident.description },
      },
    });
    
    // Post to Slack
    await this.slack.chat.postMessage({
      channel: '#incidents',
      text: `🚨 ${incident.severity} Incident: ${incident.title}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `🚨 ${incident.severity} Incident` },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Title:*\n${incident.title}` },
            { type: 'mrkdwn', text: `*Severity:*\n${incident.severity}` },
            { type: 'mrkdwn', text: `*Service:*\n${incident.affectedService}` },
            { type: 'mrkdwn', text: `*Time:*\n${new Date().toISOString()}` },
          ],
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Description:*\n${incident.description}` },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View in PagerDuty' },
              url: `https://example.pagerduty.com/incidents/${pdIncident.id}`,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Metrics' },
              url: 'https://grafana.example.com',
            },
          ],
        },
      ],
    });
  }
}
```

**3. Runbooks**

```markdown
# Runbook: High Error Rate

## Symptoms
- Error rate >5%
- Increased 5xx responses
- Alerts firing

## Investigation Steps

1. **Check recent deployments**
   ```bash
   kubectl rollout history deployment/agent-api
   ```
   
   - If recent deployment, consider rollback

2. **Check application logs**
   ```bash
   kubectl logs -l app=agent-api --tail=100 --since=10m | grep ERROR
   ```
   
   - Look for common error patterns
   - Check stack traces

3. **Check external dependencies**
   - Database: Connection pool exhausted?
   - Redis: Memory issues?
   - External APIs: Rate limited? Down?

4. **Check resource usage**
   ```bash
   kubectl top pods -l app=agent-api
   ```
   
   - CPU throttling?
   - Memory pressure?

5. **Check metrics**
   - Grafana dashboard: https://grafana.example.com/d/agent-overview
   - Look for anomalies

## Mitigation Steps

### If caused by recent deployment:
```bash
# Rollback
kubectl rollout undo deployment/agent-api

# Verify
kubectl rollout status deployment/agent-api
```

### If caused by traffic spike:
```bash
# Scale up
kubectl scale deployment agent-api --replicas=20

# Verify
kubectl get pods -l app=agent-api
```

### If caused by database issues:
```bash
# Check database connections
psql -h $DB_HOST -U $DB_USER -c "SELECT count(*) FROM pg_stat_activity;"

# Kill idle connections if needed
psql -h $DB_HOST -U $DB_USER -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < now() - interval '5 minutes';"
```

### If caused by external API:
```bash
# Enable circuit breaker for specific service
kubectl set env deployment/agent-api STRIPE_CIRCUIT_BREAKER=true

# Or switch to degraded mode
kubectl set env deployment/agent-api FEATURE_FLAG_AI_AGENT=false
```

## Communication

1. Update incident channel:
   ```
   Status: Investigating
   Impact: Increased error rate affecting X% of requests
   Actions: [What you're doing]
   ```

2. If customer-facing impact, notify:
   - Support team
   - Status page (https://status.example.com)

## Resolution

1. Verify error rate back to normal
2. Document root cause
3. Create follow-up tasks to prevent recurrence
4. Post incident review (within 48 hours)
```

**4. Post-Incident Review**

```markdown
# Post-Incident Review Template

**Incident ID:** INC-2026-02-05-001  
**Date:** 2026-02-05  
**Severity:** P1  
**Duration:** 45 minutes  
**Responders:** Alice (on-call), Bob (SRE), Carol (Engineering Manager)

## Summary

[Brief summary of what happened]

## Timeline

- **14:23 UTC:** Alert fired: High error rate
- **14:25 UTC:** On-call engineer paged
- **14:28 UTC:** Investigation started
- **14:35 UTC:** Root cause identified (database connection pool exhausted)
- **14:40 UTC:** Mitigation applied (increased pool size)
- **14:50 UTC:** Service recovered
- **15:08 UTC:** Incident closed

## Root Cause

[Detailed explanation of what caused the incident]

## Impact

- **Users affected:** ~5,000 users
- **Error rate:** 15% peak
- **Revenue impact:** ~$2,000 in lost transactions
- **Customer complaints:** 12

## What Went Well

- Alert fired quickly (within 2 minutes)
- On-call responded promptly
- Clear runbooks made investigation efficient
- Communication was clear and timely

## What Didn't Go Well

- Database connection pool too small for traffic
- No automated scaling for connection pool
- Took 12 minutes to identify root cause (could be faster)

## Action Items

1. [ ] Increase database connection pool size (Owner: Alice, Due: 2026-02-06)
2. [ ] Implement auto-scaling for DB pool based on traffic (Owner: Bob, Due: 2026-02-12)
3. [ ] Add metric for connection pool utilization (Owner: Bob, Due: 2026-02-08)
4. [ ] Update runbook with connection pool troubleshooting (Owner: Alice, Due: 2026-02-06)
5. [ ] Load test with 2x current peak traffic (Owner: Carol, Due: 2026-02-15)

## Lessons Learned

[What we learned that will help prevent similar incidents]
```

---

## Operational Excellence

### Disaster Recovery

**RTO (Recovery Time Objective):** 1 hour  
**RPO (Recovery Point Objective):** 5 minutes

**Backup Strategy:**

```yaml
# k8s/velero-backup.yaml

apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: daily-backup
  namespace: velero
spec:
  schedule: "0 1 * * *"  # 1 AM daily
  template:
    includedNamespaces:
      - agent-system
    includedResources:
      - '*'
    excludedResources:
      - events
    storageLocation: default
    volumeSnapshotLocations:
      - default
    ttl: 720h  # 30 days retention
```

**Database Backup:**

```bash
#!/bin/bash
# scripts/db-backup.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="agent-prod-${TIMESTAMP}.sql.gz"

# Create backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > /tmp/$BACKUP_FILE

# Upload to S3
aws s3 cp /tmp/$BACKUP_FILE s3://example-backups/database/$BACKUP_FILE

# Verify backup
aws s3 ls s3://example-backups/database/$BACKUP_FILE

# Test restore (in staging)
if [ "$ENVIRONMENT" = "staging" ]; then
  gunzip < /tmp/$BACKUP_FILE | psql -h $STAGING_DB_HOST -U $DB_USER -d test_restore
fi

# Cleanup local copy
rm /tmp/$BACKUP_FILE

echo "Backup complete: $BACKUP_FILE"
```

**Disaster Recovery Drill:**

```bash
#!/bin/bash
# scripts/dr-drill.sh

echo "Starting Disaster Recovery Drill..."

# 1. Simulate primary region failure
echo "Simulating primary region failure..."
kubectl config use-context dr-cluster

# 2. Restore from backup
echo "Restoring Kubernetes resources..."
velero restore create --from-backup daily-backup-20260205

# 3. Restore database
echo "Restoring database..."
LATEST_BACKUP=$(aws s3 ls s3://example-backups/database/ | sort | tail -n 1 | awk '{print $4}')
aws s3 cp s3://example-backups/database/$LATEST_BACKUP /tmp/restore.sql.gz
gunzip < /tmp/restore.sql.gz | psql -h $DR_DB_HOST -U $DB_USER -d $DB_NAME

# 4. Update DNS
echo "Updating DNS to point to DR region..."
aws route53 change-resource-record-sets --hosted-zone-id $ZONE_ID --change-batch file://dr-dns-update.json

# 5. Verify
echo "Verifying services..."
curl -f https://api.example.com/health || exit 1

echo "DR drill complete! ✅"
```

### Cost Optimization

**Right-Sizing:**

```typescript
// scripts/cost-optimization.ts

async function analyzeResourceUsage() {
  const pods = await k8s.listPods();
  
  for (const pod of pods) {
    const metrics = await k8s.getPodMetrics(pod.name);
    
    const cpuUsage = metrics.cpu / pod.spec.containers[0].resources.requests.cpu;
    const memUsage = metrics.memory / pod.spec.containers[0].resources.requests.memory;
    
    // Over-provisioned (using <50% of requests)
    if (cpuUsage < 0.5 || memUsage < 0.5) {
      console.log(`⚠️ ${pod.name} is over-provisioned`);
      console.log(`  CPU: ${(cpuUsage * 100).toFixed(1)}% utilized`);
      console.log(`  Memory: ${(memUsage * 100).toFixed(1)}% utilized`);
      console.log(`  Recommendation: Reduce requests by 50%`);
    }
    
    // Under-provisioned (using >90% of requests)
    if (cpuUsage > 0.9 || memUsage > 0.9) {
      console.log(`🚨 ${pod.name} is under-provisioned`);
      console.log(`  CPU: ${(cpuUsage * 100).toFixed(1)}% utilized`);
      console.log(`  Memory: ${(memUsage * 100).toFixed(1)}% utilized`);
      console.log(`  Recommendation: Increase requests by 50%`);
    }
  }
}
```

**Spot Instances:**

```hcl
# infra/modules/agent-cluster/spot-instances.tf

resource "aws_eks_node_group" "spot_workers" {
  cluster_name    = aws_eks_cluster.agent_cluster.name
  node_group_name = "spot-workers"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.subnet_ids
  
  capacity_type = "SPOT"
  
  scaling_config {
    desired_size = var.spot_desired_capacity
    max_size     = var.spot_max_capacity
    min_size     = var.spot_min_capacity
  }
  
  instance_types = [
    "c6i.2xlarge",
    "c6i.4xlarge",
    "c5.2xlarge",
    "c5.4xlarge",
  ]
  
  labels = {
    lifecycle = "spot"
  }
  
  taint {
    key    = "spot"
    value  = "true"
    effect = "NO_SCHEDULE"
  }
  
  tags = {
    Name = "spot-worker"
  }
}
```

### Performance Tuning

**Database Query Optimization:**

```sql
-- Create indexes for common queries
CREATE INDEX CONCURRENTLY idx_audit_log_agent_id ON audit_log(agent_id);
CREATE INDEX CONCURRENTLY idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX CONCURRENTLY idx_audit_log_event_type ON audit_log(event_type);

-- Composite index for common filter combinations
CREATE INDEX CONCURRENTLY idx_audit_log_agent_event_time 
  ON audit_log(agent_id, event_type, timestamp DESC);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM audit_log 
WHERE agent_id = 'agent-123' 
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC
LIMIT 100;
```

**Caching Strategy:**

```typescript
// cache/redis-cache.ts

import Redis from 'ioredis';

class CacheService {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
    });
  }
  
  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }
  
  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }
  
  async remember<T>(
    key: string,
    ttl: number,
    factory: () => Promise<T>
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached) {
      return cached;
    }
    
    // Cache miss, fetch from source
    const value = await factory();
    await this.set(key, value, ttl);
    
    return value;
  }
}

// Usage
const cache = new CacheService();

async function getCustomer(customerId: string): Promise<Customer> {
  return cache.remember(
    `customer:${customerId}`,
    300, // 5 minutes
    async () => {
      return await db.customers.findUnique({ where: { id: customerId } });
    }
  );
}
```

---

**Congratulations!** You now have a complete production-grade agent deployment architecture with governance, security, monitoring, and operational excellence built in from day one.

**What's Next?**
1. Customize templates for your use case
2. Run through the pre-launch checklist
3. Start with QA environment, validate, promote to production
4. Monitor, iterate, improve

---

**Complete Playbook:**
- [Section 1: Workflow Redesign Patterns](./01-workflow-redesign.md)
- [Section 2: Governance-First Architecture](./02-governance-architecture.md)
- [Section 3: Production Readiness Checklist](./03-production-readiness.md)
- [Section 4: Reference Architecture](./04-reference-architecture.md) ← You are here
