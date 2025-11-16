import {Setting} from "../config";
import * as http from "../http";

import {
  PhotographerCreateBody,
  PhotographerCreateResponse,
} from "../schemas/api.public.photographer";
import {parseOrThrow} from "../libs/validate";

import * as User from "../utils/Dynamo/User";

import {Photographer} from "../utils/Cognito";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // フォトグラファーリストの取得
  const data = await User.photographerList(authContext.facilityCode);
  console.log("data", data);

  return http.ok(data);
});
