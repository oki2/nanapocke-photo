export const TABLE_NAME = process.env.TABLE_NAME_ALBUM_CATALOG || "";
export const SALES_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHING: "PUBLISHING",
  PUBLISHED: "PUBLISHED",
  UNPUBLISHED: "UNPUBLISHED",
};

export const IMAGE_STATUS = {
  NONE: "NONE",
  PROCESSING: "PROCESSING", // 準備中
  VALID: "VALID", // 存在する＆有効
} as const;

// 表示可能なアルバムステータス
export const VIEW_STATUS = {
  PRINCIPAL: [
    SALES_STATUS.DRAFT,
    SALES_STATUS.PUBLISHING,
    SALES_STATUS.PUBLISHED,
    SALES_STATUS.UNPUBLISHED,
  ],
  TEACHER: [SALES_STATUS.DRAFT],
  GUARDIAN: [SALES_STATUS.PUBLISHED],
  PHOTOGRAPHER: [SALES_STATUS.DRAFT],
};

export const PRICE_TABLE = {
  BASIC: "BASIC",
  PREMIUM: "PREMIUM",
  SALE: "SALE",
};

export const MAX_PHOTO_COUNT = 150;

export const SALES_ACTION = {
  START: "START",
  END: "END",
};

export const DEFAULT_COVER_IMAGE = "/assets/images/album-cover.webp";
