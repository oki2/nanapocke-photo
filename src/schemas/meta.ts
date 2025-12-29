import * as v from "valibot";
import * as common from "./common";
import * as nanapocke from "./common.nanapocke";
import {created} from "../http";
import {AlbumConfig} from "../config";

const MetaAlbum = v.object({
  albumId: common.AlbumId,
  sequenceId: v.number(),
  title: v.pipe(v.string(), v.minLength(1)),
  salesStatus: v.picklist(Object.values(AlbumConfig.SALES_STATUS)),
});

const MetaStaff = v.object({
  userId: v.pipe(v.string(), v.minLength(1)),
  userName: v.pipe(v.string(), v.minLength(1)),
});

const MetaClass = v.object({
  classCode: nanapocke.ClassCode,
  className: v.pipe(v.string(), v.minLength(1)),
});

export const MetaListResponse = v.object({
  tags: v.optional(v.array(v.string()), []),
  albums: v.optional(v.array(MetaAlbum), []),
  staff: v.optional(v.array(MetaStaff)),
  classList: v.optional(v.array(MetaClass)),
  academicYear: v.optional(v.array(nanapocke.AcademicYear)),
});
export type MetaListResponseT = v.InferOutput<typeof MetaListResponse>;
