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

  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(PhotographerCreateBody, raw);
  console.log("data", data);

  // 1. Cognito に Photographer を作成
  const newUserSub = await Photographer.create(
    data.userCode,
    data.password,
    authContext.facilityCode
  );

  // 2. DynamoDB に Photographer を作成
  await User.Photographer.create(
    newUserSub,
    data.userCode,
    data.userName,
    authContext.facilityCode,
    data.nbf ?? new Date().toISOString(),
    data.exp ?? undefined,
    authContext.userSub
  );

  return http.ok(
    parseOrThrow(PhotographerCreateResponse, {
      userCode: data.userCode,
      userName: data.userName,
    })
  );
});
