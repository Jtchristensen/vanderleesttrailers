# VanderLeest Trailers - CDK Deployment

AWS CDK stack for deploying the VanderLeest Trailers Angular website as a static site on S3 + CloudFront.

## Architecture

- **S3 Bucket** - Stores the built Angular app. All public access is blocked.
- **CloudFront Distribution** - Serves the site over HTTPS using an Origin Access Identity (OAI) to read from S3.
- **SPA Routing** - Custom error responses redirect 404/403 errors to `/index.html` so Angular handles client-side routing.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [AWS CLI](https://aws.amazon.com/cli/) configured with credentials
- [AWS CDK CLI](https://docs.aws.amazon.com/cdk/v2/guide/cli.html) (`npm install -g aws-cdk`)

## Setup

```bash
cd cdk
npm install
```

## Build the Angular App

Before deploying, build the frontend:

```bash
cd ../frontend
npm install
npm run build
```

This produces the output in `frontend/dist/frontend/browser`, which the CDK stack deploys to S3.

## Deploy

```bash
# Bootstrap CDK (first time only)
cdk bootstrap

# Preview changes
cdk diff

# Deploy the stack
cdk deploy
```

After deployment, the CloudFront URL will be printed as a stack output.

## Destroy

To tear down all resources:

```bash
cdk destroy
```

The S3 bucket has `RemovalPolicy.DESTROY` and `autoDeleteObjects` enabled, so it will be fully cleaned up.
