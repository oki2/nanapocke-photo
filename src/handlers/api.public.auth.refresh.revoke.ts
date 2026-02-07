import {AppConfig} from "../config";
import * as http from "../http";

import {RefreshTokenCookie, ResultOK} from "../schemas/public";
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
    }),
  );

  // バリデーション
  const cookie = parseOrThrow(RefreshTokenCookie, cookieMap);

  // 2. Refreshトークンを無効化
  await Auth.RevokeRefresh(
    AppConfig.MAIN_REGION,
    AppConfig.NANAPOCKE_AUTHPOOL_CLIENT_ID,
    cookie.refreshToken,
  );

  // 2. Cookieを削除
  const cookieAry = [
    `refreshToken=; path=/api/auth/refresh; max-age=0; secure; samesite=strict; httponly`,
    `userRole=; path=/api/auth/refresh; max-age=0; secure; samesite=strict; httponly`,
  ];

  return http.ok(parseOrThrow(ResultOK, {ok: true}), {}, cookieAry);
});
