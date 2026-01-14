import {UserConfig} from "../../../config";
import * as UserModel from "./Model";

export async function create(
  userId: string,
  userCode: string,
  userName: string,
  facilityCode: string,
  description: string,
  expireMode: string,
  expireDate: Record<string, any>,
  createdBy: string
): Promise<void> {
  await UserModel.create(
    userId,
    userCode,
    userName,
    UserConfig.ROLE.PHOTOGRAPHER,
    facilityCode,
    {
      description: description,
      expireMode: expireMode,
      expireDate: expireDate,
      createdBy: createdBy,
    }
  );
}

export const isActive = async (userId: string): Promise<any> => {
  const user = await UserModel.get(userId);

  // ユーザー情報が存在しない場合はfalse
  if (!user) {
    return undefined;
  }

  // 状態がINACTIVEの場合は undefined
  if (user.status === UserConfig.STATUS.INACTIVE) {
    return undefined;
  }

  // 無期限なら可
  if (user.expireMode === UserConfig.PHOTOGRAPHER_EXPIRE_MODE.UNLIMITED) {
    return user;
  }

  const nowDate = new Date(); // 現在日時
  const fromDate = new Date(user.expireMode.from); // 利用期間開始日時
  // 利用期間開始前の場合はfalse
  if (nowDate < fromDate) {
    return undefined;
  }

  // 利用期間終了後の場合はfalse
  const toDate = new Date(user.expireMode.to);
  if (nowDate > toDate) {
    return undefined;
  }

  // 全て可の場合はOK
  return user;
};
