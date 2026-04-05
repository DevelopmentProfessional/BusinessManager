# AWS Migration Guide: Render → AWS

This guide migrates your BusinessManager application from Render to AWS. It is split into two phases:

- **Phase 1** — Steps you perform manually to create the AWS AI Agent.
- **Phase 2** — Instructions you hand to the AI Agent. It reads them and provisions everything else for you.

---

## What Will Be Migrated

| Service | Current (Render) | Target (AWS) |
|---|---|---|
| Staff Backend API (`backend/`) | Python web service | AWS App Runner |
| Staff Frontend (`frontend/`) | Static site | S3 + CloudFront |
| Client API (`client-api/`) | Python web service | AWS App Runner |
| Client Portal (`client-portal/`) | Static site | S3 + CloudFront |
| OnlyOffice | Docker web service | ECS Fargate |
| Database | Render PostgreSQL | Amazon RDS (PostgreSQL 15) |

**AWS Region:** `us-east-1` (N. Virginia) — use this for every step.

---

## Phase 1: Manual Setup (You Do This)

These are the only steps you perform manually. After this, the AI Agent handles the rest.

---

### Step 1: Confirm AWS Account Access

1. Sign in to [https://console.aws.amazon.com](https://console.aws.amazon.com).
2. Confirm your account has **Administrator Access** (or ask your AWS admin to confirm this).
3. In the top-right region selector, choose **US East (N. Virginia) — us-east-1**.

---

### Step 2: Enable Amazon Bedrock Model Access

1. In the AWS Console search bar, type **Bedrock** and open the service.
2. In the left sidebar, click **Model access**.
3. Click **Modify model access**.
4. Find **Anthropic → Claude 3.7 Sonnet** and tick its checkbox.
5. Click **Save changes**. Wait until the status shows **Access granted** (this can take a few minutes).

---

### Step 3: Create an IAM Role for the Bedrock Agent

The agent needs permission to provision AWS resources on your behalf.

1. In the AWS Console search bar, type **IAM** and open the service.
2. In the left sidebar, click **Roles**, then click **Create role**.
3. For **Trusted entity type**, select **AWS service**.
4. For **Service or use case**, scroll down and choose **Bedrock**.
5. Choose **Bedrock - Agent** as the use case, then click **Next**.
6. On the **Add permissions** screen, search for and attach each of these policies one at a time:
   - `AmazonRDSFullAccess`
   - `AmazonEC2FullAccess`
   - `AmazonECRFullAccess`
   - `AWSAppRunnerFullAccess`
   - `AmazonS3FullAccess`
   - `CloudFrontFullAccess`
   - `AmazonECS_FullAccess`
   - `SecretsManagerReadWrite`
   - `AWSCloudFormationFullAccess`
   - `IAMFullAccess`
7. Click **Next**.
8. Set the **Role name** to: `BusinessManagerAgentRole`
9. Click **Create role**.

---

### Step 4: Create the Amazon Bedrock Agent

1. Go back to the **Amazon Bedrock** service in the console.
2. In the left sidebar, under **Builder tools**, click **Agents**.
3. Click **Create Agent**.
4. Fill in the form as follows:
   - **Agent name:** `BusinessManagerMigrationAgent`
   - **Description:** Provisions AWS infrastructure for the BusinessManager migration from Render.
   - **Agent resource role:** Select `BusinessManagerAgentRole` (the role you just created).
   - **Model:** Select **Anthropic Claude 3.7 Sonnet**.
5. In the **Agent instructions** box, paste the following:

   ```
   You are an AWS infrastructure provisioning agent. Your job is to read the Phase 2
   instructions in this guide and execute each step in order using AWS APIs and CLI
   commands. For each step, confirm completion before moving to the next. If a resource
   already exists, skip its creation and continue. Never delete existing resources.
   Ask for confirmation before any step that creates a cost-bearing resource.
   ```

6. Under **Additional settings**, enable **Code Interpreter** by toggling it on. This allows the agent to run Python (boto3) scripts to provision resources.
7. Click **Save**, then click **Prepare**.
8. Wait for the agent status to show **Prepared**.

---

### Step 5: Open the Agent and Load Phase 2

1. On the agent's detail page, click **Test** to open the agent chat panel.
2. Copy the entire **Phase 2** section below (from "## Phase 2" to the end of the file).
3. Paste it into the agent chat and send it.
4. The agent will begin executing each step. Review and approve each action when prompted.

---

## Phase 2: Infrastructure Setup (Agent Executes These Steps)

> **For the AI Agent:** Execute each numbered step below in order. Use the AWS SDK (boto3) via the Code Interpreter, or issue AWS CLI commands. After completing each step, state what was created and its identifier (ARN, endpoint, URL, etc.) before continuing to the next step. All resources must be created in region `us-east-1`.

---

### Step 1: Create the RDS PostgreSQL Database

Create a PostgreSQL 15 database instance with these exact settings:

- **DB instance identifier:** `businessmanager-db`
- **Engine:** PostgreSQL 15
- **Instance class:** `db.t3.medium`
- **Storage:** 20 GB, gp2, auto-scaling disabled
- **DB name:** `businessmanager`
- **Master username:** `businessmanager`
- **Master password:** Generate a secure random 24-character password (letters and numbers only, no special characters). Save this password — it will be stored in Secrets Manager in Step 2.
- **VPC:** Use the default VPC.
- **Public access:** Yes (set to publicly accessible so App Runner can connect during initial setup).
- **VPC security group:** Create a new security group named `businessmanager-db-sg` that allows inbound TCP on port 5432 from anywhere (0.0.0.0/0). This will be tightened later.
- **Multi-AZ:** Disabled.
- **Automated backups:** Enabled, 7-day retention.
- **Deletion protection:** Enabled.

After creation, record the **endpoint URL** (format: `businessmanager-db.xxxx.us-east-1.rds.amazonaws.com`).

---

### Step 2: Store Secrets in AWS Secrets Manager

Create three secrets in Secrets Manager. All secrets are in region `us-east-1`.

**Secret 1 — Database URL:**
- **Secret name:** `businessmanager/database-url`
- **Secret type:** Other type of secret (plain text)
- **Secret value:**
  ```
  postgresql+psycopg://businessmanager:<PASSWORD>@<RDS_ENDPOINT>:5432/businessmanager
  ```
  Replace `<PASSWORD>` with the database password from Step 1 and `<RDS_ENDPOINT>` with the RDS endpoint.

**Secret 2 — Staff Backend environment:**
- **Secret name:** `businessmanager/staff-backend`
- **Secret type:** Other type of secret (key/value pairs)
- **Key/value pairs:**
  - `DATABASE_URL` → same value as Secret 1
  - `SKIP_STARTUP_DB_BOOTSTRAP` → `true`
  - `ENVIRONMENT` → `production`
  - `ALLOWED_ORIGINS` → `https://businessmanager.yourdomain.com,https://client.yourdomain.com` *(placeholder — user will update with real domain)*

**Secret 3 — Client API environment:**
- **Secret name:** `businessmanager/client-api`
- **Secret type:** Other type of secret (key/value pairs)
- **Key/value pairs:**
  - `DATABASE_URL` → same value as Secret 1
  - `ENVIRONMENT` → `production`
  - `ALLOWED_ORIGINS` → `https://client.yourdomain.com` *(placeholder — user will update with real domain)*

---

### Step 3: Create ECR Repositories

Create two Amazon ECR (Elastic Container Registry) private repositories in `us-east-1`:

1. **Repository 1:**
   - Name: `businessmanager-staff-api`
   - Image tag mutability: Mutable
   - Scan on push: Enabled

2. **Repository 2:**
   - Name: `businessmanager-client-api`
   - Image tag mutability: Mutable
   - Scan on push: Enabled

After creation, record the repository URIs. They will look like:
- `<ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/businessmanager-staff-api`
- `<ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/businessmanager-client-api`

---

### Step 4: Generate Dockerfile for the Staff Backend API

Create a file at `backend/Dockerfile` in the repository with this exact content:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Also create `backend/.dockerignore` with:

```
__pycache__
*.pyc
*.pyo
uploads/
*.db
.env
```

---

### Step 5: Generate Dockerfile for the Client API

Create a file at `client-api/Dockerfile` with this exact content:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Also create `client-api/.dockerignore` with:

```
__pycache__
*.pyc
*.pyo
.env
```

---

### Step 6: Create an IAM Role for App Runner

App Runner services need permission to pull images from ECR and read from Secrets Manager.

Create an IAM role with:
- **Role name:** `BusinessManagerAppRunnerRole`
- **Trusted entity:** `build.apprunner.amazonaws.com`
- **Attached policies:**
  - `AmazonEC2ContainerRegistryReadOnly`
  - `SecretsManagerReadWrite`

---

### Step 7: Deploy the Staff Backend API to App Runner

Create an App Runner service with these settings:

- **Service name:** `businessmanager-staff-api`
- **Source:** Container registry → Amazon ECR → repository `businessmanager-staff-api`, tag `latest`
- **ECR access role:** `BusinessManagerAppRunnerRole`
- **Port:** `8080`
- **CPU:** 1 vCPU
- **Memory:** 2 GB
- **Environment variables:** Load all key/value pairs from the Secrets Manager secret `businessmanager/staff-backend`
- **Auto-scaling:** Min 1 instance, Max 3 instances
- **Health check path:** `/health` (if endpoint exists), otherwise `/`

After the service is created and running, record the **service URL** (format: `https://xxxx.us-east-1.awsapprunner.com`).

> **Note for user:** Before App Runner can deploy, you must build and push the Docker image to ECR. After this guide is executed, run the following from your machine inside the `backend/` directory:
> ```
> aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com
> docker build -t businessmanager-staff-api .
> docker tag businessmanager-staff-api:latest <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/businessmanager-staff-api:latest
> docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/businessmanager-staff-api:latest
> ```

---

### Step 8: Deploy the Client API to App Runner

Create a second App Runner service with these settings:

- **Service name:** `businessmanager-client-api`
- **Source:** Container registry → Amazon ECR → repository `businessmanager-client-api`, tag `latest`
- **ECR access role:** `BusinessManagerAppRunnerRole`
- **Port:** `8080`
- **CPU:** 1 vCPU
- **Memory:** 2 GB
- **Environment variables:** Load all key/value pairs from the Secrets Manager secret `businessmanager/client-api`
- **Auto-scaling:** Min 1 instance, Max 3 instances
- **Health check path:** `/`

After creation, record the **service URL**.

> **Note for user:** Build and push the client-api image similarly to Step 7, using the `businessmanager-client-api` repository and running the commands from inside the `client-api/` directory.

---

### Step 9: Create S3 Bucket for the Staff Frontend

1. Create an S3 bucket:
   - **Bucket name:** `businessmanager-staff-frontend` (append your AWS account ID if the name is taken)
   - **Region:** `us-east-1`
   - **Block all public access:** Leave enabled (CloudFront will serve the content).
   - **Versioning:** Disabled.

2. Enable **Static website hosting** on the bucket:
   - Index document: `index.html`
   - Error document: `index.html` (needed for React client-side routing)

---

### Step 10: Create CloudFront Distribution for the Staff Frontend

Create a CloudFront distribution:

- **Origin domain:** The S3 bucket `businessmanager-staff-frontend`
- **Origin access:** Use **Origin Access Control (OAC)** — create a new OAC named `businessmanager-staff-oac`
- **Viewer protocol policy:** Redirect HTTP to HTTPS
- **Default root object:** `index.html`
- **Cache policy:** CachingOptimized
- **Custom error responses:**
  - HTTP error code `403` → Response page path `/index.html` → HTTP response code `200`
  - HTTP error code `404` → Response page path `/index.html` → HTTP response code `200`

After creation, update the S3 bucket policy to allow the CloudFront OAC to read from it.

Record the **CloudFront domain name** (format: `xxxx.cloudfront.net`).

---

### Step 11: Create S3 Bucket and CloudFront Distribution for the Client Portal

Repeat Steps 9 and 10 for the client portal, using:

- **S3 bucket name:** `businessmanager-client-portal`
- **OAC name:** `businessmanager-client-oac`
- Record the **CloudFront domain name** for the client portal.

---

### Step 12: Deploy OnlyOffice to ECS Fargate

1. Create an ECS Cluster:
   - **Cluster name:** `businessmanager-cluster`
   - **Infrastructure:** AWS Fargate (serverless)

2. Create a Task Definition:
   - **Task definition family:** `onlyoffice-task`
   - **Launch type:** Fargate
   - **CPU:** 2 vCPU
   - **Memory:** 4 GB
   - **Container:**
     - Name: `onlyoffice`
     - Image: `onlyoffice/documentserver`
     - Port mappings: `80` (TCP)
     - Environment variable: `JWT_ENABLED` = `false`

3. Create an ECS Service:
   - **Service name:** `onlyoffice-service`
   - **Cluster:** `businessmanager-cluster`
   - **Task definition:** `onlyoffice-task`
   - **Desired tasks:** 1
   - **Launch type:** Fargate
   - **VPC:** Default VPC
   - **Subnets:** Select all available subnets
   - **Security group:** Create new `onlyoffice-sg` allowing inbound TCP on port 80 from anywhere

4. Create an **Application Load Balancer**:
   - **Name:** `onlyoffice-alb`
   - **Scheme:** Internet-facing
   - **Port:** 80 (HTTPS on 443 after certificate is set up)
   - Target the ECS service.

Record the **ALB DNS name**.

---

### Step 13: Summary — Record All Endpoints

At this point, report back with a summary table of all created resources and their URLs/endpoints:

| Resource | Identifier / URL |
|---|---|
| RDS Endpoint | |
| Staff API (App Runner) | |
| Client API (App Runner) | |
| Staff Frontend (CloudFront) | |
| Client Portal (CloudFront) | |
| OnlyOffice (ALB) | |
| ECR — Staff API | |
| ECR — Client API | |

---

## Phase 3: Final Steps (You Complete These)

After the agent has finished Phase 2, complete the following manually.

---

### Step 1: Build and Push Docker Images

On your local machine, with Docker and the AWS CLI installed and configured:

**Staff Backend:**
```bash
cd backend/
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com
docker build -t businessmanager-staff-api .
docker tag businessmanager-staff-api:latest <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/businessmanager-staff-api:latest
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/businessmanager-staff-api:latest
```

**Client API:**
```bash
cd client-api/
docker build -t businessmanager-client-api .
docker tag businessmanager-client-api:latest <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/businessmanager-client-api:latest
docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/businessmanager-client-api:latest
```

Then go to each App Runner service in the console and click **Deploy** to pick up the new image.

---

### Step 2: Build and Deploy the Frontend Apps

**Staff Frontend:**
```bash
cd frontend/
VITE_API_URL=https://<STAFF_APP_RUNNER_URL>/api/v1 npm run build
aws s3 sync dist/ s3://businessmanager-staff-frontend --delete
aws cloudfront create-invalidation --distribution-id <STAFF_CF_DIST_ID> --paths "/*"
```

**Client Portal:**
```bash
cd client-portal/
VITE_CLIENT_API_URL=https://<CLIENT_APP_RUNNER_URL>/api/client npm run build
aws s3 sync dist/ s3://businessmanager-client-portal --delete
aws cloudfront create-invalidation --distribution-id <CLIENT_CF_DIST_ID> --paths "/*"
```

---

### Step 3: Migrate Database Data from Render

1. From your Render dashboard, get your current PostgreSQL connection string.
2. Export the database:
   ```bash
   pg_dump "<RENDER_DATABASE_URL>" -Fc -f businessmanager_backup.dump
   ```
3. Import into RDS:
   ```bash
   pg_restore -h <RDS_ENDPOINT> -U businessmanager -d businessmanager -Fc businessmanager_backup.dump
   ```
   Enter the RDS master password when prompted.

---

### Step 4: Update ALLOWED_ORIGINS in Secrets Manager

1. Open Secrets Manager in the AWS Console.
2. Edit `businessmanager/staff-backend` and set `ALLOWED_ORIGINS` to your actual CloudFront URLs:
   ```
   https://xxxx.cloudfront.net,https://yyyy.cloudfront.net
   ```
3. Edit `businessmanager/client-api` and set `ALLOWED_ORIGINS` to the client portal CloudFront URL.
4. Redeploy both App Runner services to pick up the updated secrets.

---

### Step 5: Run Database Initialization on AWS

Once the staff backend App Runner service is running and connected to RDS, trigger the database initialization:

```bash
curl -X POST https://<STAFF_APP_RUNNER_URL>/api/v1/admin/init-db
```

Or connect directly and run:
```bash
python backend/init_database.py
```

---

### Step 6: Verify All Services

Test each service:

1. **Staff Backend API:** `https://<STAFF_APP_RUNNER_URL>/docs` — should show the FastAPI docs page.
2. **Client API:** `https://<CLIENT_APP_RUNNER_URL>/docs` — should show the FastAPI docs page.
3. **Staff Frontend:** `https://<STAFF_CF_DOMAIN>/` — should load the staff login page.
4. **Client Portal:** `https://<CLIENT_CF_DOMAIN>/` — should load the client portal.
5. **OnlyOffice:** `http://<ONLYOFFICE_ALB_DNS>/` — should show the OnlyOffice welcome page.
6. **Database:** Log in to the staff app and confirm data is present.

---

### Step 7: Set Up Custom Domains (Optional)

If you have a domain (e.g., `yourdomain.com`):

1. In **AWS Certificate Manager (ACM)**, request a public certificate for your domains (e.g., `*.yourdomain.com`).
2. Validate the certificate via DNS (add the CNAME records ACM provides to your DNS host).
3. In CloudFront, add your custom domain to each distribution and attach the certificate.
4. In App Runner, add a custom domain under **Custom domains** and update your DNS with the provided CNAME.
5. Update `ALLOWED_ORIGINS` in Secrets Manager to use your real domains.

---

### Step 8: Enable Monitoring

1. In **CloudWatch**, create a dashboard named `BusinessManager`.
2. Add widgets for:
   - App Runner request count and 5xx errors (both services)
   - RDS CPU utilization and free storage
   - CloudFront error rate (both distributions)
3. Set up a CloudWatch Alarm on App Runner 5xx errors > 10/minute to notify you by email via SNS.

---

## Cost Estimate (Monthly, us-east-1)

| Service | Estimated Cost |
|---|---|
| RDS db.t3.medium (single-AZ) | ~$60/month |
| App Runner × 2 (1 vCPU / 2 GB, min 1 instance) | ~$50/month total |
| S3 + CloudFront × 2 (low traffic) | ~$5/month total |
| ECS Fargate — OnlyOffice (2 vCPU / 4 GB) | ~$70/month |
| Secrets Manager (3 secrets) | ~$2/month |
| **Total estimate** | **~$190/month** |

Costs will vary with actual traffic. OnlyOffice can be stopped when not in use to reduce costs.
