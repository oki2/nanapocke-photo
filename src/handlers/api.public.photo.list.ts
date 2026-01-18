import * as http from "../http";

import {tagSplitter, photoIdSplitter} from "../libs/tool";

import {PhotoConfig, UserConfig} from "../config";

import {
  PhotoFilters,
  PhotoListResponse,
  PhotoListResponseT,
} from "../schemas/public";
import {parseOrThrow} from "../libs/validate";

import * as Photo from "../utils/Dynamo/Photo";
import {userInfo} from "os";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // === Step.1 クエリストリングチェック code を取得 =========== //
  const query = parseOrThrow(PhotoFilters, event.queryStringParameters ?? {});
  console.log("query", query);

  // タグの分解
  const tags = tagSplitter(query.tagQuery);

  // // 写真IDの分解
  // const photoIds = photoIdSplitter(query.photoIdQuery);

  // 写真通し番号の分解
  const sequenceIds = photoIdSplitter(query.sequenceIdQuery);
  if (sequenceIds.length > PhotoConfig.FILTER_LIMIT.MAX) {
    return http.badRequest({
      detail: `指定可能な写真IDの数は${PhotoConfig.FILTER_LIMIT.MAX}件までです。`,
    });
  }

  // === Step.2 絞込み情報作成 =========== //
  const filter: Photo.FilterOptions = {
    photographer: query.photographer == "ALL" ? "" : query.photographer,
    editability: query.editability,
    tags: tags, // AND 条件（すべて含む）
    // photoIds: photoIds, // OR 条件（すべて含む）
    // priceTier: {},
    shootingAt: {},
    createdAt: {},
  };
  if (query.dateType === PhotoConfig.DATE_TYPE.UPLOAD) {
    filter.createdAt = {from: query.dateFrom, to: query.dateTo};
  } else if (query.dateType === PhotoConfig.DATE_TYPE.SHOOTING) {
    filter.shootingAt = {from: query.dateFrom, to: query.dateTo};
  }

  // === Step.3 並べ替え情報作成 =========== //
  const sort: Photo.SortOptions = {
    field:
      query.sortKey == PhotoConfig.DATE_TYPE.SHOOTING
        ? "shootingAt"
        : "createdAt",
    order: query.sortOrder == PhotoConfig.SORT_ORDER.ASC ? "asc" : "desc",
  };

  // === Step.4 データの取得 =========== //
  let data: any;

  // sequenceIds がある場合はそれを優先
  if (sequenceIds.length > 0) {
    data = await getPhotosBySequenceIds(
      authContext.facilityCode,
      sequenceIds,
      query.albumId,
      filter,
      sort,
      query.limit,
      query.cursor ?? ""
    );
  } else {
    // sequenceIds がない場合
    switch (query.albumId) {
      case "ALL":
        data = await getAllPhoto(
          authContext.facilityCode,
          filter,
          sort,
          query.limit,
          query.cursor ?? ""
        );
        break;
      case "UNSET":
        data = await getUnsetPhoto(
          authContext.facilityCode,
          filter,
          sort,
          query.limit,
          query.cursor ?? ""
        );
        break;
      default:
        data = await getAlbumPhoto(
          authContext.facilityCode,
          query.albumId,
          filter,
          sort,
          query.limit,
          query.cursor ?? ""
        );
    }
  }

  console.log("data", data);

  const result: PhotoListResponseT = {
    photos: [],
    totalItems: 1,
    nextCursor: "",
  };

  for (const item of data) {
    result.photos.push({
      facilityCode: item.facilityCode,
      photoId: item.photoId,
      sequenceId: item.sequenceId,
      status: item.status,
      saleStatus:
        item.status == PhotoConfig.STATUS.ACTIVE
          ? PhotoConfig.SALES_STATUS.EDITABLE
          : PhotoConfig.SALES_STATUS.LOCKED,
      photoImageUrl: `/thumbnail/${item.facilityCode}/photo/${item.createdBy}/${item.photoId}.webp`,
      size: `${item.width} x ${item.height} px`,
      printSizes: item.salesSizePrint.map((v: string) => {
        if (v === PhotoConfig.SALES_SIZE.PRINT_L) return "L";
        if (v === PhotoConfig.SALES_SIZE.PRINT_2L) return "2L";
        return null; // 何も該当しない場合
      }),
      tags: item.tags,
      albums: item.albums,
      priceTier: item.priceTier,
      shootingAt: item.shootingAt,
      shootingUserName: item.shootingUserName,
      createdAt: item.createdAt,
    });
  }
  result.totalItems = 1;
  result.nextCursor = data.nextCursor ?? "";

  return http.ok(parseOrThrow(PhotoListResponse, result));
});

