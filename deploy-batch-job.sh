#!/bin/bash
set -e

PROJECT_ID="${GCP_PROJECT_ID}"
REGION="us-central1"
JOB_NAME="guideway-batch-job"
IMAGE="gcr.io/${PROJECT_ID}/${JOB_NAME}"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: GCP_PROJECT_ID environment variable is not set"
  exit 1
fi

echo "=== Deploying Guideway Batch Job to Cloud Run Jobs ==="
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Job: ${JOB_NAME}"
echo ""

echo "Step 1: Building Docker image from Dockerfile.batch..."
gcloud builds submit --tag "${IMAGE}:latest" --project "${PROJECT_ID}" -f Dockerfile.batch .

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
echo ""
echo "To run with custom batch size:"
echo "  gcloud run jobs execute ${JOB_NAME} --region ${REGION} --project ${PROJECT_ID} --update-env-vars BATCH_SIZE=100"
