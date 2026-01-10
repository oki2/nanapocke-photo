import {FacilityConfig} from "../../../config";
import * as FacilityModel from "./Model";

export const isActive = async (code: string): Promise<any> => {
  const facility = await FacilityModel.get(code);
  const nbfDate = new Date(facility?.nbf);
  const expDate = new Date(facility?.exp);
  const nowDate = new Date();

  if (nowDate < nbfDate || nowDate > expDate) {
    return undefined;
  }

  return facility?.status === FacilityConfig.STATUS.ACTIVE
    ? facility
    : undefined;
};
