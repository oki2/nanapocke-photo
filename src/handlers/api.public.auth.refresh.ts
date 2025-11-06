import {Setting} from "../config";
import * as http from "../http";

import {
  RefreshTokenCookie,
  SigninResponse,
  SigninResponseT,
} from "../schemas/api.admin.auth";
import {parseOrThrow} from "../libs/validate";

import * as Auth from "../utils/Cognito";

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
    Setting.MAIN_REGION,
    Setting.NANAPOCKE_AUTHPOOL_ID,
    Setting.NANAPOCKE_AUTHPOOL_CLIENT_ID,
    cookie.refreshToken
  );

  if (!res.idToken || !res.accessToken) {
    return "";
  }

  const result: SigninResponseT = {
    state: "success",
    idToken: res.idToken,
    accessToken: res.accessToken,
  };
  return http.ok(parseOrThrow(SigninResponse, result));
});
