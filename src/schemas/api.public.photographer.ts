import * as v from "valibot";
import * as common from "./common";

// Signin Request body
export const AuthSigninBody = v.pipe(
  v.object({
    facilityCode: v.pipe(v.string(), v.length(5)),
    userName: v.pipe(v.string(), v.minLength(1)),
    password: v.pipe(v.string(), v.minLength(1)),
  })
);

// Signin Response Success
export const SigninSuccess = v.object({
  idToken: v.string(),
  accessToken: v.string(),
});

export type AuthSigninBodyT = v.InferOutput<typeof AuthSigninBody>;
export type SigninSuccessT = v.InferOutput<typeof SigninSuccess>;

export const PhotographerCreateBody = v.pipe(
  v.object({
    userCode: common.AccountPhotographerId,
    password: common.AccountPassword,
    userName: v.pipe(v.string(), v.minLength(1)),
    description: v.optional(v.pipe(v.string(), v.minLength(1))),
    nbf: v.optional(common.ISODateTime),
    exp: v.optional(common.ISODateTime),
  })
);

export type PhotographerCreateBodyT = v.InferOutput<
  typeof PhotographerCreateBody
>;

export const PhotographerCreateResponse = v.pipe(
  v.object({
    userCode: common.AccountPhotographerId,
    userName: v.pipe(v.string(), v.minLength(1)),
  })
);

export type PhotographerCreateResponseT = v.InferOutput<
  typeof PhotographerCreateResponse
>;
