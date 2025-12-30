import * as v from "valibot";
import * as common from "./common";
import * as nanapocke from "./common.nanapocke";
import {created} from "../http";
import {PhotoConfig} from "../config";

// カート登録時のリクエストボディ
export const CartAddBody = v.object({
  albumId: common.AlbumId,
  photoId: common.PhotoId,
});
export type CartAddBodyT = v.InferOutput<typeof CartAddBody>;

// カート内商品編集時
const CartPrintChangeBase = v.object({
  size: v.picklist([
    PhotoConfig.SALES_SIZE.PRINT_L,
    PhotoConfig.SALES_SIZE.PRINT_2L,
  ]),
  quantity: v.number(),
});
const CartDownloadChangeBase = v.object({
  size: v.picklist([PhotoConfig.SALES_SIZE.DONWLOAD]),
  selected: v.boolean(),
});
const CartEdit = v.object({
  albumId: common.AlbumId,
  photoId: common.PhotoId,
  print: v.optional(v.array(CartPrintChangeBase)),
  download: v.optional(v.array(CartDownloadChangeBase)),
});
export type CartEditT = v.InferOutput<typeof CartEdit>;

export const CartEditBody = v.array(CartEdit);
export type CartEditBodyT = v.InferOutput<typeof CartEditBody>;

// カート内商品取得 ===========================
const CartPrintOption = v.object({
  size: v.picklist([
    PhotoConfig.SALES_SIZE.PRINT_L,
    PhotoConfig.SALES_SIZE.PRINT_2L,
  ]),
  purchasable: v.boolean(),
  unitPrice: v.optional(v.number()),
  quantity: v.optional(v.number()),
});

const CartDownloadOption = v.object({
  // size: v.picklist([PhotoConfig.SALES_SIZE.DONWLOAD]),
  purchasable: v.boolean(),
  note: v.string(),
  unitPrice: v.optional(v.number()),
  selected: v.optional(v.boolean()),
  downloadable: v.optional(v.boolean()),
  purchasedAt: v.optional(common.ISODateTime),
});

export const CartItem = v.object({
  albumId: common.AlbumId,
  photoId: common.PhotoId,
  albumTitle: v.string(),
  albumSequenceId: v.number(),
  photoSequenceId: v.number(),
  priceTier: v.picklist(Object.values(PhotoConfig.PRICE_TIER)),
  purchaseDeadline: common.ISODateTime,
  print: v.array(CartPrintOption),
  download: v.array(CartDownloadOption),
});
export const CartItemList = v.array(CartItem);
export type CartItemListT = v.InferOutput<typeof CartItemList>;
