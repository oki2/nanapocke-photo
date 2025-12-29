import * as http from "../http";

import {
  FacilityCreateBody,
  FacilityResponse,
  FacilityResponseT,
} from "../schemas/api.admin.facility";
import {parseOrThrow} from "../libs/validate";

import * as Facility from "../utils/Dynamo/Facility";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // Request データの確認・バリデーション
  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(FacilityCreateBody, raw);

  // クラスCodeの正当性チェック、施設Codeとクラスコードの最初の5文字は一致する事を確認
  for (const classData of data.classList) {
    if (classData.code.slice(0, 5) !== data.code) {
      return http.badRequest({
        message: `クラスコード不整合：施設：${data.code}、クラス：${classData.code}`,
      });
    }
  }

  // データの登録
  await Facility.create(
    data.code,
    data.name,
    data.nbf,
    data.exp,
    data.classList,
    authContext.userId
  );

  const result: FacilityResponseT = {
    code: data.code,
    name: data.name,
    nbf: data.nbf,
    exp: data.exp,
    classCount: data.classList.length,
  };

  return http.ok(parseOrThrow(FacilityResponse, result));
});
