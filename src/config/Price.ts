import * as AlbumConfig from "./Model/Album";
import * as PhotoConfig from "./Model/Photo";

export const PHOTO_PRICE = {
  // 通常価格
  [AlbumConfig.PRICE_TABLE.BASIC]: {
    [PhotoConfig.PRICE_TIER.STANDARD]: {
      [PhotoConfig.SALES_SIZE.DL_ORIGINAL]: 167,
      [PhotoConfig.SALES_SIZE.PRINT_L]: 110,
      [PhotoConfig.SALES_SIZE.PRINT_2L]: 235,
    },
    [PhotoConfig.PRICE_TIER.PREMIUM]: {
      [PhotoConfig.SALES_SIZE.DL_ORIGINAL]: 224,
      [PhotoConfig.SALES_SIZE.PRINT_L]: 169,
      [PhotoConfig.SALES_SIZE.PRINT_2L]: 451,
    },
  },
  // 再販価格
  [AlbumConfig.PRICE_TABLE.PREMIUM]: {
    [PhotoConfig.PRICE_TIER.STANDARD]: {
      [PhotoConfig.SALES_SIZE.DL_ORIGINAL]: 250,
      [PhotoConfig.SALES_SIZE.PRINT_L]: 165,
      [PhotoConfig.SALES_SIZE.PRINT_2L]: 352,
    },
    [PhotoConfig.PRICE_TIER.PREMIUM]: {
      [PhotoConfig.SALES_SIZE.DL_ORIGINAL]: 336,
      [PhotoConfig.SALES_SIZE.PRINT_L]: 253,
      [PhotoConfig.SALES_SIZE.PRINT_2L]: 676,
    },
  },
  // セール価格
  [AlbumConfig.PRICE_TABLE.SALE]: {
    [PhotoConfig.PRICE_TIER.STANDARD]: {
      [PhotoConfig.SALES_SIZE.DL_ORIGINAL]: 150,
      [PhotoConfig.SALES_SIZE.PRINT_L]: 99,
      [PhotoConfig.SALES_SIZE.PRINT_2L]: 211,
    },
    [PhotoConfig.PRICE_TIER.PREMIUM]: {
      [PhotoConfig.SALES_SIZE.DL_ORIGINAL]: 201,
      [PhotoConfig.SALES_SIZE.PRINT_L]: 152,
      [PhotoConfig.SALES_SIZE.PRINT_2L]: 405,
    },
  },
} as const;
