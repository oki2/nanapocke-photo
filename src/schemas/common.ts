import * as v from "valibot";
import {Setting} from "../config";

// 日付型の指定 ISO世界標準時刻
export const ISODateTime = v.pipe(v.string(), v.isoTimestamp());

// Admin 以外のロール
export const PublicRole = v.picklist([
  // "Admin",
  Setting.ROLE.PRINCIPAL,
  Setting.ROLE.TEACHER,
  Setting.ROLE.GUARDIAN,
  Setting.ROLE.PHOTOGRAPHER,
]);

// フォトグラファーのアカウントNameの長さを固定で（小文字 + 数字の8文字固定長）
export const AccountPhotographerId = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9]{8}$/)
);

// パスワードの長さ指定
export const AccountPassword = v.pipe(
  v.string(),
  v.minLength(8),
  v.maxLength(64)
);
