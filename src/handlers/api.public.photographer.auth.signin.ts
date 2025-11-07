import {Setting} from "../config";
import * as http from "../http";
import {
  AuthSigninBody,
  SigninSuccess,
  SigninSuccessT,
  IdTokenPayload,
} from "../schemas/api.public.auth";
import {parseOrThrow} from "../libs/validate";

import * as jwt from "jsonwebtoken";

import * as Auth from "../utils/Cognito";
import * as Facility from "../utils/Dynamo/Facility";
import * as User from "../utils/Dynamo/User";

/**
 * Hello World!
 */
export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(AuthSigninBody, raw);

  console.log("data", data);

  // === Step.1 利用可能な施設かチェック =========== //
  if ((await Facility.isActive(data.facilityCode)) === false) {
    console.log(
      `施設利用不可 : ${data.facilityCode} / user : ${data.userName}`
    );
    return http.forbidden();
  }

  // === Step.2 ログイン処理 =========== //
  const auth = await Auth.Signin(
    Setting.MAIN_REGION,
    Setting.NANAPOCKE_AUTHPOOL_ID,
    Setting.NANAPOCKE_AUTHPOOL_PHOTOGRAPHER_CLIENT_ID,
    `${data.facilityCode}@${data.userName}`,
    data.password
  );
  // ログイン成功以外は全てエラーとする
  if (auth.result !== Auth.Setting.SigninResults.Success) {
    console.log("signin error", auth);
    return http.unauthorized();
  }

  // === Step.3 IdToken から対象のフォトグラファーの有効・無効の判断
  const payload = parseOrThrow(
    IdTokenPayload,
    jwt.decode(auth.idToken || "", {
      complete: false,
    }) ?? {}
  );
  console.log("payload", payload);
  if ((await User.Photographer.isActive(payload.sub)) === false) {
    console.log(
      `フォトグラファー利用不可 : ${payload.sub} / user : ${data.userName}`
    );
    return http.forbidden();
  }

  // === Step.4 ログイン成功としてデータを返す =========== //
  const result: SigninSuccessT = {
    state: "success",
    idToken: auth.idToken ?? "",
    accessToken: auth.accessToken ?? "",
  };
  console.log("result", result);
  return http.ok(parseOrThrow(SigninSuccess, result), {}, [
    `refreshToken=${auth.refreshToken}; path=/api/auth/refresh; max-age=2592000; secure; samesite=strict; httponly`,
    `userRole=${Setting.ROLE.PHOTOGRAPHER}; path=/api/auth/refresh; max-age=2592000; secure; samesite=strict; httponly`,
  ]);
});
