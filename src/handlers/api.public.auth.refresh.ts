import {AppConfig} from "../config";
import * as http from "../http";

import {CognitoJwtVerifier} from "aws-jwt-verify";

import {
  RefreshTokenCookie,
  SigninResponse,
  SigninResponseT,
} from "../schemas/api.public.auth";
import {parseOrThrow} from "../libs/validate";

import * as Auth from "../utils/Cognito";

import * as User from "../utils/Dynamo/User";
import * as Facility from "../utils/Dynamo/Facility";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  console.log("event", event);
  // Cookieをオブジェクト形式に変換
  const cookieArray = event.cookies ?? [];
  const cookieMap = Object.fromEntries(
    cookieArray.map((c: any) => {
      const [k, v] = c.split("=");
      return [k.trim(), v];
    })
  );

  // バリデーション
  const cookie = parseOrThrow(RefreshTokenCookie, cookieMap);

  // リフレッシュ
  const res = await Auth.Refresh(
    AppConfig.MAIN_REGION,
    AppConfig.NANAPOCKE_AUTHPOOL_ID,
    AppConfig.NANAPOCKE_AUTHPOOL_CLIENT_ID,
    cookie.refreshToken
  );

  if (!res.idToken || !res.accessToken) {
    return "";
  }

  // ユーザー情報を取得
  const verifier = CognitoJwtVerifier.create({
    userPoolId: AppConfig.NANAPOCKE_AUTHPOOL_ID,
    tokenUse: "access",
    clientId: AppConfig.NANAPOCKE_AUTHPOOL_CLIENT_ID,
  });
  const payload = await verifier.verify(res.accessToken);
  console.log("Token is valid. Payload:", payload);

  const userInfo = await User.get(payload.sub);
  console.log("userInfo", userInfo);

  // 施設情報を取得
  const facilityInfo = await Facility.get(userInfo.facilityCode);

  const result: SigninResponseT = {
    state: "success",
    accessToken: res.accessToken,
    name: userInfo.userName,
    organizationName: facilityInfo.name,
    role: userInfo.userRole,
  };
  return http.ok(parseOrThrow(SigninResponse, result));
});
