import {UserConfig} from "../../../config";
import * as UserModel from "./Model";

export async function create(
  userId: string,
  userCode: string,
  userName: string,
  facilityCode: string,
  nbf: string | undefined,
  exp: string | undefined,
  createdBy: string
): Promise<void> {
  await UserModel.create(
    userId,
    userCode,
    userName,
    UserConfig.ROLE.PHOTOGRAPHER,
    facilityCode,
    {nbf: nbf, exp: exp, createdBy: createdBy}
  );
}

export const isActive = async (userId: string): Promise<boolean> => {
  const user = await UserModel.get(userId);

  const nowDate = new Date(); // 現在日時
  const nbfDate = new Date(user?.nbf);
  // 利用期間開始前の場合はfalse
  if (nowDate < nbfDate) {
    return false;
  }

  // 利用期間終了後の場合はfalse
  if (user.hasOwnProperty("exp")) {
    const expDate = new Date(user.exp);
    if (nowDate > expDate) {
      return false;
    }
  }

  // 状態がINACTIVEの場合はfalse
  return user.status === UserConfig.STATUS.ACTIVE;
};
