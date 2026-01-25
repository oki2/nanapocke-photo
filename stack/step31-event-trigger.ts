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
import {Queue} from "aws-cdk-lib/aws-sqs";
import {SqsEventSource} from "aws-cdk-lib/aws-lambda-event-sources";

export interface Props extends cdk.StackProps {
  readonly Config: any;
  readonly MainTable: Table;
  readonly PhotoCatalogTable: Table;
  readonly AlbumCatalogTable: Table;
  readonly RelationTable: Table;
  // readonly NanapockeUserTable: Table;
  readonly bucketUpload: Bucket;
  readonly bucketPhoto: Bucket;
  readonly queueMain: Queue;
  readonly queuePhotoConvert: Queue;
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
    // 写真アップロード時の変換機能
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
          TABLE_NAME_PHOTO_CATALOG: props.PhotoCatalogTable.tableName,
          TABLE_NAME_ALBUM_CATALOG: props.AlbumCatalogTable.tableName,
          TABLE_NAME_RELATION: props.RelationTable.tableName,
          BUCKET_UPLOAD_NAME: props.bucketUpload.bucketName,
          BUCKET_PHOTO_NAME: props.bucketPhoto.bucketName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "dynamodb:UpdateItem",
              "dynamodb:PutItem",
              "dynamodb:GetItem",
            ],
            resources: [props.PhotoCatalogTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "dynamodb:Query",
              "dynamodb:PutItem",
              "dynamodb:BatchWriteItem",
            ],
            resources: [
              props.RelationTable.tableArn,
              `${props.RelationTable.tableArn}/index/lsi1_index`,
            ],
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
      },
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

    // =====================================================
    // 写真のzipアップロード時のunzip 処理
    const triggerPhotoZipUploadFn = new NodejsFunction(
      this,
      "TriggerPhotoZipUploadFn",
      {
        functionName: `${functionPrefix}-TriggerPhotoZipUpload`,
        description: `${functionPrefix}-TriggerPhotoZipUpload`,
        entry: "src/handlers/trigger/s3.photo.zip.upload.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.X86_64,
        memorySize: 2048,
        timeout: cdk.Duration.minutes(5),
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_MAIN: props.MainTable.tableName,
          BUCKET_UPLOAD_NAME: props.bucketUpload.bucketName,
          BUCKET_PHOTO_NAME: props.bucketPhoto.bucketName,
          SQS_QUEUE_URL_PHOTO_CONVERT: props.queuePhotoConvert.queueUrl,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:GetObject"],
            resources: [`${props.bucketUpload.bucketArn}/photo-zip-upload/*`],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:PutObject"],
            resources: [`${props.bucketUpload.bucketArn}/photo-unzip/*`],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["sqs:sendmessage"],
            resources: [props.queuePhotoConvert.queueArn],
          }),
        ],
      },
    );

    new Rule(this, "EventPhotoZipUpload-Rule", {
      ruleName: `${functionPrefix}-EventPhotoZipUpload-Rule`,
      eventPattern: {
        source: ["aws.s3"],
        detailType: ["Object Created"],
        detail: {
          object: {
            key: [{prefix: "photo-zip-upload/"}],
          },
          bucket: {
            name: [props.bucketUpload.bucketName],
          },
        },
        resources: [props.bucketUpload.bucketArn],
      },
      targets: [
        new targetLambda(triggerPhotoZipUploadFn, {
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

    // =====================================================
    // アルバムの画像アップロード時の変換機能
    const triggerAlbumImageUploadFn = new NodejsFunction(
      this,
      "TriggerAlbumImageUploadFn",
      {
        functionName: `${functionPrefix}-TriggerAlbumImageUpload`,
        description: `${functionPrefix}-TriggerAlbumImageUpload`,
        entry: "src/handlers/trigger/s3.album.image.upload.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.X86_64,
        memorySize: 2048,
        timeout: cdk.Duration.seconds(60),
        bundling: {
          nodeModules: ["sharp"], // sharp を nodeModules に明示的に指定
          // commandHooks: {
          //   beforeBundling() {
          //     return [];
          //   },
          //   beforeInstall() {
          //     return [];
          //   },
          //   afterBundling(inputDir: string, outputDir: string): string[] {
          //     // inputDir … package.json / lockfile があるディレクトリ（= project-root）
          //     // outputDir … ビルド後の JS が入るディレクトリ

          //     // project-root/src/resource/watermark.png → outputDir/watermark.png にコピー
          //     return [
          //       `cp ${inputDir}/src/resource/watermark.png ${outputDir}/watermark.png`,
          //     ];
          //   },
          // },
        },
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_ALBUM_CATALOG: props.AlbumCatalogTable.tableName,
          BUCKET_UPLOAD_NAME: props.bucketUpload.bucketName,
          BUCKET_PHOTO_NAME: props.bucketPhoto.bucketName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:UpdateItem"],
            resources: [props.AlbumCatalogTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:GetObject"],
            resources: [`${props.bucketUpload.bucketArn}/album-image-upload/*`],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:PutObject"],
            resources: [`${props.bucketPhoto.bucketArn}/thumbnail/*`],
          }),
        ],
      },
    );

    new Rule(this, "EventAlbumImageUpload-Rule", {
      ruleName: `${functionPrefix}-EventAlbumImageUpload-Rule`,
      eventPattern: {
        source: ["aws.s3"],
        detailType: ["Object Created"],
        detail: {
          object: {
            key: [{prefix: "album-image-upload/"}],
          },
          bucket: {
            name: [props.bucketUpload.bucketName],
          },
        },
        resources: [props.bucketUpload.bucketArn],
      },
      targets: [
        new targetLambda(triggerAlbumImageUploadFn, {
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

    // ==============================================================
    // 汎用トリガー
    const triggerS3ActionRouterFn = new NodejsFunction(
      this,
      "TriggerS3ActionRouterFn",
      {
        functionName: `${functionPrefix}-TriggerS3ActionRouter`,
        description: `${functionPrefix}-TriggerS3ActionRouter`,
        entry: "src/handlers/trigger/s3.action.router.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        timeout: cdk.Duration.seconds(60),
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_MAIN: props.MainTable.tableName,
          BUCKET_UPLOAD_NAME: props.bucketUpload.bucketName,
          BUCKET_PHOTO_NAME: props.bucketPhoto.bucketName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "dynamodb:UpdateItem",
              "dynamodb:GetItem",
              "dynamodb:PutItem",
              "dynamodb:Query",
              "dynamodb:BatchGetItem",
              "dynamodb:BatchWriteItem",
            ],
            resources: [props.MainTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:GetObject"],
            resources: [
              `${props.bucketUpload.bucketArn}/action/*`,
              `${props.bucketUpload.bucketArn}/order/*`,
            ],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:PutObject"],
            resources: [
              `${props.bucketPhoto.bucketArn}/sales/*`,
              `${props.bucketPhoto.bucketArn}/paymentLog/*`,
            ],
          }),
        ],
      },
    );

    new Rule(this, "S3ActionRouter-Rule", {
      ruleName: `${functionPrefix}-S3ActionRouter-Rule`,
      eventPattern: {
        source: ["aws.s3"],
        detailType: ["Object Created"],
        detail: {
          object: {
            key: [{prefix: "action/"}],
          },
          bucket: {
            name: [props.bucketUpload.bucketName],
          },
        },
        resources: [props.bucketUpload.bucketArn],
      },
      targets: [
        new targetLambda(triggerS3ActionRouterFn, {
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

    // =====================================================================================
    // SQS トリガー
    // =====================================================================================
    // 印刷送信用
    const triggerSqsMainQueueFn = new NodejsFunction(
      this,
      "TriggerSqsMainQueueFn",
      {
        functionName: `${functionPrefix}-TriggerSqsMainQueue`,
        description: `${functionPrefix}-TriggerSqsMainQueue`,
        entry: "src/handlers/trigger/sqs.queue.main.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 1024,
        timeout: cdk.Duration.minutes(15),
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_MAIN: props.MainTable.tableName,
          BUCKET_UPLOAD_NAME: props.bucketUpload.bucketName,
          BUCKET_PHOTO_NAME: props.bucketPhoto.bucketName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem", "dynamodb:PutItem"],
            resources: [props.MainTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:GetObject"],
            resources: [
              `${props.bucketUpload.bucketArn}/order/*`,
              `${props.bucketPhoto.bucketArn}/storage/*`,
            ],
          }),
          // new cdk.aws_iam.PolicyStatement({
          //   effect: cdk.aws_iam.Effect.ALLOW,
          //   actions: ["s3:PutObject"],
          //   resources: [`${props.bucketPhoto.bucketArn}/paymentLog/*`],
          // }),
        ],
      },
    );
    triggerSqsMainQueueFn.addEventSource(
      new SqsEventSource(props.queueMain, {
        batchSize: 1,
        maxConcurrency: 5,
        reportBatchItemFailures: true,
      }),
    );

    // ZIPからの写真変換用 ===================================================
    const triggerSqsPhotoConvertQueueFn = new NodejsFunction(
      this,
      "TriggerSqsPhotoConvertQueueFn",
      {
        functionName: `${functionPrefix}-TriggerSqsPhotoConvertQueueFn`,
        description: `${functionPrefix}-TriggerSqsPhotoConvertQueueFn`,
        entry: "src/handlers/trigger/sqs.queue.photo.convert.ts",
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

              // project-root/src/resource/watermark.png → outputDir/watermark.png にコピー
              return [
                `cp ${inputDir}/src/resource/watermark.png ${outputDir}/watermark.png`,
              ];
            },
          },
        },
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_MAIN: props.MainTable.tableName,
          TABLE_NAME_PHOTO_CATALOG: props.PhotoCatalogTable.tableName,
          TABLE_NAME_ALBUM_CATALOG: props.AlbumCatalogTable.tableName,
          TABLE_NAME_RELATION: props.RelationTable.tableName,
          BUCKET_UPLOAD_NAME: props.bucketUpload.bucketName,
          BUCKET_PHOTO_NAME: props.bucketPhoto.bucketName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "dynamodb:GetItem",
              // "dynamodb:PutItem",
              // "dynamodb:UpdateItem",
              // "dynamodb:BatchWriteItem",
            ],
            resources: [
              props.MainTable.tableArn,
              // `${props.MainTable.tableArn}/index/lsi1_index`,
            ],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "dynamodb:UpdateItem",
              "dynamodb:PutItem",
              "dynamodb:GetItem",
            ],
            resources: [props.PhotoCatalogTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "dynamodb:Query",
              "dynamodb:PutItem",
              "dynamodb:BatchWriteItem",
            ],
            resources: [
              props.RelationTable.tableArn,
              `${props.RelationTable.tableArn}/index/lsi1_index`,
            ],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:GetObject"],
            resources: [`${props.bucketUpload.bucketArn}/photo-unzip/*`],
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
      },
    );
    triggerSqsPhotoConvertQueueFn.addEventSource(
      new SqsEventSource(props.queuePhotoConvert, {
        batchSize: 1,
        maxConcurrency: 5,
        reportBatchItemFailures: true,
      }),
    );
  }
}
