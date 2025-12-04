import * as http from "../http";

import {
  FacilityListResponse,
  FacilityListResponseT,
} from "../schemas/api.admin.facility";
import {parseOrThrow} from "../libs/validate";

import * as Facility from "../utils/Dynamo/Facility";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);
  // データの取得
  const data = await Facility.list();
  console.log("data", data);

  const result: FacilityListResponseT = [];

  for (const item of data) {
    result.push({
      code: item.code,
      name: item.name,
      nbf: item.nbf,
      exp: item.exp,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }

  const tmp = parseOrThrow(FacilityListResponse, result);
  console.log("tmp", tmp);
  return http.ok(tmp);

  // return ok(parseOrThrow(Facility, result));
});
