import {Setting as CommonSetting} from "../../../config";

export const Setting = {
  ...CommonSetting,
  TABLE_NAME_NANAPOCKE_USER: process.env.TABLE_NAME_NANAPOCKE_USER || "",
  STATUS: {
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
  },
};
