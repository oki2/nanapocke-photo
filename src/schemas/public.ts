import * as v from "valibot";
import {
  AppConfig,
  UserConfig,
  PhotoConfig,
  AlbumConfig,
  PaymentConfig,
} from "../config";
import * as common from "./common";
import * as nanapocke from "./common.nanapocke";

// 共通 ==========================================================================

// アルバム販売テーブル
export const PriceTable = v.picklist(Object.values(AlbumConfig.PRICE_TABLE));

// アルバムの販売期間
export const SalesPeriod = v.pipe(
  v.object({
    start: v.union([common.ISODateTime, v.literal("")]),
    end: v.union([common.ISODateTime, v.literal("")]),
  }),
  v.check(({start, end}) => {
    // どちらかが未入力（空文字）の場合は OK
    if (start === "" || end === "") {
      return true;
    }
    return new Date(end).getTime() > new Date(start).getTime();
  }, "end は start より後の日時を指定してください"),
);
export type SalesPeriodT = v.InferOutput<typeof SalesPeriod>;

export const PhotoDetail = v.object({
  photoId: common.PhotoId,
  sequenceId: v.number(),
  imageUrl: common.Url,
  downloadUrl: v.optional(common.Url),
  priceTier: common.PhotoPriceTier,
  shootingAt: common.ISODateTime,
  width: v.number(),
  height: v.number(),
  salesSizeDl: v.array(common.SalesSizeDl),
  salesSizePrint: v.array(common.SalesSizePrint),
});

// アルバム販売開始・停止のナナポケ通知送信
const SalesTopicsSend = v.object({
  send: v.literal(true),
  classReceivedList: v.array(nanapocke.ClassCode),
  academicYear: nanapocke.AcademicYear,
});

const SalesTopicsNotSend = v.object({
  send: v.literal(false),
});

export const AlbumSalesStart = v.pipe(
  v.object({
    action: v.literal(AlbumConfig.SALES_ACTION.START),
    topics: v.variant("send", [SalesTopicsSend, SalesTopicsNotSend]),
    // topics: v.object({
    //   send: v.boolean(),
    //   classReceivedList: v.array(nanapocke.ClassCode),
    //   academicYear: nanapocke.AcademicYear,
    // }),
  }),
);

export const AlbumSalesStop = v.pipe(
  v.object({
    action: v.literal(AlbumConfig.SALES_ACTION.STOP),
  }),
);

/**
 * API別 =========================================================================
 */

export const ResultOK = v.object({
  ok: v.literal(true),
});

// api.public.auth.refresh : request cookie
export const RefreshTokenCookie = v.object({
  refreshToken: common.RefreshToken,
  userRole: common.PublicRole,
});
export type RefreshTokenCookieT = v.InferOutput<typeof RefreshTokenCookie>;

// api.public.auth.refresh : response
export const SigninSuccess = v.object({
  state: v.literal("success"),
  accessToken: v.string(),
  userName: v.string(),
  facilityCode: nanapocke.FacilityCode,
  facilityName: v.string(),
  userRole: common.PublicRole,
});

// Signin Response Challenge
export const SigninChallenge = v.object({
  state: v.literal("challenge"),
  challenge: v.string(),
  flowId: v.string(),
});

// Signin Response 判別共用体（state が判別キー）
export const SigninResponse = v.variant("state", [
  SigninSuccess,
  SigninChallenge,
]);
export type SigninResponseT = v.InferOutput<typeof SigninResponse>;
export type SigninSuccessT = v.InferOutput<typeof SigninSuccess>;
export type SigninChallengeT = v.InferOutput<typeof SigninChallenge>;

// api.public.auth.signin : request
export const AuthSigninBody = v.pipe(
  v.object({
    facilityCode: nanapocke.FacilityCode,
    userCode: common.Name,
    password: v.pipe(v.string(), v.minLength(1)),
  }),
);
export type AuthSigninBodyT = v.InferOutput<typeof AuthSigninBody>;

export const IdTokenPayload = v.object({
  sub: v.pipe(v.string(), v.minLength(1)),
});
export type IdTokenPayloadT = v.InferOutput<typeof IdTokenPayload>;

