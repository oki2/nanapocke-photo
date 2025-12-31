import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {UserPool, UserPoolClient} from "aws-cdk-lib/aws-cognito";
import {Bucket} from "aws-cdk-lib/aws-s3";
import {Table} from "aws-cdk-lib/aws-dynamodb";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";

export interface Props extends cdk.StackProps {
  readonly Config: any;
  readonly NanapockeAuthPool: UserPool;
  readonly NanapockeAuthPoolClient: UserPoolClient;
  readonly MainTable: Table;
  readonly NanapockeUserTable: Table;
  readonly bucketUpload: Bucket;
  readonly bucketPhoto: Bucket;
  // readonly cfPublicKeyPhotoUploadUrl: cloudfront.PublicKey;
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
      }
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
      }
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
        ],
      }
    );

    // === 各種アクション === //
    // Photographer の作成
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
      }
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
      }
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
          TABLE_NAME_MAIN: props.MainTable.tableName,
          BUCKET_UPLOAD_NAME: props.bucketUpload.bucketName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:PutItem", "dynamodb:UpdateItem"],
            resources: [props.MainTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:PutObject"],
            resources: [`${props.bucketUpload.bucketArn}/album-image-upload/*`],
          }),
        ],
      }
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
          TABLE_NAME_MAIN: props.MainTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:Query"],
            resources: [
              props.MainTable.tableArn,
              `${props.MainTable.tableArn}/index/lsi1_index`,
            ],
          }),
        ],
      }
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
          TABLE_NAME_MAIN: props.MainTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:UpdateItem"],
            resources: [props.MainTable.tableArn],
          }),
        ],
      }
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
          TABLE_NAME_MAIN: props.MainTable.tableName,
          BUCKET_UPLOAD_NAME: props.bucketUpload.bucketName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "dynamodb:GetItem",
              "dynamodb:Query",
              "dynamodb:UpdateItem",
            ],
            resources: [props.MainTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:PutObject"],
            resources: [
              `${props.bucketUpload.bucketArn}/action/albumPublished/*`,
            ],
          }),
        ],
      }
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
          TABLE_NAME_MAIN: props.MainTable.tableName,
          BUCKET_PHOTO_NAME: props.bucketPhoto.bucketName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem"],
            resources: [props.MainTable.tableArn],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["s3:GetObject"],
            resources: [`${props.bucketPhoto.bucketArn}/sales/*`],
          }),
        ],
      }
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
          BUCKET_UPLOAD_NAME: props.bucketUpload.bucketName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "dynamodb:PutItem",
              "dynamodb:UpdateItem",
              "dynamodb:Query",
              "dynamodb:BatchWriteItem",
            ],
            resources: [
              props.MainTable.tableArn,
              `${props.MainTable.tableArn}/index/lsi1_index`,
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
      }
    );

    // 写真一覧の取得
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
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:Query", "dynamodb:BatchGetItem"],
            resources: [
              props.MainTable.tableArn,
              `${props.MainTable.tableArn}/index/lsi1_index`,
              `${props.MainTable.tableArn}/index/lsi2_index`,
              `${props.MainTable.tableArn}/index/lsi3_index`,
              `${props.MainTable.tableArn}/index/lsi4_index`,
            ],
          }),
        ],
      }
    );

    // 写真の情報を編集（アルバムIDの紐付けに利用）
    this.lambdaFn.photoEditFn = new NodejsFunction(
      this,
      "ApiPublicPhotoEditFn",
      {
        functionName: `${functionPrefix}-ApiPublicPhotoEdit`,
        description: `${functionPrefix}-ApiPublicPhotoEdit`,
        entry: "src/handlers/api.public.photo.edit.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 512,
        environment: {
          ...defaultEnvironment,
          TABLE_NAME_MAIN: props.MainTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: [
              "dynamodb:GetItem",
              "dynamodb:Query",
              "dynamodb:PutItem",
              "dynamodb:UpdateItem",
              "dynamodb:DeleteItem",
            ],
            resources: [
              props.MainTable.tableArn,
              `${props.MainTable.tableArn}/index/lsi1_index`,
            ],
          }),
        ],
      }
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
      },
      initialPolicy: [
        new cdk.aws_iam.PolicyStatement({
          effect: cdk.aws_iam.Effect.ALLOW,
          actions: ["dynamodb:Query"],
          resources: [
            props.MainTable.tableArn,
            `${props.MainTable.tableArn}/index/lsi1_index`,
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
        TABLE_NAME_MAIN: props.MainTable.tableName,
      },
      initialPolicy: [
        new cdk.aws_iam.PolicyStatement({
          effect: cdk.aws_iam.Effect.ALLOW,
          actions: ["dynamodb:GetItem", "dynamodb:PutItem"],
          resources: [props.MainTable.tableArn],
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
        TABLE_NAME_MAIN: props.MainTable.tableName,
      },
      initialPolicy: [
        new cdk.aws_iam.PolicyStatement({
          effect: cdk.aws_iam.Effect.ALLOW,
          actions: ["dynamodb:Query"],
          resources: [
            props.MainTable.tableArn,
            `${props.MainTable.tableArn}/index/lsi1_index`,
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
          TABLE_NAME_MAIN: props.MainTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:DeleteItem"],
            resources: [props.MainTable.tableArn],
          }),
        ],
      }
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
        TABLE_NAME_MAIN: props.MainTable.tableName,
      },
      initialPolicy: [
        new cdk.aws_iam.PolicyStatement({
          effect: cdk.aws_iam.Effect.ALLOW,
          actions: ["dynamodb:Query", "dynamodb:UpdateItem"],
          resources: [
            props.MainTable.tableArn,
            `${props.MainTable.tableArn}/index/lsi1_index`,
          ],
        }),
      ],
    });
  }
}
