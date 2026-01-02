import * as v from "valibot";
import * as common from "./common";
import * as nanapocke from "./common.nanapocke";
import {created} from "../http";
import {AlbumConfig} from "../config";

export const TRIGGER_ACTION = {
  ALBUM_PUBLISHED: "albumPublished",
  PAYMENT_COMPLETE: "paymentComplete",
};

// アルバムの公開処理（
const AlbumPublished = v.object({
  facilityCode: nanapocke.FacilityCode,
  albumId: common.AlbumId,
  userId: v.pipe(v.string(), v.minLength(1)),
});
export type AlbumPublishedT = v.InferOutput<typeof AlbumPublished>;
