import {CognitoJwtVerifier} from "aws-jwt-verify";
import {CloudFrontVerifyTokenCheck} from "../../utils/Authorizer";

const PROVIDER_AUTHPOOL_ID = process.env.PROVIDER_AUTHPOOL_ID || "";
const PROVIDER_AUTHPOOL_CLIENT_ID =
  process.env.PROVIDER_AUTHPOOL_CLIENT_ID || "";

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
    userPoolId: PROVIDER_AUTHPOOL_ID,
    tokenUse: "access",
    clientId: PROVIDER_AUTHPOOL_CLIENT_ID,
  });

  try {
    const payload = await verifier.verify(token);
    console.log("Token is valid. Payload:", payload);
    return {
      isAuthorized: true,
      context: {
        stringKey: Date.now().toString(),
        numberKey: 1,
        booleanKey: true,
        arrayKey: ["value1", "value2"],
        mapKey: {value1: "value2"},
      },
    };
  } catch {
    console.log("Token not valid!");
    return {isAuthorized: false};
  }
};
