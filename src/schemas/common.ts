import * as v from "valibot";
import {AppConfig, UserConfig, PhotoConfig} from "../config";
import {FacilityCode} from "./common.nanapocke";

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

export const AccessToken = v.pipe(v.string(), v.minLength(1));
export const RefreshToken = v.pipe(v.string(), v.minLength(1));

const uuidV4 = v.pipe(v.string(), v.uuid());
const uuidV7 = v.pipe(
  v.string(),
  v.regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  )
);

export const UserId = v.pipe(v.string(), v.minLength(1));
export const AlbumId = uuidV4;
export const PhotoId = uuidV4;
export const OrderId = v.string();
export const Name = v.pipe(v.string(), v.minLength(1));

export const Url = v.pipe(v.string());

// 写真タイプ
export const PhotoPriceTier = v.picklist(Object.values(PhotoConfig.PRICE_TIER));

export const DLSize = v.picklist(Object.values(PhotoConfig.SALES_SIZE));
export const SalesSizeDl = v.object({
  size: DLSize,
  price: v.number(),
});

export const PrintSize = v.picklist([
  PhotoConfig.SALES_SIZE.PRINT_L,
  PhotoConfig.SALES_SIZE.PRINT_2L,
]);
export const SalesSizePrint = v.object({
  size: PrintSize,
  price: v.number(),
});