// api.public.album.create : request
export const AlbumCreateBody = v.pipe(
  v.object({
    title: v.pipe(v.string(), v.minLength(1)),
    description: v.optional(v.string(), ""),
    priceTable: PriceTable,
    salesPeriod: v.optional(SalesPeriod, {
      start: "",
      end: "",
    }),
    coverImageFileName: v.optional(v.string(), ""),
    copyFromAlbumId: v.optional(v.union([common.AlbumId, v.literal("")]), ""),
  }),
);
export type AlbumCreateBodyT = v.InferOutput<typeof AlbumCreateBody>;

// api.public.album.create : response
export const AlbumCreateResponse = v.pipe(
  v.object({
    albumId: common.AlbumId,
    title: v.pipe(v.string(), v.minLength(1)),
    url: v.optional(common.Url),
  }),
);
export type AlbumCreateResponseT = v.InferOutput<typeof AlbumCreateResponse>;

// api.public.album.list : response
export const AlbumItem = v.object({
  albumId: common.AlbumId,
  sequenceId: v.number(),
  title: v.pipe(v.string(), v.minLength(1)),
  description: v.string(),
  salesStatus: v.picklist(Object.values(AlbumConfig.SALES_STATUS)),
  priceTable: PriceTable,
  photoCount: v.optional(v.number()),
  cover: v.object({
    imageStatus: v.picklist(Object.values(AlbumConfig.IMAGE_STATUS)),
    imageUrl: v.optional(common.Url, ""),
  }),
  salesPeriod: v.optional(SalesPeriod, {
    start: "",
    end: "",
  }),
});
export type AlbumItemT = v.InferOutput<typeof AlbumItem>;

export const AlbumListResponse = v.array(AlbumItem);
export type AlbumListResponseT = v.InferOutput<typeof AlbumListResponse>;

// api.public.album.photo.list : pathParameters
export const AlbumPathParameters = v.pipe(
  v.object({
    facilityCode: nanapocke.FacilityCode,
    albumId: common.AlbumId,
  }),
);

// api.public.album.photo.list : response
export const AlbumPhotoListResponse = v.object({
  album: AlbumItem,
  photos: v.array(PhotoDetail),
});

// api.public.album.sales : request
// Signin Response 判別共用体（state が判別キー）
export const AlbumSalesBody = v.variant("action", [
  AlbumSalesStart,
  AlbumSalesStop,
]);

// api.public.album.update : request
export const AlbumEditBody = v.pipe(
  v.object({
    title: v.pipe(v.string(), v.minLength(1)),
    description: v.optional(v.pipe(v.string(), v.minLength(1))),
    priceTable: PriceTable,
    salesPeriod: SalesPeriod,
    coverImageFileName: v.optional(v.pipe(v.string(), v.minLength(1))),
  }),
);
export type AlbumEditBodyT = v.InferOutput<typeof AlbumEditBody>;

// api.public.album.update : response
export const AlbumEditResponse = v.object({
  ok: v.literal(true),
  url: v.optional(common.Url),
});
export type AlbumEditResponseT = v.InferOutput<typeof AlbumEditResponse>;

// api.public.photo.upload : request
export const PhotoUploadBody = v.pipe(
  v.object({
    shootingAt: common.ISODateTime,
    priceTier: v.optional(common.PhotoPriceTier),
    tags: v.optional(v.string(), ""),
    albums: v.optional(v.array(common.AlbumId), []),
    fileType: common.PhotoUploadFileType,
    fileName: v.pipe(v.string(), v.minLength(1)),
  }),
);
export type PhotoUploadBodyT = v.InferOutput<typeof PhotoUploadBody>;

// api.public.photo.upload : response
export const PhotoUploadResponse = v.pipe(
  v.object({
    url: v.pipe(v.string(), v.minLength(1)),
  }),
);
export type PhotoUploadResponseT = v.InferOutput<typeof PhotoUploadResponse>;

// api.public.photo.list : request query
export const FilterAlbum = v.picklist(["ALL", "UNSET"]);
export const FilterDateType = v.picklist(Object.values(PhotoConfig.DATE_TYPE));
export const FilterEditability = v.picklist(
  Object.values(PhotoConfig.EDITABILITY),
);
export const FilterPhotoPriceTier = v.picklist(
  Object.values(PhotoConfig.PRICE_TIER),
);

