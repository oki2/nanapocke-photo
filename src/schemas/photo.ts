import * as v from "valibot";
import * as common from "./common";
import * as nanapocke from "./common.nanapocke";
import {created} from "../http";
import {PhotoConfig} from "../config";

// 写真タイプ
export const PhotoPriceTier = v.picklist(Object.values(PhotoConfig.PRICE_TIER));

// 写真絞込み項目関連 ===
export const FilterAlbum = v.picklist(["ALL", "UNSET"]);
export const FilterDateType = v.picklist(Object.values(PhotoConfig.DATE_TYPE));
export const FilterPhotoPriceTier = v.picklist(
  Object.values(PhotoConfig.PRICE_TIER)
);
export const FilterEditability = v.picklist(
  Object.values(PhotoConfig.EDITABILITY)
);

// アルバム新規作成時のリクエストボディ
export const PhotoUploadBody = v.pipe(
  v.object({
    shootingAt: common.ISODateTime,
    priceTier: PhotoPriceTier,
    tags: v.optional(v.string(), ""),
    albums: v.optional(v.array(v.string()), []),
    fileType: common.PhotoUploadFileType,
    fileName: v.pipe(v.string(), v.minLength(1)),
  })
);
export type PhotoUploadBodyT = v.InferOutput<typeof PhotoUploadBody>;

export const PhotoUploadResponse = v.pipe(
  v.object({
    url: v.pipe(v.string(), v.minLength(1)),
  })
);
export type PhotoUploadResponseT = v.InferOutput<typeof PhotoUploadResponse>;

// 写真絞込み項目
export const PhotoFilters = v.object({
  // albumId: v.fallback(
  //   v.optional(v.union([common.FilterAlbum, common.AlbumId])),
  //   "ALL"
  // ),
  albumId: v.union([FilterAlbum, common.AlbumId]),
  photographer: v.optional(v.string(), ""),
  tagQuery: v.optional(v.string(), ""),
  photoIdQuery: v.optional(v.string(), ""),
  dateType: v.optional(v.union([FilterDateType, v.literal("")]), ""),
  dateFrom: v.optional(v.union([common.ISODateTime, v.literal("")]), ""),
  dateTo: v.optional(v.union([common.ISODateTime, v.literal("")]), ""),
  // priceTier: FilterPhotoPriceTier,
  editability: v.optional(FilterEditability, PhotoConfig.EDITABILITY.EDITABLE),
  sortKey: v.optional(
    v.picklist(Object.values(PhotoConfig.SORT_KEY)),
    PhotoConfig.SORT_KEY.UPLOAD
  ),
  sortOrder: v.optional(
    v.picklist(Object.values(PhotoConfig.SORT_ORDER)),
    PhotoConfig.SORT_ORDER.DESC
  ),
  limit: v.pipe(
    v.string(),
    v.regex(/^\d+$/, "数値のみを指定してください"),
    v.transform(Number),
    v.number()
  ),
  cursor: v.optional(v.string()),
});

export const PhotoListResponse = v.object({
  photos: v.array(
    v.pipe(
      v.object({
        facilityCode: nanapocke.FacilityCode,
        photoId: common.AlbumId,
        sequenceId: v.number(),
        status: v.pipe(v.string(), v.minLength(1)),
        tags: v.optional(v.array(v.string())),
        albums: v.optional(v.array(common.AlbumId)),
        priceTier: PhotoPriceTier,
        shootingAt: common.ISODateTime,
        createdAt: common.ISODateTime,
      })
    )
  ),
  nextCursor: v.optional(v.string()),
});
export type PhotoListResponseT = v.InferOutput<typeof PhotoListResponse>;

export const PhotoEditBody = v.pipe(
  v.object({
    album: v.object({
      mode: v.picklist(["CHANGE"]),
      albums: v.array(v.pipe(v.string(), v.minLength(1))),
    }),
  })
);

export const PhotoPathParameters = v.pipe(
  v.object({
    facilityCode: nanapocke.FacilityCode,
    photoId: common.PhotoId,
  })
);
