import {Setting} from "./Setting";
import * as FacilityModel from "./Model";

export const isActive = async (code: string): Promise<boolean> => {
  const facility = await FacilityModel.get(code);
  const nbfDate = new Date(facility?.nbf);
  const expDate = new Date(facility?.exp);
  const nowDate = new Date();

  if (nowDate < nbfDate || nowDate > expDate) {
    return false;
  }

  return facility?.status === Setting.STATUS.ACTIVE;
};
