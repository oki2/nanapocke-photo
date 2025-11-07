import {Setting} from "./Setting";
import * as UserModel from "./Model";

export async function create(
  userSub: string,
  userCode: string,
  userName: string,
  facilityCode: string,
  nbf: string | undefined,
  exp: string | undefined,
  createdBy: string
): Promise<void> {
  await UserModel.create(
    userSub,
    userCode,
    userName,
    Setting.ROLE.PHOTOGRAPHER,
    facilityCode,
    {nbf: nbf, exp: exp, createdBy: createdBy}
  );
}

export const isActive = async (userSub: string): Promise<boolean> => {
  const user = await UserModel.get(userSub);

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
  return user.status === Setting.STATUS.ACTIVE;
};
