import {defaults} from "./defaults";
import {env} from "./env";

export const AppConfig = {
  ...defaults,
  ...env,
};
