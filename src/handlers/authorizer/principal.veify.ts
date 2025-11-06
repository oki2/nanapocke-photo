import {CognitoJwtVerifier} from "aws-jwt-verify";
import {CloudFrontVerifyTokenCheck} from "../../utils/Authorizer";
import * as User from "../../utils/Dynamo/User";

const NANAPOCKE_AUTHPOOL_ID = process.env.NANAPOCKE_AUTHPOOL_ID || "";
const NANAPOCKE_AUTHPOOL_CLIENT_ID =
  process.env.NANAPOCKE_AUTHPOOL_CLIENT_ID || "";

export const handler = async (event: any = {}): Promise<any> => {
  // CloudFrontのVerify Token チェック
  if (CloudFrontVerifyTokenCheck(event) === false) {
    console.log("Unauthorized : x-origin-verify-token");
    return {isAuthorized: false};
  }

  console.log("event.headers : ", event.headers);

  const [bearer, token] = event.headers.authorization.split(" ");
  if (bearer !== "Bearer") {
    console.log("Unauthorized : Bearer");
    return {isAuthorized: false};
  }

  if (token == "") {
    console.log("Unauthorized : token");
    return {isAuthorized: false};
  }

  const verifier = CognitoJwtVerifier.create({
    userPoolId: NANAPOCKE_AUTHPOOL_ID,
    tokenUse: "access",
    clientId: NANAPOCKE_AUTHPOOL_CLIENT_ID,
  });

  try {
    const payload = await verifier.verify(token);
    console.log("Token is valid. Payload:", payload);

    const userInfo = await User.get(payload.sub);
    console.log("userInfo", userInfo);

    // User の Role を確認、PRINCIPAL なら認可
    if (userInfo.userRole === User.Setting.ROLE.PRINCIPAL) {
      return {
        isAuthorized: true,
        context: {
          userId: payload.sub,
          userCode: userInfo.userCode,
          userName: userInfo.userName,
          facilityCode: userInfo.facilityCode,
          role: userInfo.userRole,
        },
      };
    }
    return {isAuthorized: false};
  } catch (e: any) {
    console.error(e);
    return {isAuthorized: false};
  }
};