/**
 * Get all photos in DynamoDB.
 * @param {string} facilityCode - facility code
 * @param {Photo.FilterOptions} filter - filter options
 * @param {Photo.SortOptions} sort - sort options
 * @param {number} limit - limit of photos
 * @param {string} cursor - cursor of photos
 * @return {Promise<Photo.ListResponseT[]>} promise of array of photos
 */
async function getAllPhoto(
  facilityCode: string,
  filter: Photo.FilterOptions,
  sort: Photo.SortOptions,
  limit: number,
  cursor: string
) {
  // 1. Index の判定
  const indexFielsd = sort.field === "shootingAt" ? "lsi2" : "lsi1"; //
  const indexName = `${indexFielsd}_index`; //
  const indexPrefix =
    filter.editability === PhotoConfig.EDITABILITY.EDITABLE
      ? "EDITABLE#"
      : "LOCKED#";
  const scanIndexForward = sort.order === "asc";

  // 2. 写真一覧を取得
  const res = await Photo.queryPhotos(
    {
      pk: {
        name: "pk",
        value: `PHOTO#FAC#${facilityCode}#META`,
      },
      sk: {
        name: indexFielsd,
        value: indexPrefix,
      },
    },
    indexName,
    scanIndexForward,
    filter,
    {
      limit: limit,
      cursor: cursor,
    }
  );
  console.log("res", res);

  return res.Items;
}

async function getUnsetPhoto(
  facilityCode: string,
  filter: Photo.FilterOptions,
  sort: Photo.SortOptions,
  limit: number,
  cursor: string
) {
  console.log("getUnsetPhoto");
  // 1. Index の判定
  const indexFielsd = sort.field === "shootingAt" ? "lsi4" : "lsi3"; //
  const indexName = `${indexFielsd}_index`; //
  const indexPrefix =
    filter.editability === PhotoConfig.EDITABILITY.EDITABLE
      ? "EDITABLE#"
      : "LOCKED#";
  const scanIndexForward = sort.order === "asc";

  // 2. 写真一覧を取得
  const res = await Photo.queryPhotos(
    {
      pk: {
        name: "pk",
        value: `PHOTO#FAC#${facilityCode}#META`,
      },
      sk: {
        name: indexFielsd,
        value: indexPrefix,
      },
    },
    indexName,
    scanIndexForward,
    filter,
    {
      limit: limit,
      cursor: cursor,
    }
  );
  console.log("res", res);

  return res.Items;
}

/**
 * Get album photos.
 *
 * @param {string} facilityCode - Facility code.
 * @param {string} albumId - Album ID.
 * @param {number} limit - Limit of photos to return.
 * @returns {Promise<PhotoListResponseT>} - Promise of photos.
 */
async function getAlbumPhoto(
  facilityCode: string,
  albumId: string,
  filter: Photo.FilterOptions,
  sort: Photo.SortOptions,
  limit: number,
  cursor: string
) {
  // 1. 対象のアルバムに属する写真一覧を取得
  const photos = await Photo.getPhotosByAlbumId(facilityCode, albumId);

  // 2. 写真Meta情報を取得（絞込み & 並べ替えも同時に）
  const res = Photo.filterSortPagePhotos(photos, filter, sort, {
    limit: limit,
    cursor: cursor,
  });
  console.log("res", res);

  return res.items;
}

async function getPhotosBySequenceIds(
  facilityCode: string,
  sequenceIds: string[],
  albumId: string,
  filter: Photo.FilterOptions,
  sort: Photo.SortOptions,
  limit: number,
  cursor: string
) {
  // 1. sequenceIds から写真一覧を取得
  const photos = await Photo.getPhotosBySequenceIds(facilityCode, sequenceIds);

  // 2. 写真Meta情報を取得（絞込み & 並べ替えも同時に）
  const res = Photo.filterSortPagePhotos(
    photos,
    {...filter, albumId: albumId},
    sort,
    {
      limit: limit,
      cursor: cursor,
    }
  );
  console.log("res", res);

  return res.items;
}
