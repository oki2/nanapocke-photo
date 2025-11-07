import {Setting} from "./Setting";
import * as UserModel from "./Model";

export async function signinNanapockeAuth(
  userSub: string,
  userCode: string,
  userName: string,
  userRole: string,
  facilityCode: string
): Promise<void> {
  const nowISO = new Date().toISOString();

  try {
    // 先ずは最終ログイン日時を更新する
    const result = await UserModel.updateLastLoginAt(userSub, userCode, nowISO);
    console.log(result);

    // もし userName が変わっていたら、更新する
    if (result.Attributes?.userName !== userName) {
      console.log(`update userName : ${userName}`);
      await UserModel.updateUserName(userSub, userName, nowISO);
    }
  } catch (e: any) {
    console.log(e);
    if (e.name !== "ConditionalCheckFailedException") throw e;

    // アカウント情報が存在しない場合は登録する
    console.log(`account not found : create new account : ${userSub}`);
    await UserModel.create(
      userSub,
      userCode,
      userName,
      userRole,
      facilityCode,
      {
        lastLoginAt: nowISO,
      },
      nowISO
    );
  }
}
