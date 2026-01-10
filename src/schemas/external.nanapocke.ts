import * as v from "valibot";
import * as common from "./common";
import * as nanapocke from "./common.nanapocke";
import {created} from "../http";
import {AlbumConfig} from "../config";

export const TRIGGER_ACTION = {
  ALBUM_PUBLISHED: "albumPublished",
};

// ナナポケの日付型の判定（独自フォーマットなので個別定義）
export const NanapockeDateFormat = v.pipe(
  v.string(),
  v.regex(
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    "YYYY-MM-DD HH:MM:SS 形式で入力してください"
  ),
  v.custom((value: any) => {
    // "2024-01-31 12:34:56" → "2024-01-31T12:34:56"
    const iso = value.replace(" ", "T") + "+09:00";
    const date = new Date(iso);
    return !isNaN(date.getTime());
  }, "存在しない日時です")
);

// アルバムの公開処理（ 通知登録API : [POST] /manage/api/v1/topics ）
const NanapockeTopicsV1Send = v.object({
  nurseryCd: nanapocke.FacilityCode,
  classReceivedList: v.array(nanapocke.ClassCode),
  childrenList: v.array(nanapocke.UserCode),
  academicYear: v.optional(v.number()),
  noticeTitle: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  mailFlag: v.literal(true),
  noticeSendTime: v.optional(NanapockeDateFormat),
  publicPeriod: v.optional(NanapockeDateFormat),
});
export type NanapockeTopicsV1SendT = v.InferOutput<
  typeof NanapockeTopicsV1Send
>;

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
