import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";

import * as ssm from "aws-cdk-lib/aws-ssm";

// API Gateway v2 (HTTP API) — Alpha modules
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import {HttpLambdaIntegration} from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {
  HttpLambdaAuthorizer,
  HttpLambdaResponseType,
} from "aws-cdk-lib/aws-apigatewayv2-authorizers";

import {UserPool, UserPoolClient} from "aws-cdk-lib/aws-cognito";
import {Table} from "aws-cdk-lib/aws-dynamodb";

export interface Props extends cdk.StackProps {
  readonly Config: any;
  readonly lambdaFnPublic: LambdaFunctions;

  readonly NanapockeAuthPool: UserPool;
  readonly NanapockeAuthPoolClient: UserPoolClient;
  // readonly OrganizationAuthPool: UserPool;
  // readonly OrganizationAuthPoolClient: UserPoolClient;

  // readonly MainTable: Table;
  readonly NanapockeUserTable: Table;
}

interface LambdaFunctions {
  [prop: string]: NodejsFunction;
}

export class Step72HttpApiPublicStack extends cdk.Stack {
  public cfdVerifyToken: string;
  public httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const params = {
      CfdVerifyTokenPath: `/${props.Config.ProjectName}/${props.Config.Stage}/cfd/VerifyToken`,
    };

    this.cfdVerifyToken = ssm.StringParameter.valueFromLookup(
      this,
      params.CfdVerifyTokenPath
    );

    const functionPrefix = `${props.Config.ProjectName}-${props.Config.Stage}`;

