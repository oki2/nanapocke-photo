import * as v from "valibot";
import * as common from "./common";
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
