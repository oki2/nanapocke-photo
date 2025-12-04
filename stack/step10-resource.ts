import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as ssm from "aws-cdk-lib/aws-ssm";
import {Bucket, ObjectOwnership} from "aws-cdk-lib/aws-s3";

export interface Props extends cdk.StackProps {
  readonly Config: any;
}

export class Step10ResourceStack extends cdk.Stack {
  public cfPublicKeyPhotoUploadUrl: cloudfront.PublicKey;
  public cfKeyGroupNanaPhoto: cloudfront.KeyGroup;
  public bucketUpload: Bucket;
  public bucketPhoto: Bucket;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    //====================================
    // S3
    //====================================
    // ファイルアップロード用Bucket
    this.bucketUpload = new Bucket(
      this,
      props.Config.S3.Bucket.Upload.BucketName,
      {
        bucketName: props.Config.S3.Bucket.Upload.BucketName,
        blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: props.Config.S3.Setting.RemovalPolicy,
        autoDeleteObjects: props.Config.S3.Setting.AutoDeleteObjects,
        versioned: true,
        eventBridgeEnabled: true,
        cors: [
          {
            allowedHeaders: ["*"],
            allowedMethods: [cdk.aws_s3.HttpMethods.PUT],
            allowedOrigins: [`https://${props.Config.HostedZone.PublicDomain}`],
          },
        ],
        lifecycleRules: [
          {
            id: "auto-delete",
            enabled: true,
            expiration: cdk.Duration.days(2),
            noncurrentVersionExpiration: cdk.Duration.days(1),
          },
        ],
      }
    );

    // 写真用Bucket
    this.bucketPhoto = new Bucket(
      this,
      props.Config.S3.Bucket.Photo.BucketName,
      {
        bucketName: props.Config.S3.Bucket.Photo.BucketName,
        blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: props.Config.S3.Setting.RemovalPolicy,
        autoDeleteObjects: props.Config.S3.Setting.AutoDeleteObjects,
        versioned: true,
        // eventBridgeEnabled: true,
        // cors: [
        //   {
        //     allowedHeaders: ["*"],
        //     allowedMethods: [cdk.aws_s3.HttpMethods.PUT],
        //     allowedOrigins: [`https://${props.Config.HostedZone.PublicDomain}`],
        //   },
        // ],
        // lifecycleRules: [
        //   {
        //     id: "auto-delete",
        //     enabled: true,
        //     expiration: cdk.Duration.days(2),
        //     noncurrentVersionExpiration: cdk.Duration.days(1),
        //   },
        // ],
      }
    );

    // //====================================
    // // Cloudfront PublicKey and KeyGroup
    // //====================================
    // // PublicKey ===========================================
    // // SSM Parameter Store からの取得、Typescriptの場合 valueFromLookup だとエラーが発生する為、 valueForStringParameter を使用
    // this.cfPublicKeyPhotoUploadUrl = new cloudfront.PublicKey(
    //   this,
    //   "cfPublicKeyPhotoUploadUrl",
    //   {
    //     encodedKey: ssm.StringParameter.valueForStringParameter(
    //       this,
    //       props.Config.CloudFront.Signed.PhotoUpload.ssmStoreKeyPath.Public
    //     ),
    //     publicKeyName: "ConsoleDocumentsCookie",
    //   }
    // );

    // // KeyGroup ===========================================
    // this.cfKeyGroupNanaPhoto = new cloudfront.KeyGroup(
    //   this,
    //   "cfKeyGroupNanaPhoto",
    //   {
    //     items: [this.cfPublicKeyPhotoUploadUrl],
    //     keyGroupName: "cfKeyGroupNanaPhoto",
    //   }
    // );
  }
}
