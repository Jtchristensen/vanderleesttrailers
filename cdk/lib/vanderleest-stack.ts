import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
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
      runtime: lambda.Runtime.NODEJS_20_X,
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
      runtime: lambda.Runtime.NODEJS_20_X,
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
      runtime: lambda.Runtime.NODEJS_20_X,
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
      runtime: lambda.Runtime.NODEJS_20_X,
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

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        "/api/*": {
          origin: new origins.RestApiOrigin(api),
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
