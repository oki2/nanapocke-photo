import {AppConfig, ApplicationConfig} from "../config";
import * as http from "../http";

import {
  CodeQueryParams,
  CodeQueryParamsT,
  NanapockeAccessTokenResponse,
  NanapockeAccessTokenResponseT,
  NanapockeUserInfoResponse,
  IdTokenPayload,
  IdTokenPayloadT,
} from "../schemas/public.nanapocke.auth";
import {parseOrThrow} from "../libs/validate";

import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  AdminAddUserToGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";

import * as jwt from "jsonwebtoken";

import {
  GetAccessToken,
  GetUserInfo,
  ConvertRoleCdToName,
} from "../utils/External/Nanapocke";

import * as Facility from "../utils/Dynamo/Facility";
import * as User from "../utils/Dynamo/User";

// Cognito Identity Provider
const idp = new CognitoIdentityProviderClient({
  region: AppConfig.MAIN_REGION,
});

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  // === Step.1 クエリストリングチェック code を取得 =========== //
  const query = parseOrThrow(
    CodeQueryParams,
    event.queryStringParameters ?? {}
  );

  // === Step.2 アクセストークン取得 =========== //
  let tmpObj = await GetAccessToken(
    AppConfig.EXT_NANAPOCKE_API_URL_ACCESS_TOKEN,
    AppConfig.EXT_NANAPOCKE_SETTING_CLIENTID,
    AppConfig.EXT_NANAPOCKE_SETTING_CLIENTSECRET,
    AppConfig.EXT_NANAPOCKE_SETTING_GRANTTYPE,
    AppConfig.EXT_NANAPOCKE_API_URL_ACCESS_TOKEN_REDIRECT,
    query.code
  );
  console.log("externalAccessToken", tmpObj);
  const nToken = parseOrThrow(NanapockeAccessTokenResponse, tmpObj ?? {});

  // === Step.3 ユーザー情報取得 =========== //
  const userRes = await GetUserInfo(
    AppConfig.EXT_NANAPOCKE_API_URL_USER_INFO,
    nToken.access_token
  );
  const userInfo = parseOrThrow(NanapockeUserInfoResponse, userRes ?? {});
  const roleName = ConvertRoleCdToName(userInfo.role_cd);
  console.log("userInfo", userInfo);

  // === Step.4 利用可能な施設かチェック =========== //
  const facilityInfo = await Facility.isActive(userInfo.nursery_cd);
  if (!facilityInfo) {
    console.log(
      `施設利用不可 : ${userInfo.nursery_cd} / user : ${userInfo.user_cd}`
    );
    return http.notFound();
  }

  // === Step.5 ユーザー確認（存在しなければ作成＆CONFIRMED） =========== //
  await ensureUserConfirmed(userInfo.user_cd, userInfo.nursery_cd, roleName);

  // === Step.6 CUSTOM_AUTH 開始 =========== //
  const start = await idp.send(
    new AdminInitiateAuthCommand({
      UserPoolId: AppConfig.NANAPOCKE_AUTHPOOL_ID,
      ClientId: AppConfig.NANAPOCKE_AUTHPOOL_CLIENT_ID,
      AuthFlow: "CUSTOM_AUTH",
      AuthParameters: {USERNAME: userInfo.user_cd},
    })
  );

  // === Step.7 CUSTOM_AUTH チャレンジ応答 =========== //
  const finish = await idp.send(
    new AdminRespondToAuthChallengeCommand({
      UserPoolId: AppConfig.NANAPOCKE_AUTHPOOL_ID,
      ClientId: AppConfig.NANAPOCKE_AUTHPOOL_CLIENT_ID,
      ChallengeName: start.ChallengeName!,
      Session: start.Session,
      ChallengeResponses: {
        USERNAME: userInfo.user_cd,
        ANSWER: nToken.access_token, // Verifyトリガーで再検証
      },
    })
  );
  console.log("finish", finish);
  const auth = finish.AuthenticationResult!;
  console.log("auth", auth);
  const payload = parseOrThrow(
    IdTokenPayload,
    jwt.decode(auth.IdToken || "", {
      complete: false,
    }) ?? {}
  );
  console.log("payload", payload);

  // === Step.8 ログイン履歴を更新 =========== //
  await User.signinNanapockeAuth(
    payload.sub,
    userInfo.user_cd,
    userInfo.name,
    roleName,
    userInfo.nursery_cd
  );

  // === Step.9 各権限別ページへとリダイレクト =========== //
  const location = ApplicationConfig.APPLICATION_PATH[roleName];
  return http.seeOther(location, {}, [
    `refreshToken=${auth.RefreshToken}; path=/api/auth/refresh; max-age=2592000; secure; samesite=strict; httponly`,
    `userRole=${roleName}; path=/api/auth/refresh; max-age=2592000; secure; samesite=strict; httponly`,
  ]);
});

async function ensureUserConfirmed(
  uid: string,
  facilityCd: string,
  roleName: string
) {
  try {
    // UserPool 内に対象ユーザーが存在するかチェック
    await idp.send(
      new AdminGetUserCommand({
        UserPoolId: AppConfig.NANAPOCKE_AUTHPOOL_ID,
        Username: uid,
      })
    );
  } catch (e: any) {
    if (e.name !== "UserNotFoundException") throw e;

    // UserPool 内に対象ユーザーが存在しなければ作成
    await idp.send(
      new AdminCreateUserCommand({
        UserPoolId: AppConfig.NANAPOCKE_AUTHPOOL_ID,
        Username: uid,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          {
            Name: "custom:facility",
            Value: facilityCd,
          },
          {
            Name: "custom:role",
            Value: roleName,
          },
        ],
      })
    );
    // パスワードを登録して認証済みに設定（カスタム認証でも安定運用）
    await idp.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: AppConfig.NANAPOCKE_AUTHPOOL_ID,
        Username: uid,
        Password: crypto.randomUUID() + crypto.randomUUID(),
        Permanent: true,
      })
    );

    // // ユーザーをグループに追加
    // await idp.send(
    //   new AdminAddUserToGroupCommand({
    //     GroupName: roleName,
    //     UserPoolId: NANAPOCKE_AUTHPOOL_ID,
    //     Username: uid,
    //   })
    // );
  }
}
