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
  readonly lambdaFnAdmin: LambdaFunctions;

  readonly ProviderAuthPool: UserPool;
  readonly ProviderAuthPoolClient: UserPoolClient;
  // readonly OrganizationAuthPool: UserPool;
  // readonly OrganizationAuthPoolClient: UserPoolClient;

  readonly MainTable: Table;
  readonly AuthFlowTable: Table;
}

interface LambdaFunctions {
  [prop: string]: NodejsFunction;
}

export class Step71HttpApiAdminStack extends cdk.Stack {
  public cfdVerifyToken: string;
  public httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const params = {
      CfdVerifyTokenPath: `/${props.Config.ProjectName}/${props.Config.Stage}/cfd/VerifyToken/admin`,
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
    const AuthorizerAdminVerifyTokenFn = new NodejsFunction(
      this,
      "AuthorizerAdminVerifyTokenFn",
      {
        functionName: `${functionPrefix}-AuthorizerAdminVerifyToken`,
        description: `${functionPrefix}-AuthorizerAdminVerifyToken`,
        entry: "src/handlers/authorizer/common.verifyTokenCheckOnly.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          X_ORIGIN_VERIFY_TOKEN: this.cfdVerifyToken,
        },
      }
    );
    const AuthorizerAdminVerifyToken = new HttpLambdaAuthorizer(
      "AuthorizerAdminVerifyToken",
      AuthorizerAdminVerifyTokenFn,
      {
        responseTypes: [HttpLambdaResponseType.SIMPLE],
        identitySource: ["$request.header.x-origin-verify-token"],
        // 必要に応じてキャッシュを有効化
        resultsCacheTtl: cdk.Duration.seconds(60),
      }
    );

    // Cognito の Access Token を判定するオーソライザー
    const AuthorizerAdminVeifyFn = new NodejsFunction(
      this,
      "AuthorizerAdminVeifyFn",
      {
        entry: "src/handlers/authorizer/admin.veify.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          X_ORIGIN_VERIFY_TOKEN: this.cfdVerifyToken,
          PROVIDER_AUTHPOOL_ID: props.ProviderAuthPool.userPoolId,
          PROVIDER_AUTHPOOL_CLIENT_ID:
            props.ProviderAuthPoolClient.userPoolClientId,
        },
      }
    );
    const AuthorizerAdminVeify = new HttpLambdaAuthorizer(
      "AuthorizerAdminVeify",
      AuthorizerAdminVeifyFn,
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
    this.httpApi = new apigwv2.HttpApi(this, "HttpApiAdmin", {
      apiName: "HttpApiAdmin",
      corsPreflight: {
        allowHeaders: ["Authorization", "Content-Type"],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowOrigins: ["*"],
      },
    });

    // ==========================================================
    // HTTP API のルーティング設定
    // ==========================================================
    // ログイン
    this.httpApi.addRoutes({
      path: "/api/admin/auth/signin",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "AuthSigninIntegration",
        props.lambdaFnAdmin.authSigninFn
      ),
      authorizer: AuthorizerAdminVerifyToken,
    });

    // チャレンジ（初回ログイン時等）
    this.httpApi.addRoutes({
      path: "/api/admin/auth/challenge",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "AuthChallengeIntegration",
        props.lambdaFnAdmin.authChallengeFn
      ),
      authorizer: AuthorizerAdminVerifyToken,
    });

    // リフレッシュ
    this.httpApi.addRoutes({
      path: "/api/admin/auth/refresh",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "AuthRefreshIntegration",
        props.lambdaFnAdmin.authRefreshFn
      ),
      authorizer: AuthorizerAdminVerifyToken,
    });

    // 施設新規登録
    this.httpApi.addRoutes({
      path: "/api/admin/facility",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "FacilityCreateIntegration",
        props.lambdaFnAdmin.facilityCreateFn
      ),
      authorizer: AuthorizerAdminVeify,
    });

    // 施設情報一覧取得
    this.httpApi.addRoutes({
      path: "/api/admin/facility/list",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        "FacilityListIntegration",
        props.lambdaFnAdmin.facilityListFn
      ),
      authorizer: AuthorizerAdminVeify,
    });

    // 施設情報更新
    this.httpApi.addRoutes({
      path: "/api/admin/facility/{code}",
      methods: [apigwv2.HttpMethod.PUT],
      integration: new HttpLambdaIntegration(
        "FacilityCodeIntegration",
        props.lambdaFnAdmin.facilityCodeFn
      ),
      authorizer: AuthorizerAdminVeify,
    });

    // ==========================================================
    // 後処理
    // ==========================================================
    // API Gateway の URL を出力
    new cdk.CfnOutput(this, "HttpApiAdminUrl", {
      value: this.httpApi.apiEndpoint,
    });
  }
}
