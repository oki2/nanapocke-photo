import * as http from "../http";

import {
  FacilityCodePathParams,
  FacilityUpdateBody,
  FacilityResponse,
  FacilityResponseT,
} from "../schemas/api.admin.facility";
import {parseOrThrow} from "../libs/validate";

import * as Facility from "../utils/Dynamo/Facility";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  console.log("event", event);
  // Request データの確認・バリデーション
  const path = parseOrThrow(FacilityCodePathParams, event.pathParameters ?? {});
  console.log("path", path);

  // Request データの確認・バリデーション
  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(FacilityUpdateBody, raw);

  // データの登録
  const res = await Facility.update(
    path.code,
    data.name,
    data.nbf,
    data.exp,
    data.status
  );
  console.log("res", res);

  const result: FacilityResponseT = {
    code: res?.sk,
    name: res?.name,
    nbf: res?.nbf,
    exp: res?.exp,
    status: res?.status,
    createdAt: res?.createdAt,
    updatedAt: res?.updatedAt,
  };

  const tmp = parseOrThrow(FacilityResponse, result);
  console.log("tmp", tmp);
  return http.ok(tmp);

  // return ok(parseOrThrow(Facility, result));
});
