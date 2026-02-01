import * as AlbumConfig from "./Model/Album";
import * as PhotoConfig from "./Model/Photo";

export const PHOTO_PRICE = {
  [AlbumConfig.PRICE_TABLE.BASIC]: {
    [PhotoConfig.PRICE_TIER.STANDARD]: {
      [PhotoConfig.SALES_SIZE.DL_ORIGINAL]: 101,
      [PhotoConfig.SALES_SIZE.PRINT_L]: 102,
      [PhotoConfig.SALES_SIZE.PRINT_2L]: 103,
    },
    [PhotoConfig.PRICE_TIER.PREMIUM]: {
      [PhotoConfig.SALES_SIZE.DL_ORIGINAL]: 201,
      [PhotoConfig.SALES_SIZE.PRINT_L]: 202,
      [PhotoConfig.SALES_SIZE.PRINT_2L]: 203,
    },
  },
  [AlbumConfig.PRICE_TABLE.PREMIUM]: {
    [PhotoConfig.PRICE_TIER.STANDARD]: {
      [PhotoConfig.SALES_SIZE.DL_ORIGINAL]: 301,
      [PhotoConfig.SALES_SIZE.PRINT_L]: 302,
      [PhotoConfig.SALES_SIZE.PRINT_2L]: 303,
    },
    [PhotoConfig.PRICE_TIER.PREMIUM]: {
      [PhotoConfig.SALES_SIZE.DL_ORIGINAL]: 401,
      [PhotoConfig.SALES_SIZE.PRINT_L]: 402,
      [PhotoConfig.SALES_SIZE.PRINT_2L]: 403,
    },
  },
  [AlbumConfig.PRICE_TABLE.SALE]: {
    [PhotoConfig.PRICE_TIER.STANDARD]: {
      [PhotoConfig.SALES_SIZE.DL_ORIGINAL]: 501,
      [PhotoConfig.SALES_SIZE.PRINT_L]: 502,
      [PhotoConfig.SALES_SIZE.PRINT_2L]: 503,
    },
    [PhotoConfig.PRICE_TIER.PREMIUM]: {
      [PhotoConfig.SALES_SIZE.DL_ORIGINAL]: 601,
      [PhotoConfig.SALES_SIZE.PRINT_L]: 602,
      [PhotoConfig.SALES_SIZE.PRINT_2L]: 603,
    },
  },
};
