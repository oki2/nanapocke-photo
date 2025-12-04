import * as v from "valibot";
import * as common from "./common";
import {created} from "../http";
import {AlbumConfig} from "../config";

// アルバム新規作成時のリクエストボディ
export const AlbumCreateBody = v.pipe(
  v.object({
    title: v.pipe(v.string(), v.minLength(1)),
    description: v.optional(v.pipe(v.string(), v.minLength(1))),
    priceTable: common.PriceTable,
    nbf: v.optional(common.ISODateTime),
    exp: v.optional(common.ISODateTime),
  })
);
export type AlbumCreateBodyT = v.InferOutput<typeof AlbumCreateBody>;

export const AlbumCreateResponse = v.pipe(
  v.object({
    albumId: common.AlbumId,
    title: v.pipe(v.string(), v.minLength(1)),
  })
);
export type AlbumCreateResponseT = v.InferOutput<typeof AlbumCreateResponse>;

export const AlbumListResponse = v.array(
  v.pipe(
    v.object({
      albumId: common.AlbumId,
      seq: v.number(),
      title: v.pipe(v.string(), v.minLength(1)),
      description: v.pipe(v.string(), v.minLength(1)),
      salesStatus: v.picklist(Object.values(AlbumConfig.SALES_STATUS)),
      priceTable: common.PriceTable,
      nbf: v.optional(common.ISODateTime),
      exp: v.optional(common.ISODateTime),
      createdAt: common.ISODateTime,
      updatedAt: common.ISODateTime,
    })
  )
);
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
