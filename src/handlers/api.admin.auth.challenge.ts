import {Setting} from "../config";
import * as http from "../http";

import {
  ChallengeBody,
  ChallengeSuccess,
  ChallengeSuccessT,
} from "../schemas/api.admin.auth";
import {parseOrThrow} from "../libs/validate";

import * as Auth from "../utils/Cognito";
import * as ChallengeSession from "../utils/Dynamo/Auth/ChallengeSession";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(ChallengeBody, raw);

  console.log("userName : " + data.userName);
  console.log("password : " + data.password);
  console.log("flowId : " + data.flowId);

  const session = await ChallengeSession.get(data.flowId);
  console.log("session", session);

  const auth = await Auth.Challenge(
    Setting.MAIN_REGION,
    Setting.PROVIDER_AUTHPOOL_ID,
    Setting.PROVIDER_AUTHPOOL_CLIENT_ID,
    data.userName,
    data.password,
    session || ""
  );
  console.log("auth", auth);

  if (auth) {
    console.log("SUCCESS");
    const result: ChallengeSuccessT = {
      ok: true,
    };
    return http.ok(parseOrThrow(ChallengeSuccess, result));
  }

  console.log("FAILURE");
  return http.badRequest({message: "権限がありません"});
});
