import {Setting} from "../config";
import * as http from "../http";
import {
  AuthSigninBody,
  SigninResponse,
  SigninResponseT,
} from "../schemas/api.admin.auth";
import {parseOrThrow} from "../libs/validate";

import * as Auth from "../utils/Cognito";
import * as ChallengeSession from "../utils/Dynamo/Auth/ChallengeSession";

/**
 * Hello World!
 */
export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(AuthSigninBody, raw);

  const auth = await Auth.Signin(
    Setting.MAIN_REGION,
    Setting.PROVIDER_AUTHPOOL_ID,
    Setting.PROVIDER_AUTHPOOL_CLIENT_ID,
    data.userName,
    data.password
  );

  switch (auth.result) {
    // Success
    case Auth.Setting.SigninResults.Success: {
      console.log("SUCCESS");
      const result: SigninResponseT = {
        state: "success",
        idToken: auth.idToken ?? "",
        accessToken: auth.accessToken ?? "",
      };
      return http.ok(parseOrThrow(SigninResponse, result), {}, [
        `refreshToken=${auth.refreshToken}; path=/api/admin/auth/refresh; max-age=2592000; secure; samesite=strict; httponly`,
      ]);
    }

    // Challenge
    case Auth.Setting.SigninResults.Challenge: {
      console.log("NEW_PASSWORD_REQUIRED");
      const flowId = await ChallengeSession.put(auth.session || "");
      const result: SigninResponseT = {
        state: "challenge",
        challenge: auth.challenge ?? "",
        flowId: flowId ?? "",
      };
      return http.ok(parseOrThrow(SigninResponse, result));
    }

    // Failure
    case Auth.Setting.SigninResults.Failure:
    default:
      console.log("FAILURE");
      return http.badRequest({message: auth.message ?? "Error"});
  }
});
