import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {UserPool, UserPoolClient} from "aws-cdk-lib/aws-cognito";
import {Table} from "aws-cdk-lib/aws-dynamodb";

export interface Props extends cdk.StackProps {
  readonly Config: any;
  readonly NanapockeAuthPool: UserPool;
  readonly NanapockeAuthPoolClient: UserPoolClient;
  readonly MainTable: Table;
  readonly NanapockeUserTable: Table;
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
        functionName: `${functionPrefix}-PublicNanapockeAuthFn`,
        description: `${functionPrefix}-PublicNanapockeAuthFn`,
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
      "ApiPublicPrincipalPhotographerCreateFn",
      {
        functionName: `${functionPrefix}-ApiPublicPrincipalPhotographerCreate`,
        description: `${functionPrefix}-ApiPublicPrincipalPhotographerCreate`,
        entry: "src/handlers/api.public.principal.photographer.create.ts",
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

    // アルバム一覧の取得
    this.lambdaFn.principaAlbumListFn = new NodejsFunction(
      this,
      "ApiPublicPrincipalAlbumListFn",
      {
        functionName: `${functionPrefix}-ApiPublicPrincipalAlbumList`,
        description: `${functionPrefix}-ApiPublicPrincipalAlbumList`,
        entry: "src/handlers/api.public.principal.album.list.ts",
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
            resources: [props.MainTable.tableArn],
          }),
        ],
      }
    );
  }
}