const PhotoFilter = v.object({
  albumId: v.union([FilterAlbum, common.AlbumId]),
  photographer: v.optional(v.string(), ""),
  tags: v.optional(v.string(), ""),
  // photoIdQuery: v.optional(v.string(), ""),  // sequenceId に置き換え
  sequenceIds: v.optional(v.string(), ""),
  dateType: v.optional(v.union([FilterDateType, v.literal("")]), ""),
  dateFrom: v.optional(v.union([common.ISODateTime, v.literal("")]), ""),
  dateTo: v.optional(v.union([common.ISODateTime, v.literal("")]), ""),
});
const PhotoSort = v.object({
  sortKey: v.optional(
    v.picklist(Object.values(PhotoConfig.SORT_KEY)),
    PhotoConfig.SORT_KEY.UPLOAD,
  ),
  sortOrder: v.optional(
    v.picklist(Object.values(PhotoConfig.SORT_ORDER)),
    PhotoConfig.SORT_ORDER.DESC,
  ),
});

export const PhotoSelectMy = v.object({
  cursor: v.optional(v.string(), ""),
});

export const PhotoSelect = v.object({
  ...PhotoFilter.entries,
  ...PhotoSort.entries,
  limit: v.pipe(
    v.string(),
    v.regex(/^\d+$/, "数値のみを指定してください"),
    v.transform(Number),
    v.number(),
    v.minValue(
      PhotoConfig.FILTER_LIMIT.MIN,
      `${PhotoConfig.FILTER_LIMIT.MIN}以上を指定してください`,
    ),
    v.maxValue(
      PhotoConfig.FILTER_LIMIT.MAX,
      `${PhotoConfig.FILTER_LIMIT.MAX}以下を指定してください`,
    ),
  ),
  cursor: v.optional(v.string()),
});
export type PhotoSelectT = v.InferOutput<typeof PhotoSelect>;

// api.public.photo.list : response
export const PhotoListResponse = v.object({
  photos: v.array(
    v.pipe(
      v.object({
        facilityCode: nanapocke.FacilityCode,
        photoId: common.AlbumId,
        sequenceId: v.number(),
        photoImageUrl: v.pipe(v.string(), v.minLength(1)),
        size: v.optional(v.string(), ""),
        printSizes: v.array(v.string()),
        status: v.pipe(v.string(), v.minLength(1)),
        saleStatus: v.picklist(Object.values(PhotoConfig.SALES_STATUS)),
        tags: v.optional(v.array(v.string()), []),
        albums: v.optional(v.array(common.AlbumId), []),
        priceTier: common.PhotoPriceTier,
        shootingAt: common.ISODateTime,
        shootingUserName: common.Name,
        createdAt: common.ISODateTime,
      }),
    ),
  ),
  totalItems: v.number(),
  nextCursor: v.string(),
});
export type PhotoListResponseT = v.InferOutput<typeof PhotoListResponse>;

// api.public.photo.edit : pathParameters
export const PhotoPathParameters = v.pipe(
  v.object({
    facilityCode: nanapocke.FacilityCode,
    photoId: common.PhotoId,
  }),
);

// api.public.photo.edit : request
export const PhotoEditBody = v.pipe(
  v.object({
    album: v.object({
      mode: v.picklist(["CHANGE"]),
      albums: v.array(v.pipe(v.string(), v.minLength(1))),
    }),
  }),
);

// api.public.photo.join.album : pathParameters
export const FacilityCodePathParameters = v.pipe(
  v.object({
    facilityCode: nanapocke.FacilityCode,
  }),
);

// api.public.photo.join.album : requestBody
const PhotoJoinScopeModeChecked = v.object({
  mode: v.literal(PhotoConfig.PHOTO_JOIN_SCOPE.CHECKED),
  selectedIds: v.array(common.PhotoId),
});
const PhotoJoinScopeModeFilter = v.object({
  mode: v.literal(PhotoConfig.PHOTO_JOIN_SCOPE.FILTER),
  filters: PhotoFilter,
});
const PhotoJoinScopeMode = v.variant("mode", [
  PhotoJoinScopeModeChecked,
  PhotoJoinScopeModeFilter,
]);

