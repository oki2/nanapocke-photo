import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {RetentionDays} from "aws-cdk-lib/aws-logs";

export interface Props extends cdk.StackProps {
  readonly Config: any;
}

export class Step11CognitoProviderStack extends cdk.Stack {
  public ProviderAuthPool: cognito.UserPool;
  public ProviderAuthPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const params = {
      ProviderAuthPool: {
        // サイト管理者用（主にUXBREWのメンバーのみ）
        Name: `${props.Config.ProjectName}-${props.Config.Stage}-ProviderAuthPool`,
      },
    };

    // ==================================================//
    // サイト管理者用（主にUXBREWのメンバーのみ）
    // ==================================================//
    // ユーザープール作成
    this.ProviderAuthPool = new cognito.UserPool(
      this,
      params.ProviderAuthPool.Name,
      {
        userPoolName: params.ProviderAuthPool.Name,
        signInCaseSensitive: false, // case insensitive is preferred in most situations
        deletionProtection: true,
        selfSignUpEnabled: false, // ユーザー自身でサインアップ不可
        signInAliases: {username: true, email: true},
        passwordPolicy: {
          minLength: 8,
          requireLowercase: false,
          requireUppercase: false,
          requireDigits: false,
          requireSymbols: false,
        },
      }
    );

    // ユーザープールのグループ作成
    new cognito.UserPoolGroup(this, "GroupProvider", {
      userPool: this.ProviderAuthPool,
      groupName: "Provider",
    });

    // ユーザープールのクライアント作成
    this.ProviderAuthPoolClient = new cognito.UserPoolClient(
      this,
      `${params.ProviderAuthPool.Name}-Client`,
      {
        userPool: this.ProviderAuthPool,
        userPoolClientName: "ProviderAuthClient",
        authFlows: {
          adminUserPassword: true, // AdminInitiateAuth 用を有効化
          userPassword: false, // USER_PASSWORD_AUTH フローを無効化
          userSrp: false, // SRP 認証も無効化
        },
        generateSecret: false,
      }
    );
  }
}
