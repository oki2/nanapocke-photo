import * as v from "valibot";
import * as common from "./common";
import * as nanapocke from "./common.nanapocke";
import {created} from "../http";

// アルバム新規作成時のリクエストボディ
export const PhotoUploadBody = v.pipe(
  v.object({
    shootingAt: common.ISODateTime,
    valueType: common.PhotoValueType,
    tags: v.array(v.string()),
    albumId: v.optional(v.pipe(v.string(), v.minLength(1))),
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

export const PhotoListResponse = v.array(
  v.pipe(
    v.object({
      facilityCode: nanapocke.FacilityCode,
      photoId: common.AlbumId,
      seq: v.number(),
      status: v.pipe(v.string(), v.minLength(1)),
      tags: v.optional(v.array(v.string())),
      valueType: common.PhotoValueType,
      shootingAt: common.ISODateTime,
      createdAt: common.ISODateTime,
    })
  )
);
export type PhotoListResponseT = v.InferOutput<typeof PhotoListResponse>;