const PhotoJoinAlbumModeAdd = v.object({
  mode: v.picklist([
    PhotoConfig.PHOTO_JOIN_ALBUM.ADD,
    PhotoConfig.PHOTO_JOIN_ALBUM.REMOVE,
    PhotoConfig.PHOTO_JOIN_ALBUM.SET,
  ]),
  albums: v.array(common.AlbumId),
});
const PhotoJoinAlbumModeReplace = v.object({
  mode: v.literal(PhotoConfig.PHOTO_JOIN_ALBUM.REPLACE),
  from: common.AlbumId,
  to: common.AlbumId,
});
const PhotoJoinAlbumMode = v.variant("mode", [
  PhotoJoinAlbumModeAdd,
  PhotoJoinAlbumModeReplace,
]);

export const PhotoJoinAlbumBody = v.object({
  scope: PhotoJoinScopeMode,
  album: PhotoJoinAlbumMode,
});

// api.public.meta.list : response
const MetaAlbum = v.object({
  albumId: common.AlbumId,
  sequenceId: v.number(),
  title: v.pipe(v.string(), v.minLength(1)),
  salesStatus: v.picklist(Object.values(AlbumConfig.SALES_STATUS)),
});
const MetaStaff = v.object({
  userId: common.UserId,
  userName: common.Name,
});
const MetaClass = v.object({
  classCode: nanapocke.ClassCode,
  className: nanapocke.ClassName,
});
export const MetaListResponse = v.object({
  tags: v.optional(v.array(v.string()), []),
  albums: v.optional(v.array(MetaAlbum), []),
  staff: v.optional(v.array(MetaStaff)),
  classList: v.optional(v.array(MetaClass)),
  academicYear: v.optional(v.array(nanapocke.AcademicYear)),
});
export type MetaListResponseT = v.InferOutput<typeof MetaListResponse>;

// api.public.photographer.create : request
const PhotographerExpireUnlimited = v.object({
  mode: v.literal(UserConfig.EXPIRE_MODE.UNLIMITED),
  from: v.literal(""),
  to: v.literal(""),
});

const PhotographerExpireDate = v.pipe(
  v.object({
    mode: v.literal(UserConfig.EXPIRE_MODE.DATE),
    from: common.ISODateTime,
    to: common.ISODateTime,
  }),
  v.check(({from, to}) => {
    return new Date(to).getTime() > new Date(from).getTime();
  }, "to は from より後の日時を指定してください"),
);

export const PhotographerCreateBody = v.object({
  userCode: common.AccountPhotographerId,
  password: common.AccountPassword,
  userName: v.pipe(v.string(), v.minLength(1)),
  description: v.optional(v.pipe(v.string()), ""),
  expire: v.variant("mode", [
    PhotographerExpireUnlimited,
    PhotographerExpireDate,
  ]),
});
export type PhotographerCreateBodyT = v.InferOutput<
  typeof PhotographerCreateBody
>;

// api.public.photographer.create : response
export const PhotographerCreateResponse = v.pipe(
  v.object({
    userCode: common.AccountPhotographerId,
    userName: v.pipe(v.string(), v.minLength(1)),
  }),
);

export type PhotographerCreateResponseT = v.InferOutput<
  typeof PhotographerCreateResponse
>;

// api.public.photographer.list : response
const PhotographerDetail = v.pipe(
  v.object({
    userId: common.UserId,
    userCode: common.AccountPhotographerId,
    userName: v.pipe(v.string(), v.minLength(1)),
    status: v.picklist(Object.values(UserConfig.STATUS)),
    lastLoginAt: v.optional(v.union([common.ISODateTime, v.literal("")]), ""),
    description: v.optional(v.pipe(v.string()), ""),
    expire: v.object({
      mode: v.picklist(Object.values(UserConfig.EXPIRE_MODE)),
      from: v.union([common.ISODateTime, v.literal("")]),
      to: v.union([common.ISODateTime, v.literal("")]),
    }),
  }),
);
export const PhotographerList = v.array(PhotographerDetail);
export type PhotographerListT = v.InferOutput<typeof PhotographerList>;

