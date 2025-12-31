import * as v from "valibot";
import * as common from "./common";
import * as nanapocke from "./common.nanapocke";

import {created} from "../http";
import {PhotoConfig} from "../config";
import {add} from "../utils/Dynamo/Cart";

// カートから写真削除時のパスパラメータ
export const CartPhotoDeletePathParameters = v.object({
  albumId: common.AlbumId,
  photoId: common.PhotoId,
});

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

// CHECKOUT 関連 =================================================
const ShippingAddress = v.object({
  name: v.string(),
  postalCode: v.pipe(v.string(), v.regex(/^\d{7}$/)),
  line: v.string(),
  phone: v.pipe(v.string(), v.regex(/^\d{10,11}$/)),
});

export const CheckoutDigtalOnly = v.object({
  type: v.picklist(["digital"]),
});

export const CheckoutShipping = v.object({
  type: v.picklist(["shipping"]),
  address: ShippingAddress,
});

export const CheckoutBody = v.variant("type", [
  CheckoutDigtalOnly,
  CheckoutShipping,
]);
export type CheckoutBodyT = v.InferOutput<typeof CheckoutBody>;

const OrderPrintLine = v.object({
  size: v.picklist([
    PhotoConfig.SALES_SIZE.PRINT_L,
    PhotoConfig.SALES_SIZE.PRINT_2L,
  ]),
  quantity: v.number(),
  subTotal: v.number(),
});

const OrderDownloadLine = v.object({
  size: v.literal(PhotoConfig.SALES_SIZE.DONWLOAD), // 常に 'dl'
  note: v.string(), // 例: "1920×1280"
  subTotal: v.number(),
  downloadUrl: v.optional(v.string()), // 履歴のみ
});

const OrderItemBase = v.object({
  albumId: v.string(),
  albumName: v.string(),
  imageId: v.string(),
  imageSrc: v.string(),
  priceTier: common.PhotoPriceTier,
  print: v.array(OrderPrintLine),
  download: v.array(OrderDownloadLine),
  // discounts: v.array(v.object({})),
  itemTotal: v.number(),
});

const ShippingInfo = v.object({
  method: v.string(),
  address: ShippingAddress,
});

const CurrentOrderSummary = v.object({
  shipping: v.optional(ShippingInfo),
  items: v.array(OrderItemBase),
  hasDownloadPurchases: v.boolean(), // DL購入を含むかどうか（ConfirmView のチェックボックス用）
  downloadPeriod: v.optional(v.string()), // DL有効期間（履歴側の downloadExpiry と意味は同じ）
  subTotal: v.number(), // 商品小計（割引前）
  // itemsDiscountTotal: v.number(), // 割引合計（負値。0 のときは UI で非表示にできる）
  shippingFee: v.object({
    after: v.number(),
    before: v.optional(v.number()),
    label: v.optional(v.string()),
  }),
  grandTotal: v.number(),
});

export const CurrentOrder = v.object({
  orderId: v.string(),
  summary: CurrentOrderSummary,
  paymentUrl: v.string(),
});
export type CurrentOrderT = v.InferOutput<typeof CurrentOrder>;
