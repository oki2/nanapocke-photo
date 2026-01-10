import {defaults} from "./defaults";
import {env} from "./env";

export const AppConfig = {
  ...defaults,
  ...env,
};

export * as ApplicationConfig from "./Application";
export * as AlbumConfig from "./Model/Album";
export * as AuthConfig from "./Model/Auth";
export * as CartConfig from "./Model/Cart";
export * as FacilityConfig from "./Model/Facility";
export * as PaymentConfig from "./Model/Payment";
export * as PhotoConfig from "./Model/Photo";
export * as UserConfig from "./Model/User";
export * as TagConfig from "./Model/Tag";

export * as PriceConfig from "./Price";

export * as CognitoConfig from "./Cognito";
