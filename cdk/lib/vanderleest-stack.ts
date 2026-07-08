import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as cr from "aws-cdk-lib/custom-resources";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import * as path from "path";

export class VanderLeestTrailersStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ============================================================
    // S3 BUCKETS
    // ============================================================

    // Static website bucket
    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Image uploads bucket
    const imagesBucket = new s3.Bucket(this, "ImagesBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ["*"],
          maxAge: 3000,
        },
      ],
    });

    // ============================================================
    // DYNAMODB
    // ============================================================

    const contentTable = new dynamodb.Table(this, "ContentTable", {
      tableName: "VanderLeestContent",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const leadsTable = new dynamodb.Table(this, "LeadsTable", {
      tableName: "VanderLeestLeads",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ============================================================
    // COGNITO
    // ============================================================

    const userPool = new cognito.UserPool(this, "AdminUserPool", {
      userPoolName: "VanderLeestAdminPool",
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, "AdminClient", {
      userPool,
      userPoolClientName: "VanderLeestAdminClient",
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    // ============================================================
    // LAMBDA FUNCTIONS
    // ============================================================

    // Public content API
    const contentApiLambda = new lambda.Function(this, "ContentApi", {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../lambda/content-api")
      ),
      environment: {
        TABLE_NAME: contentTable.tableName,
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
    });
    contentTable.grantReadData(contentApiLambda);

    // Admin API
    const adminApiLambda = new lambda.Function(this, "AdminApi", {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../lambda/admin-api")
      ),
      environment: {
        TABLE_NAME: contentTable.tableName,
        IMAGES_BUCKET: imagesBucket.bucketName,
      },
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
    });
    contentTable.grantReadWriteData(adminApiLambda);
    imagesBucket.grantPut(adminApiLambda);
    imagesBucket.grantReadWrite(adminApiLambda);

    // Seed Lambda
    const seedLambda = new lambda.Function(this, "SeedFunction", {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/seed")),
      environment: {
        TABLE_NAME: contentTable.tableName,
      },
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
    });
    contentTable.grantReadWriteData(seedLambda);

    // Recommend Lambda (Bedrock)
    const recommendLambda = new lambda.Function(this, "RecommendApi", {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../lambda/recommend")
      ),
      environment: {
        TABLE_NAME: contentTable.tableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });
    contentTable.grantReadData(recommendLambda);
    recommendLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["arn:aws:bedrock:*::foundation-model/amazon.nova-micro-v1:0"],
      })
    );

    // Reviews Lambda — proxies live Google reviews so the API key stays
    // server-side. The Google API key + place id live in a Secrets Manager
    // secret (JSON: GOOGLE_MAPS_API_KEY, GOOGLE_PLACE_ID); nothing sensitive
    // is committed here or baked into the Lambda env. CDK creates the secret
    // empty; populate it once after the first deploy (see README/aws CLI).
    const reviewsSecret = new secretsmanager.Secret(this, "GoogleReviewsSecret", {
      secretName: "vanderleest/google-reviews",
      description:
        "Google Places API key + Place ID for the live reviews widget",
    });

    const reviewsApiLambda = new lambda.Function(this, "ReviewsApi", {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../lambda/reviews-api")
      ),
      environment: {
        REVIEWS_SECRET_ARN: reviewsSecret.secretArn,
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
    });
    reviewsSecret.grantRead(reviewsApiLambda);

    // Chat Lambda (Bedrock + tool use). Uses Claude Haiku 4.5 via the US
    // cross-region inference profile — much smarter at tool selection than
    // Nova Micro for ~10× the per-token cost (still pennies at this volume).
    const chatLambda = new lambda.Function(this, "ChatApi", {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../lambda/chat")
      ),
      environment: {
        TABLE_NAME:  contentTable.tableName,
        LEADS_TABLE: leadsTable.tableName,
        MODEL_ID:    "us.anthropic.claude-haiku-4-5-20251001-v1:0",
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });
    contentTable.grantReadData(chatLambda);
    leadsTable.grantWriteData(chatLambda);
    chatLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        // Cross-region inference profile requires permission on BOTH the
        // profile resource and every foundation model it can route to.
        resources: [
          "arn:aws:bedrock:*:*:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0",
          "arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
        ],
      })
    );

    // ============================================================
    // API GATEWAY
    // ============================================================

    const api = new apigateway.RestApi(this, "ContentApiGateway", {
      restApiName: "VanderLeest Content API",
      cloudWatchRole: false,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "Authorization",
          "X-Amz-Date",
          "X-Api-Key",
        ],
      },
      // Cap bad actors. Stage-wide floor applies to every method; the
      // recommend route calls Bedrock (expensive per request) so it gets a
      // tighter override. Generous for real users, miserable for a bot.
      deployOptions: {
        throttlingRateLimit: 50,
        throttlingBurstLimit: 100,
        methodOptions: {
          "/api/recommend/POST": {
            throttlingRateLimit: 5,
            throttlingBurstLimit: 10,
          },
          "/api/chat/POST": {
            throttlingRateLimit: 5,
            throttlingBurstLimit: 10,
          },
        },
      },
    });

    // Cognito authorizer for admin routes
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      "AdminAuthorizer",
      {
        cognitoUserPools: [userPool],
      }
    );

    const contentIntegration = new apigateway.LambdaIntegration(
      contentApiLambda
    );
    const adminIntegration = new apigateway.LambdaIntegration(adminApiLambda);

    // Public routes
    const apiResource = api.root.addResource("api");

    const contentResource = apiResource.addResource("content");
    const contentTypeResource = contentResource.addResource("{type}");
    contentTypeResource.addMethod("GET", contentIntegration);

    const trailersResource = apiResource.addResource("trailers");
    trailersResource.addMethod("GET", contentIntegration);

    const trailerSlugResource = trailersResource.addResource("{slug}");
    trailerSlugResource.addMethod("GET", contentIntegration);

    // Recommend route (public)
    const recommendIntegration = new apigateway.LambdaIntegration(recommendLambda);
    const recommendResource = apiResource.addResource("recommend");
    recommendResource.addMethod("POST", recommendIntegration);

    // Chat route (public)
    const chatIntegration = new apigateway.LambdaIntegration(chatLambda);
    const chatResource = apiResource.addResource("chat");
    chatResource.addMethod("POST", chatIntegration);

    // Reviews route (public) — live Google reviews
    const reviewsIntegration = new apigateway.LambdaIntegration(
      reviewsApiLambda
    );
    const reviewsResource = apiResource.addResource("reviews");
    reviewsResource.addMethod("GET", reviewsIntegration);

    // Admin routes (Cognito-protected)
    const adminResource = apiResource.addResource("admin");
    const adminAuth = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    const adminContentResource = adminResource.addResource("content");
    const adminContentTypeResource =
      adminContentResource.addResource("{type}");
    adminContentTypeResource.addMethod("PUT", adminIntegration, adminAuth);

    const adminTrailersResource = adminResource.addResource("trailers");
    adminTrailersResource.addMethod("GET", adminIntegration, adminAuth);
    adminTrailersResource.addMethod("POST", adminIntegration, adminAuth);
    adminTrailersResource.addMethod("PUT", adminIntegration, adminAuth);

    const adminTrailerSlugResource =
      adminTrailersResource.addResource("{slug}");
    adminTrailerSlugResource.addMethod("PUT", adminIntegration, adminAuth);
    adminTrailerSlugResource.addMethod("DELETE", adminIntegration, adminAuth);

    const adminUploadResource = adminResource.addResource("upload");
    adminUploadResource.addMethod("POST", adminIntegration, adminAuth);

    // ============================================================
    // CLOUDFRONT
    // ============================================================

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      "OAI",
      {
        comment: "OAI for VanderLeest Trailers website",
      }
    );
    websiteBucket.grantRead(originAccessIdentity);

    const imagesOAI = new cloudfront.OriginAccessIdentity(this, "ImagesOAI", {
      comment: "OAI for VanderLeest images",
    });
    imagesBucket.grantRead(imagesOAI);

    // Short-TTL cache for public GET content so a bot looping on the same
    // endpoint only hits origin once per minute per edge. Cuts Lambda
    // invocations and DynamoDB reads under a spray attack.
    const apiContentCachePolicy = new cloudfront.CachePolicy(
      this,
      "ApiContentCachePolicy",
      {
        defaultTtl: cdk.Duration.seconds(60),
        minTtl: cdk.Duration.seconds(0),
        maxTtl: cdk.Duration.seconds(300),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        headerBehavior: cloudfront.CacheHeaderBehavior.none(),
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      }
    );

    const apiOrigin = new origins.RestApiOrigin(api);
    const cachedApiBehavior: cloudfront.BehaviorOptions = {
      origin: apiOrigin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      cachePolicy: apiContentCachePolicy,
    };

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        // Cacheable GET endpoints — content and trailer listings.
        "/api/content/*": cachedApiBehavior,
        "/api/trailers*": cachedApiBehavior,
        "/api/reviews": cachedApiBehavior,
        // Catch-all for /api/recommend (POST) and /api/admin/* — no cache.
        "/api/*": {
          origin: apiOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
        "/uploads/*": {
          origin: new origins.S3Origin(imagesBucket, {
            originAccessIdentity: imagesOAI,
          }),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(5),
        },
      ],
    });

    // ============================================================
    // IAM: Grant deployer user access to DynamoDB
    // ============================================================

    const deployerUser = iam.User.fromUserName(
      this,
      "GitHubActionsDeployer",
      "github-actions-deployer"
    );
    contentTable.grantReadWriteData(deployerUser);
    imagesBucket.grantReadWrite(deployerUser);

    // ============================================================
    // DEPLOY SITE
    // ============================================================

    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [
        s3deploy.Source.asset(
          path.join(__dirname, "../../frontend/dist/frontend/browser")
        ),
      ],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    // ============================================================
    // SEED DATA (Custom Resource)
    // ============================================================

    new cr.AwsCustomResource(this, "SeedData", {
      onCreate: {
        service: "Lambda",
        action: "invoke",
        parameters: {
          FunctionName: seedLambda.functionName,
          Payload: JSON.stringify({
            RequestType: "Create",
            ResourceProperties: {
              TableName: contentTable.tableName,
            },
          }),
        },
        physicalResourceId: cr.PhysicalResourceId.of("seed-data-v1"),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ["lambda:InvokeFunction"],
          resources: [seedLambda.functionArn],
        }),
      ]),
    });

    // ============================================================
    // OUTPUTS
    // ============================================================

    new cdk.CfnOutput(this, "CloudFrontURL", {
      value: `https://${distribution.distributionDomainName}`,
      description: "CloudFront distribution URL",
    });

    new cdk.CfnOutput(this, "S3BucketName", {
      value: websiteBucket.bucketName,
      description: "S3 bucket name",
    });

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "API Gateway URL",
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
      description: "Cognito User Pool ID",
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID",
    });

    new cdk.CfnOutput(this, "ImagesBucketName", {
      value: imagesBucket.bucketName,
      description: "Images S3 bucket name",
    });
  }
}