// api.public.photographer.edit : request pathParameters
export const PhotographerPathParameters = v.pipe(
  v.object({
    facilityCode: nanapocke.FacilityCode,
    photographerId: common.UserId,
  }),
);

// api.public.photographer.edit : request body
export const PhotographerEditBody = v.pipe(
  v.object({
    changePassword: v.boolean(),
    password: v.optional(common.AccountPassword),
    expire: v.variant("mode", [
      PhotographerExpireUnlimited,
      PhotographerExpireDate,
    ]),
  }),
  v.check(({changePassword, password}) => {
    if (changePassword && !password) {
      return false;
    }
    return true;
  }, "password を入力してください"),
);

// api.public.cart.add : request
export const CartAddBody = v.object({
  albumId: common.AlbumId,
  photoId: common.PhotoId,
});
export type CartAddBodyT = v.InferOutput<typeof CartAddBody>;

// api.public.cart.list : response
const CartPrintOption = v.object({
  size: common.PrintSize,
  purchasable: v.boolean(),
  unitPrice: v.optional(v.number()),
  quantity: v.optional(v.number()),
});

const CartDownloadOption = v.object({
  size: common.DownloadSize,
  purchasable: v.boolean(),
  unitPrice: v.optional(v.number()),
  selected: v.optional(v.boolean()),
  downloadable: v.optional(v.boolean(), false),
  purchasedAt: v.optional(v.union([common.ISODateTime, v.literal("")]), ""),
  width: v.optional(v.number(), 0),
  height: v.optional(v.number(), 0),
  // note: v.string(),
});

export const CartItem = v.object({
  albumId: common.AlbumId,
  photoId: common.PhotoId,
  albumTitle: v.string(),
  albumSequenceId: v.number(),
  photoSequenceId: v.number(),
  imageUrl: common.Url,
  priceTier: common.PhotoPriceTier,
  purchaseDeadline: common.ISODateTime,
  print: v.array(CartPrintOption),
  download: v.array(CartDownloadOption),
});
export const CartItemList = v.object({
  photos: v.array(CartItem),
  downloadExpiry: common.ISODateTime,
});
export type CartItemListT = v.InferOutput<typeof CartItemList>;

// api.public.cart.edit : request
const CartPrintChangeBase = v.object({
  size: v.picklist([
    PhotoConfig.SALES_SIZE.PRINT_L,
    PhotoConfig.SALES_SIZE.PRINT_2L,
  ]),
  quantity: v.number(),
});
const CartDownloadChangeBase = v.object({
  size: v.picklist([PhotoConfig.SALES_SIZE.DL_ORIGINAL]),
  selected: v.boolean(),
});
const CartEdit = v.object({
  albumId: common.AlbumId,
  photoId: common.PhotoId,
  print: v.optional(v.array(CartPrintChangeBase)),
  download: v.optional(v.array(CartDownloadChangeBase)),
});
export type CartEditT = v.InferOutput<typeof CartEdit>;

export const CartEditBody = v.object({items: v.array(CartEdit)});
export type CartEditBodyT = v.InferOutput<typeof CartEditBody>;

// api.public.cart.photo.delete : pathParameters
export const CartPhotoDeletePathParameters = v.object({
  albumId: common.AlbumId,
  photoId: common.PhotoId,
});

// api.public.cart.checkout.shipping.options : response
export const ShippingOption = v.object({
  label: v.string(),
  priceRule: v.object({
    price: v.number(),
    maxSheetsPerShipment: v.number(),
  }),
});

// api.public.cart.checkout : request
const ShippingAddress = v.object({
  name: v.string(),
  postalCode: v.pipe(v.string(), v.regex(/^\d{7}$/)),
  line: v.string(),
  phone: v.pipe(v.string(), v.regex(/^\d{10,11}$/)),
});
export type ShippingAddressT = v.InferOutput<typeof ShippingAddress>;

export const CheckoutDigtalOnly = v.object({
  type: v.literal(PaymentConfig.ORDER_TYPE.DIGITAL),
});

export const CheckoutShipping = v.object({
  type: v.literal(PaymentConfig.ORDER_TYPE.SHIPPING),
  address: ShippingAddress,
});

