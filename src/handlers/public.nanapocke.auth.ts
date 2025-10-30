import {Setting} from "../config";
import * as http from "../http";

import {
  FacilityListResponse,
  FacilityListResponseT,
} from "../schemas/api.admin.facility";
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

const MAIN_REGION = process.env.MAIN_REGION || "";
const NANAPOCKE_AUTHPOOL_ID = process.env.NANAPOCKE_AUTHPOOL_ID || "";
const NANAPOCKE_AUTHPOOL_CLIENT_ID =
  process.env.NANAPOCKE_AUTHPOOL_CLIENT_ID || "";
const EXT_NANAPOCKE_API_URL_ACCESS_TOKEN =
  process.env.EXT_NANAPOCKE_API_URL_ACCESS_TOKEN || "";
const EXT_NANAPOCKE_API_URL_USER_INFO =
  process.env.EXT_NANAPOCKE_API_URL_USER_INFO || "";
const EXT_NANAPOCKE_SETTING_CLIENTID =
  process.env.EXT_NANAPOCKE_SETTING_CLIENTID || "";
const EXT_NANAPOCKE_SETTING_CLIENTSECRET =
  process.env.EXT_NANAPOCKE_SETTING_CLIENTSECRET || "";
const EXT_NANAPOCKE_SETTING_GRANTTYPE =
  process.env.EXT_NANAPOCKE_SETTING_GRANTTYPE || "";
const EXT_NANAPOCKE_API_URL_ACCESS_TOKEN_REDIRECT =
  process.env.EXT_NANAPOCKE_API_URL_ACCESS_TOKEN_REDIRECT || "";

// Cognito Identity Provider
const idp = new CognitoIdentityProviderClient({
  region: MAIN_REGION,
});

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  // === Step.1 クエリストリングチェック code を取得 =========== //
  const code = event.queryStringParameters?.code || "";
  console.log("code", code);
  if (!code) {
    return {
      statusCode: 403,
    };
  }

  // === Step.2 アクセストークン取得 =========== //
  const externalAccessToken = await GetAccessToken(
    EXT_NANAPOCKE_API_URL_ACCESS_TOKEN,
    EXT_NANAPOCKE_SETTING_CLIENTID,
    EXT_NANAPOCKE_SETTING_CLIENTSECRET,
    EXT_NANAPOCKE_SETTING_GRANTTYPE,
    EXT_NANAPOCKE_API_URL_ACCESS_TOKEN_REDIRECT,
    code
  );
  console.log("externalAccessToken", externalAccessToken);
  if (!externalAccessToken) {
    return {
      statusCode: 403,
    };
  }

  // === Step.3 ユーザー情報取得 =========== //
  const userInfo = await GetUserInfo(
    EXT_NANAPOCKE_API_URL_USER_INFO,
    externalAccessToken
  );
  console.log("userInfo", userInfo);
  if (!userInfo) {
    return {
      statusCode: 403,
    };
  }

  // === Step.4 ユーザー確認（存在しなければ作成＆CONFIRMED） =========== //
  await ensureUserConfirmed(
    userInfo.user_cd,
    userInfo.nursery_cd,
    userInfo.role_cd
  );

  // === Step.5 CUSTOM_AUTH 開始 =========== //
  console.log("Step.5 CUSTOM_AUTH : Start");
  const start = await idp.send(
    new AdminInitiateAuthCommand({
      UserPoolId: NANAPOCKE_AUTHPOOL_ID,
      ClientId: NANAPOCKE_AUTHPOOL_CLIENT_ID,
      AuthFlow: "CUSTOM_AUTH",
      AuthParameters: {USERNAME: userInfo.user_cd},
    })
  );
  console.log("Step.5 CUSTOM_AUTH : End");
  console.log("start", start);

  // === Step.6 CUSTOM_AUTH チャレンジ応答 =========== //
  console.log("Step.6 CUSTOM_AUTH : Start");
  const finish = await idp.send(
    new AdminRespondToAuthChallengeCommand({
      UserPoolId: NANAPOCKE_AUTHPOOL_ID,
      ClientId: NANAPOCKE_AUTHPOOL_CLIENT_ID,
      ChallengeName: start.ChallengeName!,
      Session: start.Session,
      ChallengeResponses: {
        USERNAME: userInfo.user_cd,
        ANSWER: externalAccessToken, // Verifyトリガーで再検証
      },
    })
  );
  console.log("Step.6 CUSTOM_AUTH : End");
  console.log("finish", finish);

  const auth = finish.AuthenticationResult!;

  // === Step.7 cognito:groups の取得、ログイン者の振り分け =========== //
  // const accessTokenDecoded = jwt.decode(auth.AccessToken!, {complete: false});
  // if (!accessTokenDecoded) {
  //   return {
  //     statusCode: 403,
  //   };
  // }

  // const cookie = buildRefreshCookie(auth.RefreshToken!);
  // const body = {
  //   accessToken: auth.AccessToken!,
  //   idToken: auth.IdToken!,
  //   expiresIn: auth.ExpiresIn!,
  // };
  // return resp(200, body, origin, [cookie]);

  return {
    statusCode: 200,
    headers: {"content-type": "application/json"},
    cookies: ["cookie1=value1", "cookie2=value2"],
    body: JSON.stringify({
      path: event.rawPath,
      message: "Hello from Lambda! : " + Date.now().toString(),
      accessToken: auth.AccessToken!,
      idToken: auth.IdToken!,
      refreshToken: auth.RefreshToken!,
      expiresIn: auth.ExpiresIn!,
    }),
  };
});

async function ensureUserConfirmed(
  uid: string,
  facilityCd: string,
  roleCd: number
) {
  try {
    // UserPool 内に対象ユーザーが存在するかチェック
    await idp.send(
      new AdminGetUserCommand({
        UserPoolId: NANAPOCKE_AUTHPOOL_ID,
        Username: uid,
      })
    );
  } catch (e: any) {
    if (e.name !== "UserNotFoundException") throw e;

    // UserPool 内に対象ユーザーが存在しなければ作成
    const roleName = ConvertRoleCdToName(roleCd);
    await idp.send(
      new AdminCreateUserCommand({
        UserPoolId: NANAPOCKE_AUTHPOOL_ID,
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
    // CONFIRMED化（カスタム認証でも安定運用）
    await idp.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: NANAPOCKE_AUTHPOOL_ID,
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

// function buildRefreshCookie(token: string) {
//   const maxAge = Number(process.env.COOKIE_MAX_AGE ?? 30 * 24 * 3600);
//   return [
//     `__Host-refresh=${encodeURIComponent(token)}`,
//     "Path=/",
//     "HttpOnly",
//     "Secure",
//     "SameSite=Strict",
//     `Max-Age=${maxAge}`,
//   ].join("; ");
// }

// function resp(
//   code: number,
//   body: any,
//   origin: string,
//   setCookies: string[] = []
// ) {
//   const headers: Record<string, string | string[]> = {
//     "content-type": "application/json",
//     "access-control-allow-origin": origin,
//     "access-control-allow-credentials": "true",
//     "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
//     "x-frame-options": "DENY",
//     "x-content-type-options": "nosniff",
//     "referrer-policy": "no-referrer",
//     "permissions-policy": "interest-cohort=()",
//   };
//   if (setCookies.length) headers["set-cookie"] = setCookies;
//   return {statusCode: code, headers, body: JSON.stringify(body)};
// }
