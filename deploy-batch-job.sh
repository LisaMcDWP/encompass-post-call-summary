#!/bin/bash
set -e

PROJECT_ID="${GCP_PROJECT_ID:-encompass-476415}"
REGION="us-central1"
JOB_NAME="guideway-batch-job"
IMAGE="gcr.io/${PROJECT_ID}/${JOB_NAME}"

echo "=== Deploying Guideway Batch Job to Cloud Run Jobs ==="
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Job: ${JOB_NAME}"
echo ""

echo "Step 1: Building Docker image from Dockerfile.batch..."
gcloud builds submit --config cloudbuild-batch.yaml --project "${PROJECT_ID}" .

echo ""
echo "Step 2: Creating/Updating Cloud Run Job..."
gcloud run jobs deploy "${JOB_NAME}" \
  --image "${IMAGE}:latest" \
  --region "${REGION}" \
  --task-timeout 3600 \
  --max-retries 1 \
  --set-env-vars "NODE_ENV=production,GCP_PROJECT_ID=${PROJECT_ID},BATCH_SIZE=50,BATCH_DELAY_MS=1000" \
  --set-secrets "GCP_SERVICE_ACCOUNT_KEY=GCP_SERVICE_ACCOUNT_KEY:latest" \
  --memory 1Gi \
  --cpu 1 \
  --project "${PROJECT_ID}"

echo ""
echo "=== Batch Job Deployment complete ==="
echo "Job: ${JOB_NAME}"
echo ""
echo "To run manually:"
echo "  gcloud run jobs execute ${JOB_NAME} --region ${REGION} --project ${PROJECT_ID}"
