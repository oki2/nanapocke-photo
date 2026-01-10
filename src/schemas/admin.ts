import * as v from "valibot";
import * as common from "./common";
import * as nanapocke from "./common.nanapocke";

export const Role = v.picklist(["Admin"]);
export const Status = v.picklist(["ACTIVE", "INACTIVE"]);

// api.admin.auth.signin : request
export const AuthSigninBody = v.pipe(
  v.object({
    userName: v.pipe(v.string(), v.minLength(1)),
    password: v.pipe(v.string(), v.minLength(1)),
  })
);
export type AuthSigninBodyT = v.InferOutput<typeof AuthSigninBody>;

// api.admin.auth.signin : response
// Signin Response Success
export const SigninSuccess = v.object({
  state: v.literal("success"),
  idToken: v.string(),
  accessToken: v.string(),
});

// Signin Response Challenge
export const SigninChallenge = v.object({
  state: v.literal("challenge"),
  challenge: v.string(),
  flowId: v.string(),
});

export const SigninResponse = v.variant("state", [
  SigninSuccess,
  SigninChallenge,
]);
export type SigninResponseT = v.InferOutput<typeof SigninResponse>;

// api.admin.auth.challenge : request
export const ChallengeBody = v.pipe(
  v.object({
    userName: common.Name,
    password: v.pipe(v.string(), v.minLength(1)),
    flowId: v.pipe(v.string(), v.minLength(1)),
  })
);

// api.admin.auth.challenge : response
export const ChallengeSuccess = v.object({
  ok: v.boolean(),
});
export type ChallengeSuccessT = v.InferOutput<typeof ChallengeSuccess>;

// api.admin.auth.refresh : request cookie
export const RefreshTokenCookie = v.object({
  refreshToken: v.pipe(v.pipe(v.string(), v.minLength(1))),
  //  role: Role,
});
export type RefreshTokenCookieT = v.InferOutput<typeof RefreshTokenCookie>;

// api.admin.facility.create : request
const FacilityClass = v.object({
  code: nanapocke.ClassCode,
  name: common.Name,
  grade: v.pipe(v.string(), v.regex(/^[0-9]{1}$/)),
});

export const FacilityCreateBody = v.pipe(
  v.object({
    code: nanapocke.FacilityCode,
    name: common.Name,
    nbf: common.ISODateTime,
    exp: common.ISODateTime,
    classList: v.array(FacilityClass),
  }),
  v.custom((input) => {
    const d = input as {nbf?: string; exp?: string};
    if (!d.nbf || !d.exp) return true;
    return new Date(d.nbf).getTime() <= new Date(d.exp).getTime();
  }, "nbf must be <= exp")
);
export type FacilityCreateBodyT = v.InferOutput<typeof FacilityCreateBody>;

// api.admin.facility.create : response
export const FacilityResponse = v.object({
  code: nanapocke.FacilityCode,
  name: common.Name,
  status: v.optional(Status),
  nbf: common.ISODateTime,
  exp: common.ISODateTime,
  classCount: v.optional(v.number()),
  createdAt: v.optional(common.ISODateTime),
  updatedAt: v.optional(common.ISODateTime),
});
export type FacilityResponseT = v.InferOutput<typeof FacilityResponse>;

// api.admin.facility.list : response
export const FacilityListResponse = v.array(FacilityResponse);
export type FacilityListResponseT = v.InferOutput<typeof FacilityListResponse>;

// api.admin.facility.code : request pathParameters
export const FacilityCodePathParams = v.object({
  code: nanapocke.FacilityCode,
});

// api.admin.facility.code : request
export const FacilityUpdateBody = v.pipe(
  v.object({
    name: v.optional(common.Name),
    nbf: v.optional(common.ISODateTime),
    exp: v.optional(common.ISODateTime),
    status: v.optional(Status),
  }),
  v.custom((input) => {
    const d = input as {nbf?: string; exp?: string};
    if (!d.nbf || !d.exp) return true;
    return new Date(d.nbf).getTime() <= new Date(d.exp).getTime();
  }, "nbf must be <= exp"),
  v.custom((input) => {
    const d = input as {
      name?: string;
      nbf?: string;
      exp?: string;
      status?: string;
    };
    return !!(d.name || d.nbf || d.exp || d.status);
  }, "At least one of name, nbf, exp or status is required")
);
