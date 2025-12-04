import {AppConfig} from "../../../config";

export const Setting = {
  ...AppConfig,
  TABLE_NAME_NANAPOCKE_USER: process.env.TABLE_NAME_NANAPOCKE_USER || "",
  STATUS: {
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
  },
};
