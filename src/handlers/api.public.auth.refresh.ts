import {AppConfig} from "../config";
import * as http from "../http";

import {CognitoJwtVerifier} from "aws-jwt-verify";

import {
  RefreshTokenCookie,
  SigninResponse,
  SigninResponseT,
} from "../schemas/public";
import {parseOrThrow} from "../libs/validate";

import * as Auth from "../utils/Cognito";

import * as User from "../utils/Dynamo/User";
import * as Facility from "../utils/Dynamo/Facility";

import {GetParameter} from "../utils/ParameterStore";
import {GetSignedCookie} from "../utils/Cloudfront";

import {thumbnailAllowedPath} from "../libs/tool";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  console.log("event", event);
  // Cookieをオブジェクト形式に変換
  const cookieArray = event.cookies ?? [];
  const cookieMap = Object.fromEntries(
    cookieArray.map((c: any) => {
      const [k, v] = c.split("=");
      return [k.trim(), v];
    }),
  );

  // バリデーション
  const cookie = parseOrThrow(RefreshTokenCookie, cookieMap);

  // 1. リフレッシュ
  const res = await Auth.Refresh(
    AppConfig.MAIN_REGION,
    AppConfig.NANAPOCKE_AUTHPOOL_ID,
    AppConfig.NANAPOCKE_AUTHPOOL_CLIENT_ID,
    cookie.refreshToken,
  );

  if (!res.idToken || !res.accessToken) {
    return "";
  }

  // 2. ユーザー情報を取得
  const verifier = CognitoJwtVerifier.create({
    userPoolId: AppConfig.NANAPOCKE_AUTHPOOL_ID,
    tokenUse: "access",
    clientId: AppConfig.NANAPOCKE_AUTHPOOL_CLIENT_ID,
  });
  const payload = await verifier.verify(res.accessToken);
  console.log("Token is valid. Payload:", payload);

  const userInfo = await User.get(payload.sub);
  console.log("userInfo", userInfo);

  // 3. 利用可能な施設かチェック =========== //
  const facilityInfo = await Facility.isActive(userInfo.facilityCode);
  if (!facilityInfo) {
    console.log(
      `施設利用不可 : ${userInfo.facilityCode} / user : ${payload.sub}`,
    );
    return http.forbidden();
  }

  // 4. Thumbnail アクセス用署名付きCookieを作成
  const privateKey = await GetParameter(
    AppConfig.PEM_THUMBNAIL_PREVIEW_KEYPATH,
  );
  const targetPath = thumbnailAllowedPath(
    userInfo.facilityCode,
    userInfo.userRole,
    payload.sub,
  );

  const cookieAry = GetSignedCookie(
    AppConfig.NANAPHOTO_FQDN,
    AppConfig.CF_PUBLIC_KEY_THUMBNAIL_URL_KEYID,
    privateKey,
    targetPath,
  );

  const result: SigninResponseT = {
    state: "success",
    accessToken: res.accessToken,
    userName: userInfo.userName,
    facilityName: facilityInfo.name,
    facilityCode: userInfo.facilityCode,
    userRole: userInfo.userRole,
  };
  return http.ok(parseOrThrow(SigninResponse, result), {}, cookieAry);
});
