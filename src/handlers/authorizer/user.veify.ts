// 許可対象のユーザー
// - 園長
// - 保育士
// - 保護者
// - フォトグラファー

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

  // パスパラメータの施設コード
  const facilityCode = event.pathParameters.facilityCode;
  if (facilityCode == undefined) {
    console.log("Unauthorized : facilityCode");
    return {isAuthorized: false};
  }

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

    // ユーザー情報を取得
    const userInfo = await User.get(payload.sub);
    console.log("userInfo", userInfo);

    // Facility Code を確認
    if (userInfo.facilityCode != facilityCode) {
      return {isAuthorized: false};
    }

    // 許可対象のユーザー
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
  } catch (e: any) {
    console.error(e);
    return {isAuthorized: false};
  }
};
