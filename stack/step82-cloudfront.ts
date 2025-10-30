import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";
import * as acm from "aws-cdk-lib/aws-certificatemanager";

// API Gateway v2 (HTTP API) — Alpha modules
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";

import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Tg from "aws-cdk-lib/aws-route53-targets";

import {Bucket} from "aws-cdk-lib/aws-s3";

export interface Props extends cdk.StackProps {
  readonly Config: any;
  readonly cfdAdminVerifyToken: string;
  readonly cfdPublicVerifyToken: string;
  readonly httpApiAdmin: apigwv2.HttpApi;
  readonly httpApiPublic: apigwv2.HttpApi;
  readonly publicCertificateArn: string;
}

export class Step82CloudfrontStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    // Route53のホストゾーンを取得する
    const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: props.Config.HostedZone.RootDomain,
    });

    // CloudFront からAPIGｗへ Authorizationヘッダー を受け取るためのキャッシュポリシー
    const cachePolicyForApiGwAuth = new cloudfront.CachePolicy(
      this,
      "cachePolicyForApiGwAuth",
      {
        defaultTtl: cdk.Duration.seconds(10),
        minTtl: cdk.Duration.seconds(10),
        maxTtl: cdk.Duration.seconds(10),
        headerBehavior:
          cloudfront.CacheHeaderBehavior.allowList("Authorization"),
        cookieBehavior: cloudfront.CacheCookieBehavior.all(),
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      }
    );

    // ==========================================================================================================
    // Publicサイト用のCloudFront
    // ==========================================================================================================
    // SPA設置Bucket ※CloudFrontのポリシー設定の為、このStackにて設定
    const bucketPublicCfd = new Bucket(
      this,
      props.Config.S3.Bucket.PublicCfd.BucketName,
      {
        bucketName: props.Config.S3.Bucket.PublicCfd.BucketName,
        blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy:
          props.Config.Stage === "sandbox"
            ? cdk.RemovalPolicy.DESTROY
            : cdk.RemovalPolicy.RETAIN,
        autoDeleteObjects: props.Config.Stage === "sandbox" ? true : false,
        versioned: true,
        eventBridgeEnabled: true,
        lifecycleRules: [
          {
            id: "noncurrentVersion-auto-delete",
            enabled: true,
            noncurrentVersionExpiration: cdk.Duration.days(2),
            expiredObjectDeleteMarker: true,
          },
        ],
      }
    );
    // CloudFront Origin Access Control
    // const publicOAC = new cloudfront.S3OriginAccessControl(
    //   this,
    //   "PublicOAC",
    //   {
    //     signing: cloudfront.Signing.SIGV4_NO_OVERRIDE,
    //   }
    // );

    const cfdPublic = new cloudfront.Distribution(this, "DistributionPublic", {
      comment: `Public : ${props.Config.HostedZone.PublicDomain}`,
      domainNames: [props.Config.HostedZone.PublicDomain],
      certificate: acm.Certificate.fromCertificateArn(
        this,
        "ImportedCert",
        props.publicCertificateArn
      ),
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(
          bucketPublicCfd
          // {originAccessControl: publicOAC}
        ),
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy:
          cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      additionalBehaviors: {
        "/api/admin/*": {
          origin: new origins.HttpOrigin(
            `${props.httpApiAdmin.apiId}.execute-api.${props.Config.MainRegion}.amazonaws.com`,
            {
              customHeaders: {
                "x-origin-verify-token": props.cfdAdminVerifyToken,
              },
            }
          ),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cachePolicyForApiGwAuth,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          responseHeadersPolicy:
            cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        },
        "/auth/*": {
          origin: new origins.HttpOrigin(
            `${props.httpApiPublic.apiId}.execute-api.${props.Config.MainRegion}.amazonaws.com`,
            {
              customHeaders: {
                "x-origin-verify-token": props.cfdPublicVerifyToken,
              },
            }
          ),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cachePolicyForApiGwAuth,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          responseHeadersPolicy:
            cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        },
      },
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(5),
        },
      ],
    });

    // Route53のホストゾーンにCloudFrontのエイリアスレコードを設定する
    const cfdARecord = new route53.ARecord(this, "PublicARecord", {
      recordName: props.Config.HostedZone.PublicDomain,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(
        new route53Tg.CloudFrontTarget(cfdPublic)
      ),
    });
  }
}
