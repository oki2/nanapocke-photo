import * as v from "valibot";

// ナナポケ認証後のコード
export const Code = v.pipe(v.string(), v.minLength(1));
export const CodeQueryParams = v.object({
  code: Code,
});
export type CodeQueryParamsT = v.InferOutput<typeof CodeQueryParams>;

// ナナポケ　アクセストークン発行レスポンス
export const NanapockeAccessTokenResponse = v.object({
  access_token: v.string(),
  token_type: v.string(),
  expires_in: v.number(),
  scope: v.string(),
  refresh_token: v.string(),
});
export type NanapockeAccessTokenResponseT = v.InferOutput<
  typeof NanapockeAccessTokenResponse
>;

// ナナポケ　ユーザー情報
const Belong = v.object({
  class_cd: v.pipe(v.string(), v.length(7)),
  class_name: v.pipe(v.string(), v.minLength(1)),
  grade_cd: v.number(),
  grade_name: v.pipe(v.string(), v.minLength(1)),
});
export const NanapockeUserInfoResponse = v.object({
  nursery_cd: v.pipe(v.string(), v.length(5)),
  user_cd: v.pipe(v.string(), v.length(11)),
  role_cd: v.number(),
  role: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.minLength(1)),
  belong: v.array(Belong),
});
export type NanapockeUserInfoResponseT = v.InferOutput<
  typeof NanapockeUserInfoResponse
>;

export const IdTokenPayload = v.object({
  sub: v.pipe(v.string(), v.minLength(1)),
});
export type IdTokenPayloadT = v.InferOutput<typeof IdTokenPayload>;
