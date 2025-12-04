import * as http from "../http";

import {
  FacilityCreateBody,
  FacilityResponse,
  FacilityResponseT,
} from "../schemas/api.admin.facility";
import {parseOrThrow} from "../libs/validate";

import * as Facility from "../utils/Dynamo/Facility";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  // Request データの確認・バリデーション
  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(FacilityCreateBody, raw);

  // データの登録
  const res = await Facility.create(data.code, data.name, data.nbf, data.exp);
  console.log("res", res);

  const result: FacilityResponseT = {
    code: res.code,
    name: res.name,
    nbf: res.nbf,
    exp: res.exp,
    status: res.status,
    createdAt: res.createdAt,
    updatedAt: res.createdAt,
  };

  const tmp = parseOrThrow(FacilityResponse, result);
  console.log("tmp", tmp);
  return http.ok(tmp);

  // return ok(parseOrThrow(Facility, result));
});
