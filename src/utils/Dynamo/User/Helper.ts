import {UserConfig} from "../../../config";
import * as UserModel from "./Model";

export async function signinNanapockeAuth(
  userId: string,
  userCode: string,
  userName: string,
  userRole: string,
  facilityCode: string
): Promise<void> {
  const nowISO = new Date().toISOString();

  try {
    // 先ずは最終ログイン日時を更新する
    const result = await UserModel.updateLastLoginAt(userId, userCode, nowISO);
    console.log(result);

    // もし userName が変わっていたら、更新する
    if (result.Attributes?.userName !== userName) {
      console.log(`update userName : ${userName}`);
      await UserModel.updateUserName(userId, userName, nowISO);
    }
  } catch (e: any) {
    console.log(e);
    if (e.name !== "ConditionalCheckFailedException") throw e;

    // アカウント情報が存在しない場合は登録する　有効期限は無期限
    console.log(`account not found : create new account : ${userId}`);
    await UserModel.create(
      userId,
      userCode,
      userName,
      userRole,
      facilityCode,
      {mode: UserConfig.EXPIRE_MODE.UNLIMITED, from: "", to: ""},
      {
        lastLoginAt: nowISO,
      },
      nowISO
    );
  }
}
