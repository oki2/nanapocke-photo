import * as v from "valibot";

export const UserCode = v.pipe(v.string(), v.regex(/^[a-zA-Z0-9]{8}$/));

// export const Id = v.pipe(v.string(), v.minLength(1), v.maxLength(64));
// export const ISODateTime = v.pipe(v.string(), v.isoTimestamp());

export const Role = v.picklist(["Admin"]);

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
    userCode: UserCode,
    password: v.pipe(v.string(), v.minLength(8), v.maxLength(64)),
    userName: v.pipe(v.string(), v.minLength(1)),
    description: v.optional(v.pipe(v.string(), v.minLength(1))),
    nbf: v.optional(v.pipe(v.string(), v.isoTimestamp())),
    exp: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  })
);

export type PhotographerCreateBodyT = v.InferOutput<
  typeof PhotographerCreateBody
>;

export const PhotographerCreateResponse = v.pipe(
  v.object({
    userCode: UserCode,
    userName: v.pipe(v.string(), v.minLength(1)),
  })
);

export type PhotographerCreateResponseT = v.InferOutput<
  typeof PhotographerCreateResponse
>;