    // ==========================================================
    // オーソライザーの設定
    // ==========================================================
    // CloudFront の Verify Token のみを判定するオーソライザー
    const AuthorizerPublicVerifyTokenFn = new NodejsFunction(
      this,
      "AuthorizerPublicVerifyTokenFn",
      {
        functionName: `${functionPrefix}-AuthorizerPublicVerifyToken`,
        description: `${functionPrefix}-AuthorizerPublicVerifyToken`,
        entry: "src/handlers/authorizer/common.verifyTokenCheckOnly.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        environment: {
          X_ORIGIN_VERIFY_TOKEN: this.cfdVerifyToken,
        },
      }
    );
    const AuthorizerPublicVerifyToken = new HttpLambdaAuthorizer(
      "AuthorizerPublicVerifyToken",
      AuthorizerPublicVerifyTokenFn,
      {
        responseTypes: [HttpLambdaResponseType.SIMPLE],
        identitySource: ["$request.header.x-origin-verify-token"],
        // 必要に応じてキャッシュを有効化
        resultsCacheTtl: cdk.Duration.seconds(60),
      }
    );

    // Access Token : Principal（園長）を判定するオーソライザー
    const AuthorizerPrincipalVeifyFn = new NodejsFunction(
      this,
      "AuthorizerPrincipalVeifyFn",
      {
        functionName: `${functionPrefix}-AuthorizerPrincipalVeify`,
        description: `${functionPrefix}-AuthorizerPrincipalVeify`,
        entry: "src/handlers/authorizer/principal.veify.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          MAIN_REGION: process.env.CDK_DEFAULT_REGION || "",
          X_ORIGIN_VERIFY_TOKEN: this.cfdVerifyToken,
          NANAPOCKE_AUTHPOOL_ID: props.NanapockeAuthPool.userPoolId,
          NANAPOCKE_AUTHPOOL_CLIENT_ID:
            props.NanapockeAuthPoolClient.userPoolClientId,
          TABLE_NAME_NANAPOCKE_USER: props.NanapockeUserTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem"],
            resources: [props.NanapockeUserTable.tableArn],
          }),
        ],
      }
    );
    const AuthorizerPrincipalVeify = new HttpLambdaAuthorizer(
      "AuthorizerPrincipalVeify",
      AuthorizerPrincipalVeifyFn,
      {
        responseTypes: [HttpLambdaResponseType.SIMPLE],
        identitySource: [
          "$request.header.Authorization",
          "$request.header.x-origin-verify-token",
        ],
        // 必要に応じてキャッシュを有効化
        resultsCacheTtl: cdk.Duration.seconds(60),
      }
    );

    // Access Token : 認証済みユーザーを判定するオーソライザー
    const AuthorizerUserVeifyFn = new NodejsFunction(
      this,
      "AuthorizerUserVeifyFn",
      {
        functionName: `${functionPrefix}-AuthorizerUserVeify`,
        description: `${functionPrefix}-AuthorizerUserVeify`,
        entry: "src/handlers/authorizer/user.veify.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          MAIN_REGION: process.env.CDK_DEFAULT_REGION || "",
          X_ORIGIN_VERIFY_TOKEN: this.cfdVerifyToken,
          NANAPOCKE_AUTHPOOL_ID: props.NanapockeAuthPool.userPoolId,
          NANAPOCKE_AUTHPOOL_CLIENT_ID:
            props.NanapockeAuthPoolClient.userPoolClientId,
          TABLE_NAME_NANAPOCKE_USER: props.NanapockeUserTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem"],
            resources: [props.NanapockeUserTable.tableArn],
          }),
        ],
      }
    );
    const AuthorizerUserVeify = new HttpLambdaAuthorizer(
      "AuthorizerUserVeify",
      AuthorizerUserVeifyFn,
      {
        responseTypes: [HttpLambdaResponseType.SIMPLE],
        identitySource: [
          "$request.header.Authorization",
          "$request.header.x-origin-verify-token",
        ],
        // 必要に応じてキャッシュを有効化
        resultsCacheTtl: cdk.Duration.seconds(60),
      }
    );

    // Access Token : Guardian（保護者）を判定するオーソライザー
    const AuthorizerGuardianlVeifyFn = new NodejsFunction(
      this,
      "AuthorizerGuardianlVeifyFn",
      {
        functionName: `${functionPrefix}-AuthorizerGuardianlVeifyFn`,
        description: `${functionPrefix}-AuthorizerGuardianlVeifyFn`,
        entry: "src/handlers/authorizer/guardian.veify.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          MAIN_REGION: process.env.CDK_DEFAULT_REGION || "",
          X_ORIGIN_VERIFY_TOKEN: this.cfdVerifyToken,
          NANAPOCKE_AUTHPOOL_ID: props.NanapockeAuthPool.userPoolId,
          NANAPOCKE_AUTHPOOL_CLIENT_ID:
            props.NanapockeAuthPoolClient.userPoolClientId,
          TABLE_NAME_NANAPOCKE_USER: props.NanapockeUserTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem"],
            resources: [props.NanapockeUserTable.tableArn],
          }),
        ],
      }
    );
    const AuthorizerGuardianlVeify = new HttpLambdaAuthorizer(
      "AuthorizerGuardianlVeify",
      AuthorizerGuardianlVeifyFn,
      {
        responseTypes: [HttpLambdaResponseType.SIMPLE],
        identitySource: [
          "$request.header.Authorization",
          "$request.header.x-origin-verify-token",
        ],
        // 必要に応じてキャッシュを有効化
        resultsCacheTtl: cdk.Duration.seconds(60),
      }
    );

    // ==========================================================
    // HTTP API の設定
    // ==========================================================
    this.httpApi = new apigwv2.HttpApi(this, "HttpApiPublic", {
      apiName: "HttpApiPublic",
      corsPreflight: {
        allowHeaders: ["Authorization", "Content-Type"],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowOrigins: ["*"],
      },
    });

    // ==========================================================
    // HTTP API のルーティング設定
    // ==========================================================
    // ナナポケ認証からの入り口
    this.httpApi.addRoutes({
      path: "/auth/nanapocke",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        "nanapockeAuthFn",
        props.lambdaFnPublic.nanapockeAuthFn
      ),
      authorizer: AuthorizerPublicVerifyToken,
    });

    // フォトグラファー用ログイン
    this.httpApi.addRoutes({
      path: "/api/auth/signin",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "AuthSigninIntegration",
        props.lambdaFnPublic.authSigninFn
      ),
      authorizer: AuthorizerPublicVerifyToken,
    });

    // リフレッシュ
    this.httpApi.addRoutes({
      path: "/api/auth/refresh",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "AuthRefreshIntegration",
        props.lambdaFnPublic.authRefreshFn
      ),
      authorizer: AuthorizerPublicVerifyToken,
    });

    // ==========================================================
    // フォトグラファー管理関連
    // ==========================================================
    // フォトグラファー 登録
    this.httpApi.addRoutes({
      path: "/api/facility/{facilityCode}/photographer",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "PhotographerCreateIntegration",
        props.lambdaFnPublic.photographerCreateFn
      ),
      authorizer: AuthorizerPrincipalVeify,
    });

    // フォトグラファー 一覧
    this.httpApi.addRoutes({
      path: "/api/facility/{facilityCode}/photographer/list",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        "PhotographerListIntegration",
        props.lambdaFnPublic.photographerListFn
      ),
      authorizer: AuthorizerPrincipalVeify,
    });

    // === アルバム関連 === //
    // アルバム作成
    this.httpApi.addRoutes({
      path: "/api/facility/{facilityCode}/album",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "AlbumCreateIntegration",
        props.lambdaFnPublic.albumCreateFn
      ),
      authorizer: AuthorizerPrincipalVeify,
    });

    // アルバム一覧
    this.httpApi.addRoutes({
      path: "/api/facility/{facilityCode}/album/list",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        "AlbumListIntegration",
        props.lambdaFnPublic.albumListFn
      ),
      authorizer: AuthorizerUserVeify,
    });

    // アルバム更新
    this.httpApi.addRoutes({
      path: "/api/facility/{facilityCode}/album/{albumId}",
      methods: [apigwv2.HttpMethod.PUT],
      integration: new HttpLambdaIntegration(
        "AlbumUpdateIntegration",
        props.lambdaFnPublic.albumUpdateFn
      ),
      authorizer: AuthorizerPrincipalVeify,
    });

    // アルバムの販売設定変更
    this.httpApi.addRoutes({
      path: "/api/facility/{facilityCode}/album/{albumId}/sales",
      methods: [apigwv2.HttpMethod.PUT],
      integration: new HttpLambdaIntegration(
        "AlbumSetPhotoIntegration",
        props.lambdaFnPublic.albumSalseFn
      ),
      authorizer: AuthorizerPrincipalVeify,
    });

    // 指定した販売中アルバムの写真一覧を取得（保護者専用）
    this.httpApi.addRoutes({
      path: "/api/facility/{facilityCode}/album/{albumId}/photo/list",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        "AlbumPhotoListIntegration",
        props.lambdaFnPublic.albumPhotoListFn
      ),
      authorizer: AuthorizerGuardianlVeify,
    });

    // === 写真関連 === //
    // 写真の作成・Upload用署名付きURL発行
    this.httpApi.addRoutes({
      path: "/api/facility/{facilityCode}/photo",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "PhotoUploadIntegration",
        props.lambdaFnPublic.photoUploadFn
      ),
      authorizer: AuthorizerPrincipalVeify,
    });

    // 写真一覧
    this.httpApi.addRoutes({
      path: "/api/facility/{facilityCode}/photo/list",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        "PhotoListIntegration",
        props.lambdaFnPublic.photoListFn
      ),
      authorizer: AuthorizerPrincipalVeify,
    });

    // 写真の情報を編集（アルバムIDの紐付けに利用）
    this.httpApi.addRoutes({
      path: "/api/facility/{facilityCode}/photo/{photoId}",
      methods: [apigwv2.HttpMethod.PUT],
      integration: new HttpLambdaIntegration(
        "PhotoEditIntegration",
        props.lambdaFnPublic.photoEditFn
      ),
      authorizer: AuthorizerPrincipalVeify,
    });

    // === メタ情報関連 === //
    // 写真一覧
    this.httpApi.addRoutes({
      path: "/api/facility/{facilityCode}/meta/list",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        "MetaListIntegration",
        props.lambdaFnPublic.metaListFn
      ),
      authorizer: AuthorizerPrincipalVeify,
    });

    // === カート関連 === //
    // カートに追加
    this.httpApi.addRoutes({
      path: "/api/my/cart",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "CartAddIntegration",
        props.lambdaFnPublic.cartAddFn
      ),
      authorizer: AuthorizerGuardianlVeify,
    });

    // カート内購入枚数の編集
    this.httpApi.addRoutes({
      path: "/api/my/cart",
      methods: [apigwv2.HttpMethod.PUT],
      integration: new HttpLambdaIntegration(
        "CartEditIntegration",
        props.lambdaFnPublic.cartEditFn
      ),
      authorizer: AuthorizerGuardianlVeify,
    });

    // カートの中身を取得
    this.httpApi.addRoutes({
      path: "/api/my/cart/list",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        "CartListIntegration",
        props.lambdaFnPublic.cartListFn
      ),
      authorizer: AuthorizerGuardianlVeify,
    });

    // カートの中身を削除
    this.httpApi.addRoutes({
      path: "/api/my/cart/item/{albumId}/{photoId}",
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new HttpLambdaIntegration(
        "CartPhotoDeleteIntegration",
        props.lambdaFnPublic.cartPhotoDeleteFn
      ),
      authorizer: AuthorizerGuardianlVeify,
    });

    // カートから決済情報の作成
    this.httpApi.addRoutes({
      path: "/api/my/cart/checkout",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "CartCheckoutIntegration",
        props.lambdaFnPublic.cartCheckoutFn
      ),
      authorizer: AuthorizerGuardianlVeify,
    });

    // SMBC関連 ====================================
    this.httpApi.addRoutes({
      path: "/api/payments/smbc/callback",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "SmbcCallbackIntegration",
        props.lambdaFnPublic.smbcCallbackFn
      ),
    });

    this.httpApi.addRoutes({
      path: "/api/payments/smbc/notification",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "SmbcNotificationIntegration",
        props.lambdaFnPublic.smbcNotificationFn
      ),
    });

    // ==========================================================
    // 後処理
    // ==========================================================
    // API Gateway の URL を出力
    new cdk.CfnOutput(this, "HttpApiConsoleUrl", {
      value: this.httpApi.apiEndpoint,
    });
  }
}
