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

  // readonly ProviderAuthPool: UserPool;
  // readonly ProviderAuthPoolClient: UserPoolClient;
  // readonly OrganizationAuthPool: UserPool;
  // readonly OrganizationAuthPoolClient: UserPoolClient;

  // readonly MainTable: Table;
  // readonly AuthFlowTable: Table;
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

    // ==========================================================
    // オーソライザーの設定
    // ==========================================================
    // CloudFront の Verify Token のみを判定するオーソライザー
    const AuthorizerVerifyTokenCheckOnlyFn = new NodejsFunction(
      this,
      "AuthorizerVerifyTokenCheckOnlyFn",
      {
        entry: "src/handlers/authorizer/common.verifyTokenCheckOnly.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        environment: {
          X_ORIGIN_VERIFY_TOKEN: this.cfdVerifyToken,
        },
      }
    );
    const AuthorizerVerifyTokenCheckOnly = new HttpLambdaAuthorizer(
      "HttpLambdaAuthorizerVerifyTokenCheckOnly",
      AuthorizerVerifyTokenCheckOnlyFn,
      {
        responseTypes: [HttpLambdaResponseType.SIMPLE],
        identitySource: ["$request.header.x-origin-verify-token"],
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
    // 認証不要ルート（テスト用）
    this.httpApi.addRoutes({
      path: "/auth/nanapocke",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        "nanapockeAuthFn",
        props.lambdaFnPublic.nanapockeAuthFn
      ),
      authorizer: AuthorizerVerifyTokenCheckOnly,
    });

    // // 認証必須ルート（テスト用）
    // this.httpApi.addRoutes({
    //   path: "/api/secure",
    //   methods: [apigwv2.HttpMethod.GET],
    //   integration: new HttpLambdaIntegration(
    //     "SecureIntegration",
    //     props.lambdaFnConsole.helloFn
    //   ),
    //   authorizer: AuthorizerConsoleVeify,
    // });

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
