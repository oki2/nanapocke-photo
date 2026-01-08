import * as v from "valibot";
import * as common from "./common";
import * as nanapocke from "./common.nanapocke";
import {created} from "../http";
import {AlbumConfig} from "../config";

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
  }, "end は start より後の日時を指定してください")
);
export type SalesPeriodT = v.InferOutput<typeof SalesPeriod>;

// アルバム新規作成時のリクエストボディ
export const AlbumCreateBody = v.pipe(
  v.object({
    title: v.pipe(v.string(), v.minLength(1)),
    description: v.optional(v.pipe(v.string(), v.minLength(1))),
    priceTable: PriceTable,
    salesPeriod: v.optional(SalesPeriod),
    coverImageFileName: v.optional(v.pipe(v.string(), v.minLength(1))),
    copyFromAlbumId: v.optional(common.AlbumId),
  })
);
export type AlbumCreateBodyT = v.InferOutput<typeof AlbumCreateBody>;

export const AlbumCreateResponse = v.pipe(
  v.object({
    albumId: common.AlbumId,
    title: v.pipe(v.string(), v.minLength(1)),
    url: v.optional(v.pipe(v.string(), v.minLength(1))),
  })
);
export type AlbumCreateResponseT = v.InferOutput<typeof AlbumCreateResponse>;

export const AlbumPathParameters = v.pipe(
  v.object({
    facilityCode: nanapocke.FacilityCode,
    albumId: common.AlbumId,
  })
);

export const AlbumEditBody = v.pipe(
  v.object({
    title: v.pipe(v.string(), v.minLength(1)),
    description: v.optional(v.pipe(v.string(), v.minLength(1))),
    priceTable: PriceTable,
    salesPeriod: SalesPeriod,
    coverImageFileName: v.optional(v.pipe(v.string(), v.minLength(1))),
  })
);
export type AlbumEditBodyT = v.InferOutput<typeof AlbumEditBody>;

export const AlbumEditResponse = v.object({
  ok: v.literal(true),
  url: v.optional(v.pipe(v.string(), v.minLength(1))),
});
export type AlbumEditResponseT = v.InferOutput<typeof AlbumEditResponse>;

export const AlbumItem = v.object({
  albumId: common.AlbumId,
  sequenceId: v.number(),
  title: v.pipe(v.string(), v.minLength(1)),
  description: v.pipe(v.string(), v.minLength(1)),
  salesStatus: v.picklist(Object.values(AlbumConfig.SALES_STATUS)),
  priceTable: PriceTable,
  photoCount: v.optional(v.number()),
  coverImageUrl: v.optional(v.pipe(v.string()), ""),
  salesPeriod: v.optional(SalesPeriod, {
    start: "",
    end: "",
  }),
});
export type AlbumItemT = v.InferOutput<typeof AlbumItem>;

export const AlbumListResponse = v.array(AlbumItem);
export type AlbumListResponseT = v.InferOutput<typeof AlbumListResponse>;

export const AlbumSetPhotoPath = v.pipe(
  v.object({
    albumId: common.AlbumId,
  })
);

export const AlbumSetPhotoBody = v.pipe(
  v.object({
    photoId: common.PhotoId,
  })
);
export type AlbumSetPhotoBodyT = v.InferOutput<typeof AlbumSetPhotoBody>;

// アルバム販売開始・停止のリクエストボディ ================================================
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
  })
);

export const AlbumSalesStop = v.pipe(
  v.object({
    action: v.literal(AlbumConfig.SALES_ACTION.STOP),
  })
);

// Signin Response 判別共用体（state が判別キー）
export const AlbumSalesBody = v.variant("action", [
  AlbumSalesStart,
  AlbumSalesStop,
]);
