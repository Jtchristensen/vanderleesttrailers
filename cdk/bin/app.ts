#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { VanderLeestTrailersStack } from "../lib/vanderleest-stack";

const app = new cdk.App();

new VanderLeestTrailersStack(app, "VanderLeestTrailersStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: "Static website hosting for VanderLeest Trailers Angular app",
});
