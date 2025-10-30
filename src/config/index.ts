import {defaults} from "./defaults";
import {env} from "./env";

export const Setting = {
  ...defaults,
  ...env,
};
