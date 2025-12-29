import * as v from "valibot";
import {AppConfig, UserConfig, PhotoConfig} from "../config";

// 日付型の指定 ISO世界標準時刻
export const ISODateTime = v.pipe(v.string(), v.isoTimestamp());

// Admin 以外のロール
export const PublicRole = v.picklist([
  // "Admin",
  UserConfig.ROLE.PRINCIPAL,
  UserConfig.ROLE.TEACHER,
  UserConfig.ROLE.GUARDIAN,
  UserConfig.ROLE.PHOTOGRAPHER,
]);

// フォトグラファーのアカウントNameの長さを固定で（小文字 + 数字の8文字固定長）
export const AccountPhotographerId = v.pipe(
  v.string(),
  v.regex(/^[a-zA-Z0-9]{8}$/)
);

// パスワードの長さ指定
export const AccountPassword = v.pipe(
  v.string(),
  v.minLength(8),
  v.maxLength(64)
);

// 写真アップロード形式。画像 or zip
export const PhotoUploadFileType = v.picklist(
  Object.values(AppConfig.UPLOAD_FILE_TYPE)
);

const uuidV4 = v.pipe(v.string(), v.uuid());
const uuidV7 = v.pipe(
  v.string(),
  v.regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  )
);

export const AlbumId = uuidV4;
export const PhotoId = uuidV4;

export const ResultOK = v.object({
  ok: v.literal(true),
});
