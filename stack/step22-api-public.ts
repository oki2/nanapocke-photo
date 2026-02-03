import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {UserPool, UserPoolClient} from "aws-cdk-lib/aws-cognito";
import {Bucket} from "aws-cdk-lib/aws-s3";
import {Table} from "aws-cdk-lib/aws-dynamodb";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import {Queue} from "aws-cdk-lib/aws-sqs";
import {TABLE_NAME} from "../src/config/Model/User";

export interface Props extends cdk.StackProps {
  readonly Config: any;
  readonly NanapockeAuthPool: UserPool;
  readonly NanapockeAuthPoolClient: UserPoolClient;
  readonly MainTable: Table;
  readonly PhotoCatalogTable: Table;
  readonly AlbumCatalogTable: Table;
  readonly RelationTable: Table;
  readonly CommerceTable: Table;
  readonly NanapockeUserTable: Table;
  readonly bucketUpload: Bucket;
  readonly bucketPhoto: Bucket;
  readonly queueMain: Queue;
  readonly cfPublicKeyThumbnailUrl: cloudfront.PublicKey;
}

interface LambdaFunctions {
  [prop: string]: NodejsFunction;
}

export class Step22ApiPublicleStack extends cdk.Stack {
  public lambdaFn: LambdaFunctions = {};

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const functionPrefix = `${props.Config.ProjectName}-${props.Config.Stage}`;
    const defaultEnvironment = {
      MAIN_REGION: process.env.CDK_DEFAULT_REGION || "",
      NANAPHOTO_FQDN: props.Config.HostedZone.PublicDomain,
    };

