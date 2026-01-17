import * as http from "../http";

import {
  PhotographerPathParameters,
  PhotographerEditBody,
  ResultOK,
} from "../schemas/public";
import {parseOrThrow} from "../libs/validate";

import * as User from "../utils/Dynamo/User";

import {Photographer} from "../utils/Cognito";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // パスパラメータのフォトグラファーID
  const path = parseOrThrow(
    PhotographerPathParameters,
    event.pathParameters ?? {}
  );

  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(PhotographerEditBody, raw);
  console.log("data", data);

  // 日付の変換（JST -> UTCへ）
  data.expire.from = data.expire.from
    ? new Date(data.expire.from).toISOString()
    : "";
  data.expire.to = data.expire.to ? new Date(data.expire.to).toISOString() : "";

  // 1. 対象のフォトグラファーが存在するか確認
  const photographer = await User.get(path.photographerId);
  if (!photographer) {
    return http.notFound();
  }
  // 別施設のフォトグラファーならエラー
  if (photographer.facilityCode !== authContext.facilityCode) {
    return http.notFound();
  }

  // 2. DynamoDB に Photographer 情報を更新
  await User.Photographer.edit(
    path.photographerId,
    data.expire,
    authContext.userId
  );

  // 3. パスワード変更の場合は、 Cognito の Photographer パスワードを更新
  if (data.changePassword) {
    if (!data.password) {
      return http.badRequest({detail: "パスワードを入力してください"}); // バリデーションチェック済みなので、基本は発生しない
    }
    await Photographer.passwordChange(
      authContext.facilityCode,
      photographer.userCode,
      data.password
    );
  }

  return http.ok(
    parseOrThrow(ResultOK, {
      ok: true,
    })
  );
});
