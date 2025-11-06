/**
 * ユーザー登録
 */
import {NotFoundError} from "../../errors/NotFoundError";
import {Setting} from "./Setting";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";

export async function create(
  userName: string,
  password: string,
  facilityCode: string
): Promise<string> {
  const idp = new CognitoIdentityProviderClient({
    region: Setting.MAIN_REGION,
  });

  console.log("create user", userName, password, facilityCode);
  await idp.send(
    new AdminCreateUserCommand({
      UserPoolId: Setting.NANAPOCKE_AUTHPOOL_ID,
      Username: `${facilityCode}@${userName}`,
      MessageAction: "SUPPRESS",
      UserAttributes: [
        {
          Name: "custom:facility",
          Value: facilityCode,
        },
        {
          Name: "custom:role",
          Value: Setting.ROLE.PHOTOGRAPHER,
        },
      ],
    })
  );

  console.log("set password", userName, password);
  // パスワードを登録して認証済みに設定（カスタム認証でも安定運用）
  // まれに作成直後の取りこぼしに備え、軽いリトライを実装
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await idp.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: Setting.NANAPOCKE_AUTHPOOL_ID,
          Username: `${facilityCode}@${userName}`,
          Password: password,
          Permanent: true,
        })
      );
    } catch (e) {
      // NotAuthorizedException / UserNotFoundException などは設定誤りの可能性
      console.log("error", e);
      console.log("retry : ", i);
      if (i === maxRetries - 1) throw e;
    }
    // 100〜300ms くらいの短い待機を入れると安定（例示）
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log("get user", userName);
  // 登録したユーザーの情報を取得
  // まれに作成直後の取りこぼしに備え、軽いリトライを実装
  let sub = "";
  for (let i = 0; i < maxRetries; i++) {
    try {
      const user = await idp.send(
        new AdminGetUserCommand({
          UserPoolId: Setting.NANAPOCKE_AUTHPOOL_ID,
          Username: `${facilityCode}@${userName}`,
        })
      );
      console.log("user", user);
      sub = user.UserAttributes?.find((a) => a.Name === "sub")?.Value || "";
      console.log("sub", sub);
    } catch (e) {
      // NotAuthorizedException / UserNotFoundException などは設定誤りの可能性
      console.log("error", e);
      console.log("retry : ", i);
      if (i === maxRetries - 1) throw e;
    }
    // 100〜300ms くらいの短い待機を入れると安定（例示）
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log("sub", sub);
  if (sub) {
    return sub;
  }
  throw new Error("sub を取得できませんでした");
}
