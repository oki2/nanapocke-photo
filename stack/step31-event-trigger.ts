import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {UserPool, UserPoolClient} from "aws-cdk-lib/aws-cognito";
import {Bucket} from "aws-cdk-lib/aws-s3";
import {Table} from "aws-cdk-lib/aws-dynamodb";
import {EventField, Rule, RuleTargetInput} from "aws-cdk-lib/aws-events";
import {LambdaFunction as targetLambda} from "aws-cdk-lib/aws-events-targets";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";

export interface Props extends cdk.StackProps {
  readonly Config: any;
  readonly MainTable: Table;
  // readonly NanapockeUserTable: Table;
  readonly bucketUpload: Bucket;
  readonly bucketPhoto: Bucket;
  // readonly cfPublicKeyPhotoUploadUrl: cloudfront.PublicKey;
}

export class Step31EventTriggerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const functionPrefix = `${props.Config.ProjectName}-${props.Config.Stage}`;
    const defaultEnvironment = {
      MAIN_REGION: process.env.CDK_DEFAULT_REGION || "",
    };

    // =====================================================
    // LambdaFunction Event bridge
    // =====================================================
    // S3PutItemlistCsv
    const triggerPhotoUploadChangeWebpFn = new NodejsFunction(
      this,
      "TriggerPhotoUploadChangeWebpFn",
      {
        functionName: `${functionPrefix}-TriggerPhotoUploadChangeWebp`,
        description: `${functionPrefix}-TriggerPhotoUploadChangeWebp`,
        entry: "src/handlers/trigger/s3.photo.upload.change.webp.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.X86_64,
        memorySize: 2048,
        timeout: cdk.Duration.seconds(60),
        bundling: {
          nodeModules: ["sharp"], // sharp を nodeModules に明示的に指定
          commandHooks: {
            beforeBundling() {
              return [];
            },
            beforeInstall() {
              return [];
            },
            afterBundling(inputDir: string, outputDir: string): string[] {
              // inputDir … package.json / lockfile があるディレクトリ（= project-root）
              // outputDir … ビルド後の JS が入るディレクトリ

              // project-root/lambda/watermark.png → outputDir/watermark.png にコピー
              return [
                `cp ${inputDir}/src/resource/watermark.png ${outputDir}/watermark.png`,
              ];
            },
          },
        },
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_MAIN: props.MainTable.tableName,
          BUCKET_UPLOAD_NAME: props.bucketUpload.bucketName,
          BUCKET_PHOTO_NAME: props.bucketPhoto.bucketName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:UpdateItem", "dynamodb:GetItem"],
            resources: [props.MainTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:GetObject"],
            resources: [`${props.bucketUpload.bucketArn}/photo-upload/*`],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:PutObject"],
            resources: [
              `${props.bucketPhoto.bucketArn}/thumbnail/*`,
              `${props.bucketPhoto.bucketArn}/original/*`,
              `${props.bucketPhoto.bucketArn}/storage/*`,
            ],
          }),
        ],
      }
    );

    new Rule(this, "EventPhotoUpload-Rule", {
      ruleName: `${functionPrefix}-EventPhotoUpload-Rule`,
      eventPattern: {
        source: ["aws.s3"],
        detailType: ["Object Created"],
        detail: {
          object: {
            key: [{prefix: "photo-upload/"}],
          },
          bucket: {
            name: [props.bucketUpload.bucketName],
          },
        },
        resources: [props.bucketUpload.bucketArn],
      },
      targets: [
        new targetLambda(triggerPhotoUploadChangeWebpFn, {
          event: RuleTargetInput.fromObject({
            id: EventField.eventId,
            account: EventField.account,
            time: EventField.time,
            region: EventField.region,
            "detail-type": EventField.detailType,
            detail: {
              bucketName: EventField.fromPath("$.detail.bucket.name"),
              keyPath: EventField.fromPath("$.detail.object.key"),
              size: EventField.fromPath("$.detail.object.size"),
            },
          }),
        }),
      ],
    });
  }
}
