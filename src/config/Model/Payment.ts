export const TABLE_NAME = process.env.TABLE_NAME_MAIN || "";
export const ORDER_ID_PREFIX = process.env.ORDER_ID_PREFIX || "XXXX";
export const STATUS = {
  CREATED: "CREATED", // 決済履歴作成済み（未決済）
  COMPLETED: "COMPLETED", // 決済完了
  FAILED_CUSTOMER: "FAILED_CUSTOMER", // お客様都合エラー
  FAILED_EXPIRED: "FAILED_EXPIRED", // 有効期限切れ（即時）
  FAILED_EXPIRED_BATCH: "FAILED_EXPIRED_BATCH", // 有効期限切れ（バッチ判定）
  FAILED_SYSTEM: "FAILED_SYSTEM", // 運営・システム都合
  FAILED_ERROR: "FAILED_ERROR", // SMBC側のエラー
  FAILED_UNKNOWN: "FAILED_UNKNOWN", // 未知のエラー
};

export const ORDER_TYPE = {
  DIGITAL: "digital",
  SHIPPING: "shipping",
};

export const SHIPPING_POSTAGE_MAIL_FEE = 101; // ゆうメール送料
export const POSTAGE_MAIL_LIMIT = 200; // ゆうメール 1配送辺りの上限枚数

export const PHOTO_DOWNLOAD_EXPIRES_DAYS = 60; // Download の有効期限：60日;
