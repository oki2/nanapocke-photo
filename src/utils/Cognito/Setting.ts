import {Setting as CommonSetting} from "../../config";

export const Setting = {
  ...CommonSetting,
  SigninResults: {
    Success: "SUCCESS",
    Failure: "FAILURE",
    Challenge: "NEW_PASSWORD_REQUIRED",
  },
};
