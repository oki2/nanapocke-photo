#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import {Step10ResourceStack} from "../stack/step10-resource";

import {Step11CognitoProviderStack} from "../stack/step11-resource-cognito-provider";
import {Step12CognitoNanapockeStack} from "../stack/step12-resource-cognito-nanapocke";

import {Step15DynamodbStack} from "../stack/step15-resource-dynamodb";

import {Step21ApiAdminStack} from "../stack/step21-api-admin";
import {Step22ApiPublicleStack} from "../stack/step22-api-public";

import {Step31EventTriggerStack} from "../stack/step31-event-trigger";

import {Step71HttpApiAdminStack} from "../stack/step71-httpapi-admin";
import {Step72HttpApiPublicStack} from "../stack/step72-httpapi-public";

import {Step81CertificateStack} from "../stack/step81-certificate";

import {Step82CloudfrontStack} from "../stack/step82-cloudfront";

const app = new cdk.App();

const stage = app.node.tryGetContext("environment") ?? "sandbox"; // default -> sandbox
const context = app.node.tryGetContext(stage);
const account = process.env.CDK_DEFAULT_ACCOUNT;
const PROJECT_NAME = context.projectName ?? "NanaPhoto";

const S3AutoDeleteObjects = context.s3.setting.autoDeleteObjects;
const S3RemovalPolicy = S3AutoDeleteObjects
  ? cdk.RemovalPolicy.DESTROY
  : cdk.RemovalPolicy.RETAIN;

// regionの定義　基本は、東京、一部AWS制約のあるものはバージニア
export const REGION = {
  VIRGINIA: "us-east-1",
  TOKYO: "ap-northeast-1",
};

const Config = {
  Stage: stage,
  ProjectName: PROJECT_NAME,
  MainRegion: REGION.TOKYO,
  HostedZone: {
    RootDomain: context.hostedZone.rootDomain,
    PublicDomain: context.hostedZone.publicDomain,
  },
  DynamoDB: {
    Table: {
      Main: `${PROJECT_NAME}-${stage}-Main`,
      AuthFlow: `${PROJECT_NAME}-${stage}-AuthFlow`,
    },
  },
  S3: {
    Setting: {
      AutoDeleteObjects: S3AutoDeleteObjects,
      RemovalPolicy: S3RemovalPolicy,
    },
    Bucket: {
      PublicCfd: {
        BucketName: `${PROJECT_NAME}-${stage}-PublicCfd`.toLowerCase(),
      },
      Upload: {
        BucketName: `${PROJECT_NAME}-${stage}-Upload`.toLowerCase(),
      },
      Photo: {
        BucketName: `${PROJECT_NAME}-${stage}-Photo`.toLowerCase(),
      },
    },
  },
  External: {
    Nanapocke: {
      Setting: {
        ClientId: context.external.nanapocke.setting.clientId,
        ClientSecret: context.external.nanapocke.setting.clientSecret,
        GrantType: context.external.nanapocke.setting.grantType,
      },
      ApiUrl: {
        AccessToken: context.external.nanapocke.api.accessToken,
        UserInfo: context.external.nanapocke.api.userInfo,
      },
    },
  },
};

const stackStep10 = new Step10ResourceStack(app, "Step10ResourceStack", {
  env: {account: account, region: REGION.TOKYO},
  Config,
});

const stackStep11 = new Step11CognitoProviderStack(
  app,
  "Step11CognitoProviderStack",
  {
    env: {account: account, region: REGION.TOKYO},
    Config,
  }
);

const stackStep12 = new Step12CognitoNanapockeStack(
  app,
  "Step12CognitoNanapockeStack",
  {
    env: {account: account, region: REGION.TOKYO},
    Config,
  }
);

const stackStep15 = new Step15DynamodbStack(app, "Step15DynamodbStack", {
  env: {account: account, region: REGION.TOKYO},
  Config,
});

const stackStep21 = new Step21ApiAdminStack(app, "Step21ApiAdminStack", {
  env: {account: account, region: REGION.TOKYO},
  Config,
  ProviderAuthPool: stackStep11.ProviderAuthPool,
  ProviderAuthPoolClient: stackStep11.ProviderAuthPoolClient,
  MainTable: stackStep15.MainTable,
  AuthFlowTable: stackStep15.AuthFlowTable,
});