    // =====================================================
    // Lambda
    // =====================================================
    // Nanapocke OAuth Signin
    this.lambdaFn.nanapockeAuthFn = new NodejsFunction(
      this,
      "NanapockeAuthFn",
      {
        functionName: `${functionPrefix}-PublicNanapockeAuth`,
        description: `${functionPrefix}-PublicNanapockeAuth`,
        entry: "src/handlers/public.nanapocke.auth.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
          ...defaultEnvironment,
          NANAPOCKE_AUTHPOOL_ID: props.NanapockeAuthPool.userPoolId,
          NANAPOCKE_AUTHPOOL_CLIENT_ID:
            props.NanapockeAuthPoolClient.userPoolClientId,
          TABLE_NAME_MAIN: props.MainTable.tableName,
          TABLE_NAME_NANAPOCKE_USER: props.NanapockeUserTable.tableName,
          EXT_NANAPOCKE_API_URL_ACCESS_TOKEN:
            props.Config.External.Nanapocke.ApiUrl.AccessToken,
          EXT_NANAPOCKE_API_URL_USER_INFO:
            props.Config.External.Nanapocke.ApiUrl.UserInfo,
          EXT_NANAPOCKE_SETTING_CLIENTID:
            props.Config.External.Nanapocke.Setting.ClientId,
          EXT_NANAPOCKE_SETTING_CLIENTSECRET:
            props.Config.External.Nanapocke.Setting.ClientSecret,
          EXT_NANAPOCKE_SETTING_GRANTTYPE:
            props.Config.External.Nanapocke.Setting.GrantType,
          EXT_NANAPOCKE_API_URL_ACCESS_TOKEN_REDIRECT: `${props.Config.HostedZone.PublicDomain}/auth/nanapocke`,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "cognito-idp:AdminGetUser",
              "cognito-idp:AdminCreateUser",
              "cognito-idp:AdminSetUserPassword",
              "cognito-idp:AdminAddUserToGroup",
              "cognito-idp:AdminInitiateAuth",
              "cognito-idp:AdminRespondToAuthChallenge",
            ],
            resources: [props.NanapockeAuthPool.userPoolArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem"],
            resources: [props.MainTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "dynamodb:GetItem",
              "dynamodb:UpdateItem",
              "dynamodb:PutItem",
            ],
            resources: [props.NanapockeUserTable.tableArn],
          }),
        ],
      },
    );

    // フォトグラファーログイン
    this.lambdaFn.authSigninFn = new NodejsFunction(
      this,
      "ApiPublicAuthSigninFn",
      {
        functionName: `${functionPrefix}-ApiPublicAuthSignin`,
        description: `${functionPrefix}-ApiPublicAuthSignin`,
        entry: "src/handlers/api.public.auth.signin.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          MAIN_REGION: process.env.CDK_DEFAULT_REGION || "",
          NANAPOCKE_AUTHPOOL_ID: props.NanapockeAuthPool.userPoolId,
          NANAPOCKE_AUTHPOOL_CLIENT_ID:
            props.NanapockeAuthPoolClient.userPoolClientId,
          TABLE_NAME_MAIN: props.MainTable.tableName,
          TABLE_NAME_NANAPOCKE_USER: props.NanapockeUserTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["cognito-idp:AdminInitiateAuth"],
            resources: [
              props.NanapockeAuthPool.userPoolArn,
              props.NanapockeAuthPool.userPoolArn,
            ],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem"],
            resources: [props.MainTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "dynamodb:GetItem",
              "dynamodb:UpdateItem",
              "dynamodb:PutItem",
            ],
            resources: [props.NanapockeUserTable.tableArn],
          }),
        ],
      },
    );

    // Refresh
    this.lambdaFn.authRefreshFn = new NodejsFunction(
      this,
      "ApiPublicAuthRefreshFn",
      {
        functionName: `${functionPrefix}-ApiPublicAuthRefresh`,
        description: `${functionPrefix}-ApiPublicAuthRefresh`,
        entry: "src/handlers/api.public.auth.refresh.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          ...defaultEnvironment,
          NANAPOCKE_AUTHPOOL_ID: props.NanapockeAuthPool.userPoolId,
          NANAPOCKE_AUTHPOOL_CLIENT_ID:
            props.NanapockeAuthPoolClient.userPoolClientId,
          TABLE_NAME_NANAPOCKE_USER: props.NanapockeUserTable.tableName,
          TABLE_NAME_MAIN: props.MainTable.tableName,
          PEM_THUMBNAIL_PREVIEW_KEYPATH:
            props.Config.CloudFront.PublicKey.Thumbnail.ParameterStoreKeyPath
              .Private,
          CF_PUBLIC_KEY_THUMBNAIL_URL_KEYID:
            props.cfPublicKeyThumbnailUrl.publicKeyId,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["cognito-idp:AdminInitiateAuth"],
            resources: [
              props.NanapockeAuthPool.userPoolArn,
              props.NanapockeAuthPool.userPoolArn,
            ],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem"],
            resources: [
              props.NanapockeUserTable.tableArn,
              props.MainTable.tableArn,
            ],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["ssm:GetParameter"],
            resources: [
              `arn:${cdk.Aws.PARTITION}:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter/NanaPhoto/${props.Config.Stage}/cfd/thumbnail-access-cookie-pem/private`,
            ],
          }),
        ],
      },
    );

    // === 各種アクション === //
    // フォトグラファー の作成
    this.lambdaFn.photographerCreateFn = new NodejsFunction(
      this,
      "ApiPublicPhotographerCreateFn",
      {
        functionName: `${functionPrefix}-ApiPublicPhotographerCreate`,
        description: `${functionPrefix}-ApiPublicPhotographerCreate`,
        entry: "src/handlers/api.public.photographer.create.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
          ...defaultEnvironment,
          NANAPOCKE_AUTHPOOL_ID: props.NanapockeAuthPool.userPoolId,
          NANAPOCKE_AUTHPOOL_CLIENT_ID:
            props.NanapockeAuthPoolClient.userPoolClientId,
          // TABLE_NAME_MAIN: props.MainTable.tableName,
          TABLE_NAME_NANAPOCKE_USER: props.NanapockeUserTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "cognito-idp:AdminGetUser",
              "cognito-idp:AdminCreateUser",
              "cognito-idp:AdminSetUserPassword",
            ],
            resources: [props.NanapockeAuthPool.userPoolArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:PutItem"],
            resources: [props.NanapockeUserTable.tableArn],
          }),
        ],
      },
    );

    // フォトグラファー一覧取得
    this.lambdaFn.photographerListFn = new NodejsFunction(
      this,
      "ApiPublicPhotographerListFn",
      {
        functionName: `${functionPrefix}-ApiPublicPhotographerList`,
        description: `${functionPrefix}-ApiPublicPhotographerList`,
        entry: "src/handlers/api.public.photographer.list.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_NANAPOCKE_USER: props.NanapockeUserTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:Query"],
            resources: [
              props.NanapockeUserTable.tableArn,
              `${props.NanapockeUserTable.tableArn}/index/lsi1_index`,
            ],
          }),
        ],
      },
    );

    // フォトグラファーの編集
    this.lambdaFn.photographerEditFn = new NodejsFunction(
      this,
      "ApiPublicPhotographerEditFn",
      {
        functionName: `${functionPrefix}-ApiPublicPhotographerEdit`,
        description: `${functionPrefix}-ApiPublicPhotographerEdit`,
        entry: "src/handlers/api.public.photographer.edit.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          ...defaultEnvironment,
          NANAPOCKE_AUTHPOOL_ID: props.NanapockeAuthPool.userPoolId,
          TABLE_NAME_NANAPOCKE_USER: props.NanapockeUserTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "cognito-idp:AdminSetUserPassword",
              "cognito-idp:AdminUserGlobalSignOut",
            ],
            resources: [props.NanapockeAuthPool.userPoolArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
            resources: [props.NanapockeUserTable.tableArn],
          }),
        ],
      },
    );

    // === アルバム関連 === //
    // アルバムの作成
    this.lambdaFn.albumCreateFn = new NodejsFunction(
      this,
      "ApiPublicAlbumCreateFn",
      {
        functionName: `${functionPrefix}-ApiPublicAlbumCreate`,
        description: `${functionPrefix}-ApiPublicAlbumCreate`,
        entry: "src/handlers/api.public.album.create.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_PHOTO_CATALOG: props.PhotoCatalogTable.tableName,
          TABLE_NAME_ALBUM_CATALOG: props.AlbumCatalogTable.tableName,
          TABLE_NAME_RELATION: props.RelationTable.tableName,
          BUCKET_UPLOAD_NAME: props.bucketUpload.bucketName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:PutItem", "dynamodb:UpdateItem"],
            resources: [props.AlbumCatalogTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "dynamodb:PutItem",
              "dynamodb:Query",
              "dynamodb:BatchWriteItem",
            ],
            resources: [
              props.RelationTable.tableArn,
              `${props.RelationTable.tableArn}/index/lsi1_index`,
            ],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
            resources: [props.PhotoCatalogTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:PutObject"],
            resources: [`${props.bucketUpload.bucketArn}/album-image-upload/*`],
          }),
        ],
      },
    );

    // アルバム一覧の取得
    this.lambdaFn.albumListFn = new NodejsFunction(
      this,
      "ApiPublicAlbumListFn",
      {
        functionName: `${functionPrefix}-ApiPublicAlbumList`,
        description: `${functionPrefix}-ApiPublicAlbumList`,
        entry: "src/handlers/api.public.album.list.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_ALBUM_CATALOG: props.AlbumCatalogTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:Query"],
            resources: [
              props.AlbumCatalogTable.tableArn,
              `${props.AlbumCatalogTable.tableArn}/index/lsi1_index`,
            ],
          }),
        ],
      },
    );

    // アルバム情報の更新
    this.lambdaFn.albumUpdateFn = new NodejsFunction(
      this,
      "ApiPublicAlbumUpdateFn",
      {
        functionName: `${functionPrefix}-ApiPublicAlbumUpdate`,
        description: `${functionPrefix}-ApiPublicAlbumUpdate`,
        entry: "src/handlers/api.public.album.update.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_ALBUM_CATALOG: props.AlbumCatalogTable.tableName,
          BUCKET_UPLOAD_NAME: props.bucketUpload.bucketName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:UpdateItem"],
            resources: [props.AlbumCatalogTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:PutObject"],
            resources: [`${props.bucketUpload.bucketArn}/album-image-upload/*`],
          }),
        ],
      },
    );

    // アルバムの販売状況の編集
    this.lambdaFn.albumSalseFn = new NodejsFunction(
      this,
      "ApiPublicAlbumSalseFn",
      {
        functionName: `${functionPrefix}-ApiPublicAlbumSalse`,
        description: `${functionPrefix}-ApiPublicAlbumSalse`,
        entry: "src/handlers/api.public.album.sales.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_ALBUM_CATALOG: props.AlbumCatalogTable.tableName,
          TABLE_NAME_RELATION: props.RelationTable.tableName,
          BUCKET_UPLOAD_NAME: props.bucketUpload.bucketName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
            resources: [props.AlbumCatalogTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:Query"],
            resources: [props.RelationTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:PutObject"],
            resources: [
              `${props.bucketUpload.bucketArn}/action/albumPublished/*`,
            ],
          }),
        ],
      },
    );

    // アルバムの削除
    this.lambdaFn.albumDeleteFn = new NodejsFunction(
      this,
      "ApiPublicAlbumDeleteFn",
      {
        functionName: `${functionPrefix}-ApiPublicAlbumDelete`,
        description: `${functionPrefix}-ApiPublicAlbumDelete`,
        entry: "src/handlers/api.public.album.delete.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 512,
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_PHOTO_CATALOG: props.PhotoCatalogTable.tableName,
          TABLE_NAME_ALBUM_CATALOG: props.AlbumCatalogTable.tableName,
          TABLE_NAME_RELATION: props.RelationTable.tableName,
          BUCKET_PHOTO_NAME: props.bucketPhoto.bucketName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem", "dynamodb:DeleteItem"],
            resources: [props.AlbumCatalogTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
            resources: [props.PhotoCatalogTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "dynamodb:Query",
              "dynamodb:DeleteItem",
              "dynamodb:BatchWriteItem",
            ],
            resources: [
              props.RelationTable.tableArn,
              `${props.RelationTable.tableArn}/index/lsi1_index`,
            ],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:ListBucket"],
            resources: [`${props.bucketPhoto.bucketArn}`],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:DeleteObject"],
            resources: [`${props.bucketPhoto.bucketArn}/thumbnail/album/*`],
          }),
        ],
      },
    );

    // 指定した販売中アルバムの写真一覧を取得
    this.lambdaFn.albumPhotoListFn = new NodejsFunction(
      this,
      "ApiPublicAlbumPhotoListFn",
      {
        functionName: `${functionPrefix}-ApiPublicAlbumPhotoList`,
        description: `${functionPrefix}-ApiPublicAlbumPhotoList`,
        entry: "src/handlers/api.public.album.photo.list.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_ALBUM_CATALOG: props.AlbumCatalogTable.tableName,
          TABLE_NAME_COMMERCE: props.CommerceTable.tableName,
          BUCKET_PHOTO_NAME: props.bucketPhoto.bucketName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem"],
            resources: [props.AlbumCatalogTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:BatchGetItem"],
            resources: [props.CommerceTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:GetObject"],
            resources: [`${props.bucketPhoto.bucketArn}/sales/*`],
          }),
        ],
      },
    );

    // === 写真関連 === //
    // 写真の作成・Upload用署名付きURL発行
    this.lambdaFn.photoUploadFn = new NodejsFunction(
      this,
      "ApiPublicPhotoUploadFn",
      {
        functionName: `${functionPrefix}-ApiPublicPhotoUpload`,
        description: `${functionPrefix}-ApiPublicPhotoUpload`,
        entry: "src/handlers/api.public.photo.upload.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_MAIN: props.MainTable.tableName,
          TABLE_NAME_PHOTO_CATALOG: props.PhotoCatalogTable.tableName,
          TABLE_NAME_ALBUM_CATALOG: props.AlbumCatalogTable.tableName,
          BUCKET_UPLOAD_NAME: props.bucketUpload.bucketName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "dynamodb:PutItem",
              "dynamodb:Query",
              "dynamodb:BatchWriteItem",
            ],
            resources: [props.MainTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:PutItem", "dynamodb:UpdateItem"],
            resources: [props.PhotoCatalogTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:Query"],
            resources: [
              props.AlbumCatalogTable.tableArn,
              `${props.AlbumCatalogTable.tableArn}/index/lsi1_index`,
            ],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:PutObject"],
            resources: [
              // props.bucketUpload.bucketArn,
              `${props.bucketUpload.bucketArn}/photo-upload/*`,
              `${props.bucketUpload.bucketArn}/photo-zip-upload/*`,
            ],
          }),
        ],
      },
    );

    // 写真一覧の取得（園長向け）
    this.lambdaFn.photoListFn = new NodejsFunction(
      this,
      "ApiPublicPhotoListFn",
      {
        functionName: `${functionPrefix}-ApiPublicPhotoList`,
        description: `${functionPrefix}-ApiPublicPhotoList`,
        entry: "src/handlers/api.public.photo.list.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 512,
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_MAIN: props.MainTable.tableName,
          TABLE_NAME_PHOTO_CATALOG: props.PhotoCatalogTable.tableName,
          // TABLE_NAME_ALBUM_CATALOG: props.AlbumCatalogTable.tableName,
          TABLE_NAME_RELATION: props.RelationTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:Query", "dynamodb:BatchGetItem"],
            resources: [
              props.PhotoCatalogTable.tableArn,
              `${props.PhotoCatalogTable.tableArn}/index/GsiSeq_Index`,
              `${props.PhotoCatalogTable.tableArn}/index/GsiUpload_Index`,
              `${props.PhotoCatalogTable.tableArn}/index/GsiShooting_Index`,
              `${props.PhotoCatalogTable.tableArn}/index/GsiUnsetUpload_Index`,
              `${props.PhotoCatalogTable.tableArn}/index/GsiUnsetShooting_Index`,
              `${props.PhotoCatalogTable.tableArn}/index/GsiMy_Index`,
            ],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:Query"],
            resources: [
              props.RelationTable.tableArn,
              // `${props.RelationTable.tableArn}/index/lsi1_index`,
            ],
          }),
        ],
      },
    );

    // 写真一覧の取得（保育士・フォトグラファー向け）
    this.lambdaFn.photoListMyFn = new NodejsFunction(
      this,
      "ApiPublicPhotoListMyFn",
      {
        functionName: `${functionPrefix}-ApiPublicPhotoListMy`,
        description: `${functionPrefix}-ApiPublicPhotoListMy`,
        entry: "src/handlers/api.public.photo.list.my.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 512,
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_PHOTO_CATALOG: props.PhotoCatalogTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:Query", "dynamodb:BatchGetItem"],
            resources: [
              props.PhotoCatalogTable.tableArn,
              `${props.PhotoCatalogTable.tableArn}/index/GsiMy_Index`,
            ],
          }),
        ],
      },
    );

    // 写真のアルバム一括紐付け
    this.lambdaFn.photoJoinAlbumFn = new NodejsFunction(
      this,
      "ApiPublicPhotoJoinAlbumFn",
      {
        functionName: `${functionPrefix}-ApiPublicPhotoJoinAlbum`,
        description: `${functionPrefix}-ApiPublicPhotoJoinAlbum`,
        entry: "src/handlers/api.public.photo.join.album.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 512,
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_MAIN: props.MainTable.tableName,
          TABLE_NAME_PHOTO_CATALOG: props.PhotoCatalogTable.tableName,
          TABLE_NAME_ALBUM_CATALOG: props.AlbumCatalogTable.tableName,
          TABLE_NAME_RELATION: props.RelationTable.tableName,
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
            actions: ["dynamodb:Query"],
            resources: [props.AlbumCatalogTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "dynamodb:Query",
              "dynamodb:PutItem",
              "dynamodb:DeleteItem",
              "dynamodb:BatchWriteItem",
            ],
            resources: [
              props.RelationTable.tableArn,
              `${props.RelationTable.tableArn}/index/lsi1_index`,
            ],
          }),
        ],
      },
    );

    // 写真のダウンロード
    this.lambdaFn.photoDownloadFn = new NodejsFunction(
      this,
      "ApiPublicPhotoDownloadFn",
      {
        functionName: `${functionPrefix}-ApiPublicPhotoDownload`,
        description: `${functionPrefix}-ApiPublicPhotoDownload`,
        entry: "src/handlers/api.public.photo.download.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 1024,
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_PHOTO_CATALOG: props.PhotoCatalogTable.tableName,
          BUCKET_PHOTO_NAME: props.bucketPhoto.bucketName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem"],
            resources: [props.PhotoCatalogTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:GetObject"],
            resources: [`${props.bucketPhoto.bucketArn}/storage/photo/*`],
          }),
        ],
      },
    );

    // 写真の手動削除
    this.lambdaFn.photoDeleteFn = new NodejsFunction(
      this,
      "ApiPublicPhotoDeleteFn",
      {
        functionName: `${functionPrefix}-ApiPublicPhotoDelete`,
        description: `${functionPrefix}-ApiPublicPhotoDelete`,
        entry: "src/handlers/api.public.photo.delete.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 1024,
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_MAIN: props.MainTable.tableName,
          TABLE_NAME_PHOTO_CATALOG: props.PhotoCatalogTable.tableName,
          TABLE_NAME_ALBUM_CATALOG: props.AlbumCatalogTable.tableName,
          TABLE_NAME_RELATION: props.RelationTable.tableName,
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
            actions: ["dynamodb:Query"],
            resources: [props.AlbumCatalogTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "dynamodb:Query",
              "dynamodb:PutItem",
              "dynamodb:DeleteItem",
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
            resources: [`${props.bucketPhoto.bucketArn}/assets/*`],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:PutObject"],
            resources: [`${props.bucketPhoto.bucketArn}/thumbnail/*`],
          }),
        ],
      },
    );

    // === メタ情報関連 === //
    // メタ情報一覧取得
    this.lambdaFn.metaListFn = new NodejsFunction(this, "ApiPublicMetaListFn", {
      functionName: `${functionPrefix}-ApiPublicMetaList`,
      description: `${functionPrefix}-ApiPublicMetaList`,
      entry: "src/handlers/api.public.meta.list.ts",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      environment: {
        ...defaultEnvironment,
        TABLE_NAME_MAIN: props.MainTable.tableName,
        TABLE_NAME_NANAPOCKE_USER: props.NanapockeUserTable.tableName,
        TABLE_NAME_ALBUM_CATALOG: props.AlbumCatalogTable.tableName,
      },
      initialPolicy: [
        new cdk.aws_iam.PolicyStatement({
          effect: cdk.aws_iam.Effect.ALLOW,
          actions: ["dynamodb:Query"],
          resources: [
            props.MainTable.tableArn,
            `${props.MainTable.tableArn}/index/lsi1_index`,
            props.AlbumCatalogTable.tableArn,
            `${props.AlbumCatalogTable.tableArn}/index/lsi1_index`,
            props.NanapockeUserTable.tableArn,
            `${props.NanapockeUserTable.tableArn}/index/lsi1_index`,
          ],
        }),
      ],
    });

    // === カート関連 === //
    // カートに追加
    this.lambdaFn.cartAddFn = new NodejsFunction(this, "ApiPublicCartAddFn", {
      functionName: `${functionPrefix}-ApiPublicCartAdd`,
      description: `${functionPrefix}-ApiPublicCartAdd`,
      entry: "src/handlers/api.public.cart.add.ts",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      environment: {
        ...defaultEnvironment,
        // TABLE_NAME_MAIN: props.MainTable.tableName,
        TABLE_NAME_PHOTO_CATALOG: props.PhotoCatalogTable.tableName,
        TABLE_NAME_ALBUM_CATALOG: props.AlbumCatalogTable.tableName,
        TABLE_NAME_RELATION: props.RelationTable.tableName,
        TABLE_NAME_COMMERCE: props.CommerceTable.tableName,
      },
      initialPolicy: [
        new cdk.aws_iam.PolicyStatement({
          effect: cdk.aws_iam.Effect.ALLOW,
          actions: ["dynamodb:GetItem"],
          resources: [
            props.PhotoCatalogTable.tableArn,
            props.AlbumCatalogTable.tableArn,
            props.RelationTable.tableArn,
          ],
        }),
        new cdk.aws_iam.PolicyStatement({
          effect: cdk.aws_iam.Effect.ALLOW,
          actions: ["dynamodb:PutItem"],
          resources: [props.CommerceTable.tableArn],
        }),
      ],
    });

    // カートの中身を取得
    this.lambdaFn.cartListFn = new NodejsFunction(this, "ApiPublicCartListFn", {
      functionName: `${functionPrefix}-ApiPublicCartList`,
      description: `${functionPrefix}-ApiPublicCartList`,
      entry: "src/handlers/api.public.cart.list.ts",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      environment: {
        ...defaultEnvironment,
        TABLE_NAME_COMMERCE: props.CommerceTable.tableName,
      },
      initialPolicy: [
        new cdk.aws_iam.PolicyStatement({
          effect: cdk.aws_iam.Effect.ALLOW,
          actions: ["dynamodb:Query", "dynamodb:BatchGetItem"],
          resources: [
            props.CommerceTable.tableArn,
            // `${props.CommerceTable.tableArn}/index/lsi1_index`,
          ],
        }),
      ],
    });

    // カートの中身を削除
    this.lambdaFn.cartPhotoDeleteFn = new NodejsFunction(
      this,
      "ApiPublicCartPhotoDeleteFn",
      {
        functionName: `${functionPrefix}-ApiPublicCartPhotoDelete`,
        description: `${functionPrefix}-ApiPublicCartPhotoDelete`,
        entry: "src/handlers/api.public.cart.photo.delete.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          ...defaultEnvironment,
          // TABLE_NAME_MAIN: props.MainTable.tableName,
          TABLE_NAME_COMMERCE: props.CommerceTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:DeleteItem"],
            resources: [props.CommerceTable.tableArn],
          }),
        ],
      },
    );

    // カート内の購入枚数の変更
    this.lambdaFn.cartEditFn = new NodejsFunction(this, "ApiPublicCartEditFn", {
      functionName: `${functionPrefix}-ApiPublicCartEdit`,
      description: `${functionPrefix}-ApiPublicCartEdit`,
      entry: "src/handlers/api.public.cart.edit.ts",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      environment: {
        ...defaultEnvironment,
        TABLE_NAME_COMMERCE: props.CommerceTable.tableName,
      },
      initialPolicy: [
        new cdk.aws_iam.PolicyStatement({
          effect: cdk.aws_iam.Effect.ALLOW,
          actions: ["dynamodb:Query", "dynamodb:UpdateItem"],
          resources: [
            props.CommerceTable.tableArn,
            // `${props.MainTable.tableArn}/index/lsi1_index`,
          ],
        }),
      ],
    });

    // 印刷販売時の選択可能配送オプションの取得
    this.lambdaFn.optionsShippingFn = new NodejsFunction(
      this,
      "ApiPublicOptionsShippingFn",
      {
        functionName: `${functionPrefix}-ApiPublicOptionsShipping`,
        description: `${functionPrefix}-ApiPublicOptionsShipping`,
        entry: "src/handlers/api.public.options.shipping.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          ...defaultEnvironment,
        },
      },
    );

    // カートから決済情報の作成
    this.lambdaFn.cartCheckoutFn = new NodejsFunction(
      this,
      "ApiPublicCartCheckoutFn",
      {
        functionName: `${functionPrefix}-ApiPublicCartCheckout`,
        description: `${functionPrefix}-ApiPublicCartCheckout`,
        entry: "src/handlers/api.public.cart.checkout.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          ...defaultEnvironment,
          // TABLE_NAME_MAIN: props.MainTable.tableName,
          TABLE_NAME_COMMERCE: props.CommerceTable.tableName,
          BUCKET_UPLOAD_NAME: props.bucketUpload.bucketName,
          ORDER_ID_PREFIX: props.Config.Setting.Payment.OrderIdPrefix,
          SSM_SMBC_SETTING_PATH: `/NanaPhoto/${props.Config.Stage}/smbc/setting`,
          SMBC_API_GET_LINKPLUS: props.Config.External.Smbc.ApiUrl.getLinkplus,
        },
        initialPolicy: [
          // new cdk.aws_iam.PolicyStatement({
          //   effect: cdk.aws_iam.Effect.ALLOW,
          //   actions: [
          //     "dynamodb:Query",
          //     "dynamodb:PutItem",
          //     "dynamodb:UpdateItem",
          //   ],
          //   resources: [
          //     props.MainTable.tableArn,
          //     `${props.MainTable.tableArn}/index/lsi1_index`,
          //   ],
          // }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "dynamodb:Query",
              "dynamodb:PutItem",
              "dynamodb:UpdateItem",
            ],
            resources: [
              props.CommerceTable.tableArn,
              // `${props.MainTable.tableArn}/index/lsi1_index`,
            ],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:PutObject"],
            resources: [`${props.bucketUpload.bucketArn}/order/*`],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["ssm:GetParameter"],
            resources: [
              `arn:${cdk.Aws.PARTITION}:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter/NanaPhoto/${props.Config.Stage}/smbc/setting`,
            ],
          }),
        ],
      },
    );

    // 購入履歴関連 ================================================================
    // 購入履歴一覧の取得
    this.lambdaFn.paymentListFn = new NodejsFunction(
      this,
      "ApiPublicPaymentListFn",
      {
        functionName: `${functionPrefix}-ApiPublicPaymentList`,
        description: `${functionPrefix}-ApiPublicPaymentList`,
        entry: "src/handlers/api.public.payment.list.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_COMMERCE: props.CommerceTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:Query"],
            resources: [
              props.CommerceTable.tableArn,
              `${props.CommerceTable.tableArn}/index/GsiPaidUser_Index`,
            ],
          }),
        ],
      },
    );

    // 購入履歴詳細の取得
    this.lambdaFn.paymentDetailFn = new NodejsFunction(
      this,
      "ApiPublicPaymentDetailFn",
      {
        functionName: `${functionPrefix}-ApiPublicPaymentDetail`,
        description: `${functionPrefix}-ApiPublicPaymentDetail`,
        entry: "src/handlers/api.public.payment.detail.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_COMMERCE: props.CommerceTable.tableName,
          BUCKET_PHOTO_NAME: props.bucketPhoto.bucketName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem"],
            resources: [props.CommerceTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:ListBucket"],
            resources: [props.bucketPhoto.bucketArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:GetObject"],
            resources: [`${props.bucketPhoto.bucketArn}/paymentLog/*`],
          }),
        ],
      },
    );

    // SMBC 関連 ================================================================
    // SMBC からのcallback
    this.lambdaFn.smbcCallbackFn = new NodejsFunction(
      this,
      "ApiPublicSmbcCallbackFn",
      {
        functionName: `${functionPrefix}-ApiPublicSmbcCallback`,
        description: `${functionPrefix}-ApiPublicSmbcCallback`,
        entry: "src/handlers/api.public.smbc.callback.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_MAIN: props.MainTable.tableName,
          ORDER_ID_PREFIX: props.Config.Setting.Payment.OrderIdPrefix,
          SSM_SMBC_SETTING_PATH: `/NanaPhoto/${props.Config.Stage}/smbc/setting`,
          SMBC_API_SEARCH_TRADE_MULTI:
            props.Config.External.Smbc.ApiUrl.searchTradeMulti,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "dynamodb:GetItem",
              "dynamodb:PutItem",
              "dynamodb:UpdateItem",
            ],
            resources: [
              props.MainTable.tableArn,
              // `${props.MainTable.tableArn}/index/lsi1_index`,
            ],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:GetObject"],
            resources: [`${props.bucketUpload.bucketArn}/order/*`],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["ssm:GetParameter"],
            resources: [
              `arn:${cdk.Aws.PARTITION}:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter/NanaPhoto/${props.Config.Stage}/smbc/setting`,
            ],
          }),
        ],
      },
    ); // SMBC からの通知
    this.lambdaFn.smbcNotificationFn = new NodejsFunction(
      this,
      "ApiPublicSmbcNotificationFn",
      {
        functionName: `${functionPrefix}-ApiPublicSmbcNotification`,
        description: `${functionPrefix}-ApiPublicSmbcNotification`,
        entry: "src/handlers/api.public.smbc.notification.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          ...defaultEnvironment,
          // TABLE_NAME_MAIN: props.MainTable.tableName,
          TABLE_NAME_COMMERCE: props.CommerceTable.tableName,
          BUCKET_UPLOAD_NAME: props.bucketUpload.bucketName,
          BUCKET_PHOTO_NAME: props.bucketPhoto.bucketName,
          ORDER_ID_PREFIX: props.Config.Setting.Payment.OrderIdPrefix,
          SSM_SMBC_SETTING_PATH: `/NanaPhoto/${props.Config.Stage}/smbc/setting`,
          SMBC_API_SEARCH_TRADE_MULTI:
            props.Config.External.Smbc.ApiUrl.searchTradeMulti,
          SQS_QUEUE_URL_MAIN: props.queueMain.queueUrl,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "dynamodb:GetItem",
              // "dynamodb:PutItem",
              "dynamodb:UpdateItem",
              "dynamodb:Query",
              "dynamodb:BatchWriteItem",
            ],
            resources: [
              props.CommerceTable.tableArn,
              // `${props.MainTable.tableArn}/index/lsi1_index`,
            ],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:GetObject", "s3:PutObject"],
            resources: [
              `${props.bucketUpload.bucketArn}/order/*`,
              `${props.bucketUpload.bucketArn}/action/*`,
              `${props.bucketPhoto.bucketArn}/paymentLog/*`,
            ],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["ssm:GetParameter"],
            resources: [
              `arn:${cdk.Aws.PARTITION}:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter/NanaPhoto/${props.Config.Stage}/smbc/setting`,
            ],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["sqs:sendmessage"],
            resources: [props.queueMain.queueArn],
          }),
        ],
      },
    );
  }
}
