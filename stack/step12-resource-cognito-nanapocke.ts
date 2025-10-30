import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {RetentionDays} from "aws-cdk-lib/aws-logs";

export interface Props extends cdk.StackProps {
  readonly Config: any;
}

export class Step12CognitoNanapockeStack extends cdk.Stack {
  public NanapockeAuthPool: cognito.UserPool;
  public NanapockeAuthPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const functionPrefix = `${props.Config.ProjectName}-${props.Config.Stage}`;
    const params = {
      NanapockeAuthPool: {
        // Nanapockeのユーザープール
        Name: `${functionPrefix}-NanapockeAuthPool`,
      },
      // GuestAuthPool: {  // フォトグラファーのユーザープール
      //   Name: `${props.Config.ProjectName}-${props.Config.Stage}-GuestAuthPool`,
      // },
    };

    const logGroup = new logs.LogGroup(this, "MyFunctionLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK, // ※後で変更 ログの保存期間
    });

    // ==================================================//
    // Nanapockeのユーザープール
    // ==================================================//
    // カスタム認証のトリガー Lambda
    // 認証チャレンジの定義
    const nanapockeDefineFn = new NodejsFunction(
      this,
      `${params.NanapockeAuthPool.Name}-TriggerDefine`,
      {
        functionName: `${params.NanapockeAuthPool.Name}-TriggerDefine`,
        description: `${params.NanapockeAuthPool.Name}-TriggerDefine`,
        entry: "src/handlers/trigger/cognito.auth.define.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        logGroup: logGroup,
        environment: {},
      }
    );

    // 認証チャレンジの作成
    const nanapockeCreateFn = new NodejsFunction(
      this,
      `${params.NanapockeAuthPool.Name}-TriggerCreate`,
      {
        functionName: `${params.NanapockeAuthPool.Name}-TriggerCreate`,
        description: `${params.NanapockeAuthPool.Name}-TriggerCreate`,
        entry: "src/handlers/trigger/cognito.auth.create.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        logGroup: logGroup,
      }
    );

    // 認証チャレンジの検証
    const nanapockeVerifyFn = new NodejsFunction(
      this,
      `${params.NanapockeAuthPool.Name}-TriggerVerify`,
      {
        functionName: `${params.NanapockeAuthPool.Name}-TriggerVerify`,
        description: `${params.NanapockeAuthPool.Name}-TriggerVerify`,
        entry: "src/handlers/trigger/cognito.auth.verify.ts",
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        logGroup: logGroup,
        environment: {
          // 外部IdP検証用の設定を入れる（例：JWKS URLやAPIエンドポイント）
          EXTERNAL_ISSUER: "https://idp.example.com/",
          EXTERNAL_AUD: "your-audience",
        },
      }
    );

    // ユーザープール作成
    this.NanapockeAuthPool = new cognito.UserPool(
      this,
      params.NanapockeAuthPool.Name,
      {
        userPoolName: params.NanapockeAuthPool.Name,
        signInCaseSensitive: false, // case insensitive is preferred in most situations
        deletionProtection: true,
        selfSignUpEnabled: false, // ユーザー自身でサインアップ不可
        removalPolicy: cdk.RemovalPolicy.DESTROY, // ※あとで調整する
        signInAliases: {username: true},
        standardAttributes: {
          email: {required: false, mutable: true},
        },
        customAttributes: {
          // 施設情報
          facility: new cognito.StringAttribute({
            mutable: true, // 後から変更可能
          }),
          // 役割
          role: new cognito.StringAttribute({
            mutable: true, // 後から変更可能
          }),
        },
        passwordPolicy: {
          minLength: 8,
          requireLowercase: false,
          requireUppercase: false,
          requireDigits: false,
          requireSymbols: false,
        },
        lambdaTriggers: {
          defineAuthChallenge: nanapockeDefineFn,
          createAuthChallenge: nanapockeCreateFn,
          verifyAuthChallengeResponse: nanapockeVerifyFn,
        },
      }
    );

    // ユーザープールのグループ作成 ========
    // // 園長
    // new cognito.UserPoolGroup(this, "GroupPrincipal", {
    //   userPool: this.NanapockeAuthPool,
    //   groupName: "Principal",
    // });
    // // 保育士
    // new cognito.UserPoolGroup(this, "GroupTeacher", {
    //   userPool: this.NanapockeAuthPool,
    //   groupName: "Teacher",
    // });
    // // フォトグラファー
    // new cognito.UserPoolGroup(this, "GroupPhotographer", {
    //   userPool: this.NanapockeAuthPool,
    //   groupName: "Photographer",
    // });
    // 園児（保護者）
    // new cognito.UserPoolGroup(this, "GroupGuardian", {
    //   userPool: this.NanapockeAuthPool,
    //   groupName: "Guardian",
    // });

    // ユーザープールのクライアント作成
    this.NanapockeAuthPoolClient = new cognito.UserPoolClient(
      this,
      `${params.NanapockeAuthPool.Name}-Client`,
      {
        userPool: this.NanapockeAuthPool,
        userPoolClientName: "NanapockeAuthClient",
        generateSecret: false,
        authFlows: {
          custom: true, // カスタム認証を有効化
          adminUserPassword: false, // AdminInitiateAuth 用を無効化
          userPassword: false, // USER_PASSWORD_AUTH フローを無効化
          userSrp: false, // SRP 認証も無効化
        },
        idTokenValidity: cdk.Duration.minutes(30),
        accessTokenValidity: cdk.Duration.minutes(30),
        refreshTokenValidity: cdk.Duration.days(30),
        preventUserExistenceErrors: true,
      }
    );
  }
}
