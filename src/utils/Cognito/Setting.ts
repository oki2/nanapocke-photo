import {AppConfig} from "../../config";

export const Setting = {
  ...AppConfig,
  SigninResults: {
    Success: "SUCCESS",
    Failure: "FAILURE",
    Challenge: "NEW_PASSWORD_REQUIRED",
  },
};
