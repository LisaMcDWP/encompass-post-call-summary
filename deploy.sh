#!/bin/bash
set -e

PROJECT_ID="${GCP_PROJECT_ID}"
REGION="us-central1"
SERVICE_NAME="guideway-care-api"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: GCP_PROJECT_ID environment variable is not set"
  exit 1
fi

echo "=== Deploying Guideway Care API to Cloud Run ==="
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"
echo ""

echo "Step 1: Building Docker image..."
gcloud builds submit --tag "${IMAGE}:latest" --project "${PROJECT_ID}"

echo ""
echo "Step 2: Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}:latest" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production,GCP_PROJECT_ID=${PROJECT_ID}" \
  --set-secrets "GCP_SERVICE_ACCOUNT_KEY=GCP_SERVICE_ACCOUNT_KEY:latest" \
  --project "${PROJECT_ID}"

echo ""
echo "=== Deployment complete ==="
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --project "${PROJECT_ID}" --format "value(status.url)")
echo "Service URL: ${SERVICE_URL}"
echo ""
echo "API Endpoints:"
echo "  POST ${SERVICE_URL}/api/analyze"
echo "  GET  ${SERVICE_URL}/api/prompt"
echo "  GET  ${SERVICE_URL}/api/health"
