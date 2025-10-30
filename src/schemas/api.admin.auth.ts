import * as v from "valibot";

// export const Id = v.pipe(v.string(), v.minLength(1), v.maxLength(64));
// export const ISODateTime = v.pipe(v.string(), v.isoTimestamp());

export const Role = v.picklist(["Admin"]);

// Signin Request body
export const AuthSigninBody = v.pipe(
  v.object({
    userName: v.pipe(v.string(), v.minLength(1)),
    password: v.pipe(v.string(), v.minLength(1)),
  })
);

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

// Signin Response 判別共用体（state が判別キー）
export const SigninResponse = v.variant("state", [
  SigninSuccess,
  SigninChallenge,
]);

// Challenge Request body
export const ChallengeBody = v.pipe(
  v.object({
    userName: v.pipe(v.string(), v.minLength(1)),
    password: v.pipe(v.string(), v.minLength(1)),
    flowId: v.pipe(v.string(), v.minLength(1)),
  })
);

// Signin Response Success
export const ChallengeSuccess = v.object({
  ok: v.boolean(),
});

export const RefreshTokenCookie = v.object({
  refreshToken: v.pipe(v.pipe(v.string(), v.minLength(1))),
  //  role: Role,
});

export type AuthSigninBodyT = v.InferOutput<typeof AuthSigninBody>;
// export type SigninSuccessT = v.InferOutput<typeof SigninSuccess>;
// export type SigninChallengeT = v.InferOutput<typeof SigninChallenge>;
export type SigninResponseT = v.InferOutput<typeof SigninResponse>;

export type ChallengeSuccessT = v.InferOutput<typeof ChallengeSuccess>;

export type RefreshTokenCookieT = v.InferOutput<typeof RefreshTokenCookie>;
