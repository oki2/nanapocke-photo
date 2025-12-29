import {defaults} from "./defaults";
import {env} from "./env";

export const AppConfig = {
  ...defaults,
  ...env,
};

export * as AlbumConfig from "./Model/Album";
export * as AuthConfig from "./Model/Auth";
export * as FacilityConfig from "./Model/Facility";
export * as PhotoConfig from "./Model/Photo";
export * as UserConfig from "./Model/User";
export * as TagConfig from "./Model/Tag";

export * as PriceConfig from "./Price";

export * as CognitoConfig from "./Cognito";
