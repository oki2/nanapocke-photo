import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {UserPool, UserPoolClient} from "aws-cdk-lib/aws-cognito";
import {Table} from "aws-cdk-lib/aws-dynamodb";

export interface Props extends cdk.StackProps {
  readonly Config: any;
  readonly ProviderAuthPool: UserPool;
  readonly ProviderAuthPoolClient: UserPoolClient;

  readonly MainTable: Table;
  readonly AuthFlowTable: Table;
}

interface LambdaFunctions {
  [prop: string]: NodejsFunction;
}

export class Step21ApiAdminStack extends cdk.Stack {
  public lambdaFn: LambdaFunctions = {};

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const functionPrefix = `${props.Config.ProjectName}-${props.Config.Stage}`;

    // =====================================================
    // Lambda：認証系
    // =====================================================
    // ログイン
    this.lambdaFn.authSigninFn = new NodejsFunction(
      this,
      "ApiAdminAuthSigninFn",
      {
        functionName: `${functionPrefix}-ApiAdminAuthSignin`,
        description: `${functionPrefix}-ApiAdminAuthSignin`,
        // entry: "src/lambda/api/admin/auth/signin.ts",
        entry: "src/handlers/api.admin.auth.signin.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          MAIN_REGION: process.env.CDK_DEFAULT_REGION || "",
          PROVIDER_AUTHPOOL_ID: props.ProviderAuthPool.userPoolId,
          PROVIDER_AUTHPOOL_CLIENT_ID:
            props.ProviderAuthPoolClient.userPoolClientId,
          TABLE_NAME_AUTHFLOW: props.AuthFlowTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["cognito-idp:AdminInitiateAuth"],
            resources: [
              props.ProviderAuthPool.userPoolArn,
              props.ProviderAuthPool.userPoolArn,
            ],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:PutItem"],
            resources: [props.AuthFlowTable.tableArn],
          }),
        ],
      }
    );

    // チャレンジ
    this.lambdaFn.authChallengeFn = new NodejsFunction(
      this,
      "ApiAdminAuthChallengeFn",
      {
        functionName: `${functionPrefix}-ApiAdminAuthChallenge`,
        description: `${functionPrefix}-ApiAdminAuthChallenge`,
        // entry: "src/lambda/api/admin/auth/challenge.ts",
        entry: "src/handlers/api.admin.auth.challenge.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          MAIN_REGION: process.env.CDK_DEFAULT_REGION || "",
          PROVIDER_AUTHPOOL_ID: props.ProviderAuthPool.userPoolId,
          PROVIDER_AUTHPOOL_CLIENT_ID:
            props.ProviderAuthPoolClient.userPoolClientId,
          TABLE_NAME_AUTHFLOW: props.AuthFlowTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["cognito-idp:AdminRespondToAuthChallenge"],
            resources: [
              props.ProviderAuthPool.userPoolArn,
              props.ProviderAuthPool.userPoolArn,
            ],
          }),
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:UpdateItem"],
            resources: [props.AuthFlowTable.tableArn],
          }),
        ],
      }
    );

    // Refresh
    this.lambdaFn.authRefreshFn = new NodejsFunction(
      this,
      "ApiAdminAuthRefreshFn",
      {
        functionName: `${functionPrefix}-ApiAdminAuthRefresh`,
        description: `${functionPrefix}-ApiAdminAuthRefresh`,
        entry: "src/handlers/api.admin.auth.refresh.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          MAIN_REGION: process.env.CDK_DEFAULT_REGION || "",
          PROVIDER_AUTHPOOL_ID: props.ProviderAuthPool.userPoolId,
          PROVIDER_AUTHPOOL_CLIENT_ID:
            props.ProviderAuthPoolClient.userPoolClientId,
          TABLE_NAME_AUTHFLOW: props.AuthFlowTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["cognito-idp:AdminInitiateAuth"],
            resources: [
              props.ProviderAuthPool.userPoolArn,
              props.ProviderAuthPool.userPoolArn,
            ],
          }),
        ],
      }
    );

    // =====================================================
    // Lambda：各種処理
    // =====================================================
    // 施設の登録
    this.lambdaFn.facilityCreateFn = new NodejsFunction(
      this,
      "ApiAdminFacilityCreateFn",
      {
        functionName: `${functionPrefix}-ApiAdminFacilityCreate`,
        description: `${functionPrefix}-ApiAdminFacilityCreate`,
        // entry: "src/lambda/api/admin/facility/create.ts",
        entry: "src/handlers/api.admin.facility.create.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          MAIN_REGION: process.env.CDK_DEFAULT_REGION || "",
          TABLE_NAME_MAIN: props.MainTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:PutItem"],
            resources: [props.MainTable.tableArn],
          }),
        ],
      }
    );

    // 施設一覧の取得
    this.lambdaFn.facilityListFn = new NodejsFunction(
      this,
      "ApiAdminFacilityListFn",
      {
        functionName: `${functionPrefix}-ApiAdminFacilityList`,
        description: `${functionPrefix}-ApiAdminFacilityList`,
        entry: "src/handlers/api.admin.facility.list.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          MAIN_REGION: process.env.CDK_DEFAULT_REGION || "",
          TABLE_NAME_MAIN: props.MainTable.tableName,
        },
        initialPolicy: [
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ["dynamodb:Query"],
            resources: [props.MainTable.tableArn],
          }),
        ],
      }
    );

    // 施設情報の更新
    this.lambdaFn.facilityCodeFn = new NodejsFunction(
      this,
      "ApiAdminFacilityCodeFn",
      {
        functionName: `${functionPrefix}-ApiAdminFacilityCode`,
        description: `${functionPrefix}-ApiAdminFacilityCode`,
        entry: "src/handlers/api.admin.facility.code.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        environment: {
          MAIN_REGION: process.env.CDK_DEFAULT_REGION || "",
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
  }
}
