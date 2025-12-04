/**
 * ユーザー登録
 */
import {NotFoundError} from "../../errors/NotFoundError";
import {AppConfig, UserConfig, CognitoConfig} from "../../config";
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
    region: AppConfig.MAIN_REGION,
  });

  console.log("create user", userName, password, facilityCode);
  await idp.send(
    new AdminCreateUserCommand({
      UserPoolId: AppConfig.NANAPOCKE_AUTHPOOL_ID,
      Username: `${facilityCode}@${userName}`,
      MessageAction: "SUPPRESS",
      UserAttributes: [
        {
          Name: "custom:facility",
          Value: facilityCode,
        },
        {
          Name: "custom:role",
          Value: UserConfig.ROLE.PHOTOGRAPHER,
        },
      ],
    })
  );

  // パスワードを登録して認証済みに設定（カスタム認証でも安定運用）
  // まれに作成直後の取りこぼしに備え、軽いリトライを実装
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`set password count : ${i} : ${facilityCode}@${userName}`);
      await idp.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: AppConfig.NANAPOCKE_AUTHPOOL_ID,
          Username: `${facilityCode}@${userName}`,
          Password: password,
          Permanent: true,
        })
      );
      break;
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
    console.log(`get user count : ${i} : ${facilityCode}@${userName}`);
    try {
      const user = await idp.send(
        new AdminGetUserCommand({
          UserPoolId: AppConfig.NANAPOCKE_AUTHPOOL_ID,
          Username: `${facilityCode}@${userName}`,
        })
      );
      console.log("user", user);
      sub = user.UserAttributes?.find((a) => a.Name === "sub")?.Value || "";
      console.log("sub", sub);
      break;
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