export const CheckoutBody = v.variant("type", [
  CheckoutDigtalOnly,
  CheckoutShipping,
]);
export type CheckoutBodyT = v.InferOutput<typeof CheckoutBody>;

// api.public.cart.checkout : response
const OrderPrintLine = v.object({
  size: v.picklist([
    PhotoConfig.SALES_SIZE.PRINT_L,
    PhotoConfig.SALES_SIZE.PRINT_2L,
  ]),
  quantity: v.number(),
  subTotal: v.number(),
});
export type OrderPrintLineT = v.InferOutput<typeof OrderPrintLine>;

const OrderDownloadLine = v.object({
  size: v.literal(PhotoConfig.SALES_SIZE.DL_ORIGINAL), // 常に 'dl'
  note: v.string(), // 例: "1920×1280"
  subTotal: v.number(),
  downloadUrl: v.optional(v.string()), // 履歴のみ
  width: v.optional(v.number(), 0),
  height: v.optional(v.number(), 0),
});
export type OrderDownloadLineT = v.InferOutput<typeof OrderDownloadLine>;

const OrderItemBase = v.object({
  albumId: common.AlbumId,
  photoId: common.PhotoId,
  albumTitle: v.string(),
  albumSequenceId: v.number(),
  photoSequenceId: v.number(),
  imageUrl: common.Url,
  priceTier: common.PhotoPriceTier,
  print: v.array(OrderPrintLine),
  download: v.array(OrderDownloadLine),
  // discounts: v.array(v.object({})),
  itemTotal: v.number(),
});
export type OrderItemBaseT = v.InferOutput<typeof OrderItemBase>;

const ShippingInfo = v.object({
  method: v.string(),
  address: ShippingAddress,
});

const OrderCheckoutSummary = v.object({
  shipping: v.optional(ShippingInfo),
  photos: v.array(OrderItemBase),
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

export const OrderCheckout = v.object({
  orderId: v.string(),
  summary: OrderCheckoutSummary,
  paymentUrl: v.string(),
});
export type OrderCheckoutT = v.InferOutput<typeof OrderCheckout>;

// api.public.payment.list : response
const PaymentHistory = v.object({
  orderId: common.OrderId,
  countPrint: v.number(),
  countDl: v.number(),
  processDate: common.ISODateTime,
  grandTotal: v.number(),
  shipping: v.object({
    status: v.picklist(Object.values(PaymentConfig.SHIPPING_STATUS)),
  }),
});
export const PaymentHistoryList = v.array(PaymentHistory);
export type PaymentHistoryListT = v.InferOutput<typeof PaymentHistoryList>;

// api.public.payment.detail : pathParameters
export const PaymentPathParameters = v.object({
  orderId: common.OrderId,
});

// api.public.payment.detail : response
export const OrderAmountSummary = v.object({
  subTotal: v.number(),
  // itemsDiscountTotal: v.number(),
  shippingFee: v.object({
    after: v.number(),
    before: v.optional(v.number()),
    label: v.optional(v.string()),
  }),
  grandTotal: v.number(),
});

export const OrderDetail = v.object({
  orderId: v.string(),
  processDate: common.ISODateTime, // 注文日時
  photos: v.array(OrderItemBase),
  shipping: v.object({
    status: v.picklist(Object.values(PaymentConfig.SHIPPING_STATUS)), // 発送処理中なのか発送済みなのか、それ以外（DL販売のみなのか）
    method: v.string(),
    trackingNumber: v.optional(v.string(), ""), // string
  }),
  download: v.object({
    status: v.picklist(Object.values(PaymentConfig.DOWNLOAD_STATUS)), // 期限がきれているかどうか
    expiredAt: common.ISODateTime, // 期限ISO
    zipDownloadUrl: v.string(), // zipURL
  }),
  ...OrderAmountSummary.entries,
});

export type OrderDetailT = v.InferOutput<typeof OrderDetail>;

// === SMBC関連 ================================================================
export const SmbcCallback = v.object({
  status: v.picklist(["success", "failed"]),
  orderId: v.pipe(v.string(), v.minLength(1)),
});
