import {AppConfig, UserConfig, CognitoConfig} from "../config";
import * as http from "../http";
import {parseOrThrow} from "../libs/validate";
import {
  AuthSigninBody,
  SigninSuccess,
  SigninSuccessT,
  IdTokenPayload,
} from "../schemas/public";

import * as jwt from "jsonwebtoken";

import * as Auth from "../utils/Cognito";
import * as Facility from "../utils/Dynamo/Facility";
import * as User from "../utils/Dynamo/User";

import {GetParameter} from "../utils/ParameterStore";
import {GetSignedCookie} from "../utils/Cloudfront";

import {thumbnailAllowedPath} from "../libs/tool";

/**
 * Hello World!
 */
export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(AuthSigninBody, raw);

  console.log("data", data);

  // === Step.1 利用可能な施設かチェック =========== //
  const facilityInfo = await Facility.isActive(data.facilityCode);
  if (!facilityInfo) {
    console.log(
      `施設利用不可 : ${data.facilityCode} / user : ${data.userCode}`,
    );
    return http.forbidden();
  }

  // === Step.2 ログイン処理 =========== //
  const auth = await Auth.Signin(
    AppConfig.MAIN_REGION,
    AppConfig.NANAPOCKE_AUTHPOOL_ID,
    AppConfig.NANAPOCKE_AUTHPOOL_CLIENT_ID,
    `${data.facilityCode}@${data.userCode}`,
    data.password,
  );
  // ログイン成功以外は全てエラーとする
  if (auth.result !== CognitoConfig.SigninResults.Success) {
    console.log("signin error", auth);
    return http.unauthorized();
  }

  // === Step.3 IdToken から対象のフォトグラファーの有効・無効の判断
  const payload = parseOrThrow(
    IdTokenPayload,
    jwt.decode(auth.idToken || "", {
      complete: false,
    }) ?? {},
  );
  console.log("payload", payload);
  const user = await User.Photographer.isActive(payload.sub);
  if (!user) {
    console.log(
      `フォトグラファー利用不可 : ${payload.sub} / user : ${data.userCode}`,
    );
    return http.forbidden();
  }

  // === Step.4 最終ログイン日時を更新
  await User.updateLastLoginAt(user.userId, user.userCode);

  // === Step.5 ログイン成功としてデータを返す =========== //
  const result: SigninSuccessT = {
    state: "success",
    accessToken: auth.accessToken ?? "",
    userName: user.userName,
    facilityCode: data.facilityCode,
    facilityName: facilityInfo.name,
    userRole: UserConfig.ROLE.PHOTOGRAPHER,
  };
  console.log("result", result);

  // === Step.6. Thumbnail アクセス用署名付きCookieを作成
  const privateKey = await GetParameter(
    AppConfig.PEM_THUMBNAIL_PREVIEW_KEYPATH,
  );
  const targetPath = thumbnailAllowedPath(
    data.facilityCode,
    UserConfig.ROLE.PHOTOGRAPHER,
    payload.sub,
  );
  const cookieAry = GetSignedCookie(
    AppConfig.NANAPHOTO_FQDN,
    AppConfig.CF_PUBLIC_KEY_THUMBNAIL_URL_KEYID,
    privateKey,
    targetPath,
  );

  return http.ok(parseOrThrow(SigninSuccess, result), {}, [
    ...cookieAry,
    `refreshToken=${auth.refreshToken}; path=/api/auth/refresh; max-age=2592000; secure; samesite=strict; httponly`,
    `userRole=${UserConfig.ROLE.PHOTOGRAPHER}; path=/api/auth/refresh; max-age=2592000; secure; samesite=strict; httponly`,
  ]);
});
