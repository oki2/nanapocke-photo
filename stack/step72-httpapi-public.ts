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
      path: "/api/photographer/auth/signin",
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

    // フォトグラファー 登録
    this.httpApi.addRoutes({
      path: "/api/principal/photographer",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "PhotographerCreateIntegration",
        props.lambdaFnPublic.photographerCreateFn
      ),
      authorizer: AuthorizerPrincipalVeify,
    });

    // フォトグラファー 一覧
    this.httpApi.addRoutes({
      path: "/api/principal/photographer/list",
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
      path: "/api/principal/album",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "AlbumCreateIntegration",
        props.lambdaFnPublic.albumCreateFn
      ),
      authorizer: AuthorizerPrincipalVeify,
    });

    // アルバム一覧
    this.httpApi.addRoutes({
      path: "/api/principal/album/list",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        "AlbumListIntegration",
        props.lambdaFnPublic.albumListFn
      ),
      authorizer: AuthorizerPrincipalVeify,
    });

    // === 写真関連 === //
    // 写真の作成・Upload用署名付きURL発行
    this.httpApi.addRoutes({
      path: "/api/photo",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "PhotoUploadIntegration",
        props.lambdaFnPublic.photoUploadFn
      ),
      authorizer: AuthorizerPrincipalVeify,
    });

    // // ログイン
    // this.httpApi.addRoutes({
    //   path: "/api/console/auth/signin",
    //   methods: [apigwv2.HttpMethod.POST],
    //   integration: new HttpLambdaIntegration(
    //     "SigninIntegration",
    //     props.lambdaFnConsole.signinFn
    //   ),
    //   authorizer: AuthorizerVerifyTokenCheckOnly,
    // });

    // // チャレンジ（初回ログイン時等）
    // this.httpApi.addRoutes({
    //   path: "/api/console/auth/challenge",
    //   methods: [apigwv2.HttpMethod.POST],
    //   integration: new HttpLambdaIntegration(
    //     "ChallengeIntegration",
    //     props.lambdaFnConsole.challengeFn
    //   ),
    //   authorizer: AuthorizerVerifyTokenCheckOnly,
    // });

    // ==========================================================
    // 後処理
    // ==========================================================
    // API Gateway の URL を出力
    new cdk.CfnOutput(this, "HttpApiConsoleUrl", {
      value: this.httpApi.apiEndpoint,
    });
  }
}
