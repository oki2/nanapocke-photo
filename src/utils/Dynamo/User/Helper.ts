import {Setting} from "./Setting";
import * as UserModel from "./Model";

export async function createPhotographer(
  userSub: string,
  userCode: string,
  userName: string,
  facilityCode: string,
  nbf: string,
  exp: string,
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
