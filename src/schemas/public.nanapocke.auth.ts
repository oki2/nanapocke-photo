import * as v from "valibot";
import * as common from "./common";
import * as nanapocke from "./common.nanapocke";

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
export const NanapockeUserInfoResponse = v.object({
  nursery_cd: nanapocke.FacilityCode,
  user_cd: nanapocke.UserCode,
  role_cd: nanapocke.RoleCode,
  role: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.minLength(1)),
  belong: v.array(
    v.object({
      class_cd: nanapocke.ClassCode,
      class_name: v.pipe(v.string(), v.minLength(1)),
      grade_cd: nanapocke.GradeCode,
      grade_name: v.pipe(v.string(), v.minLength(1)),
    })
  ),
});
export type NanapockeUserInfoResponseT = v.InferOutput<
  typeof NanapockeUserInfoResponse
>;

export const IdTokenPayload = v.object({
  sub: v.pipe(v.string(), v.minLength(1)),
});
export type IdTokenPayloadT = v.InferOutput<typeof IdTokenPayload>;