const stackStep22 = new Step22ApiPublicleStack(app, "Step22ApiPublicleStack", {
  env: {account: account, region: REGION.TOKYO},
  Config,
  NanapockeAuthPool: stackStep12.NanapockeAuthPool,
  NanapockeAuthPoolClient: stackStep12.NanapockeAuthPoolClient,
  // ProviderAuthPool: stackStep11.ProviderAuthPool,
  // ProviderAuthPoolClient: stackStep11.ProviderAuthPoolClient,
  // OrganizationAuthPool: stackStep11.OrganizationAuthPool,
  // OrganizationAuthPoolClient: stackStep11.OrganizationAuthPoolClient,
  MainTable: stackStep15.MainTable,
  NanapockeUserTable: stackStep15.NanapockeUserTable,
  bucketUpload: stackStep10.bucketUpload,
  bucketPhoto: stackStep10.bucketPhoto,
});

const stackStep31 = new Step31EventTriggerStack(
  app,
  "Step31EventTriggerStack",
  {
    env: {account: account, region: REGION.TOKYO},
    Config,
    // ProviderAuthPool: stackStep11.ProviderAuthPool,
    // ProviderAuthPoolClient: stackStep11.ProviderAuthPoolClient,
    // OrganizationAuthPool: stackStep11.OrganizationAuthPool,
    // OrganizationAuthPoolClient: stackStep11.OrganizationAuthPoolClient,
    MainTable: stackStep15.MainTable,
    // NanapockeUserTable: stackStep15.NanapockeUserTable,
    bucketUpload: stackStep10.bucketUpload,
    bucketPhoto: stackStep10.bucketPhoto,
  }
);

const stackStep71 = new Step71HttpApiAdminStack(
  app,
  "Step71HttpApiAdminStack",
  {
    env: {account: account, region: REGION.TOKYO},
    Config,
    lambdaFnAdmin: stackStep21.lambdaFn,
    ProviderAuthPool: stackStep11.ProviderAuthPool,
    ProviderAuthPoolClient: stackStep11.ProviderAuthPoolClient,
    MainTable: stackStep15.MainTable,
    AuthFlowTable: stackStep15.AuthFlowTable,
  }
);

const stackStep72 = new Step72HttpApiPublicStack(
  app,
  "Step72HttpApiPublicStack",
  {
    env: {account: account, region: REGION.TOKYO},
    Config,
    lambdaFnPublic: stackStep22.lambdaFn,
    NanapockeAuthPool: stackStep12.NanapockeAuthPool,
    NanapockeAuthPoolClient: stackStep12.NanapockeAuthPoolClient,
    // MainTable: stackStep12.MainTable,
    NanapockeUserTable: stackStep15.NanapockeUserTable,
  }
);

const stackStep81 = new Step81CertificateStack(app, "Step81CertificateStack", {
  env: {account: account, region: REGION.VIRGINIA},
  Config,
});

const stackStep82 = new Step82CloudfrontStack(app, "Step82CloudfrontStack", {
  env: {account: account, region: REGION.TOKYO},
  crossRegionReferences: true, // 他リージョンのリソース参照を許可 : VIRGINIA の Certificate を取得するため
  Config,
  cfdAdminVerifyToken: stackStep71.cfdVerifyToken,
  cfdPublicVerifyToken: stackStep72.cfdVerifyToken,
  httpApiAdmin: stackStep71.httpApi,
  httpApiPublic: stackStep72.httpApi,
  publicCertificateArn: stackStep81.publicCertificateArn,
});

// =======================
// 実行の主従関係設定
// =======================
stackStep21.addDependency(stackStep10);
stackStep21.addDependency(stackStep11);
stackStep21.addDependency(stackStep15);

stackStep22.addDependency(stackStep10);
stackStep22.addDependency(stackStep12);
stackStep22.addDependency(stackStep15);

stackStep31.addDependency(stackStep10);

stackStep71.addDependency(stackStep21);

stackStep72.addDependency(stackStep22);

stackStep82.addDependency(stackStep71);
stackStep82.addDependency(stackStep72);
stackStep82.addDependency(stackStep81);
