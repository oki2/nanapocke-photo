import {CloudFrontVerifyTokenCheck} from "../../utils/Authorizer";

export const handler = async (event: any = {}): Promise<any> => {
  // CloudFrontのVerify Token チェック
  if (CloudFrontVerifyTokenCheck(event) === false) {
    console.log("Unauthorized : x-origin-verify-token");
    return {isAuthorized: false};
  }

  return {
    isAuthorized: true,
    context: {
      stringKey: Date.now().toString(),
      numberKey: 1,
      booleanKey: true,
      arrayKey: ["CloudFrontVerifyCheckOnly", "Verify"],
      mapKey: {value1: "value2"},
    },
  };
};
