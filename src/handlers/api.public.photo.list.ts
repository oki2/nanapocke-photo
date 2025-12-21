import * as http from "../http";

import {PhotoConfig} from "../config";

import {
  PhotoFilters,
  PhotoListResponse,
  PhotoListResponseT,
} from "../schemas/photo";
import {parseOrThrow} from "../libs/validate";

import * as Photo from "../utils/Dynamo/Photo";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // === Step.1 クエリストリングチェック code を取得 =========== //
  const query = parseOrThrow(PhotoFilters, event.queryStringParameters ?? {});
  console.log("query", query);

  // タグの分解・スペース、又はハッシュで分割
  const tags =
    query.tagQuery
      .trim()
      .split(/[ #　]+/)
      .filter(Boolean) ?? [];

  const photoIds =
    query.photoIdQuery
      .trim()
      .split(/[ ,#　]+/)
      .filter(Boolean) ?? [];

  // === Step.2 絞込み情報作成 =========== //
  const filter: Photo.FilterOptions = {
    photographer: query.photographer,
    editability: query.editability,
    tags: tags, // AND 条件（すべて含む）
    photoIds: photoIds, // OR 条件（すべて含む）
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

  // === Step.2 データの取得 =========== //
  let data: any;
  switch (query.albumId) {
    case "ALL":
      data = await getAllPhoto(authContext.facilityCode);
      break;
    case "UNSET":
      data = await getUnsetPhoto();
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

  console.log("data", data);

  const result: PhotoListResponseT = {photos: []};

  for (const item of data) {
    result.photos.push({
      facilityCode: item.facilityCode,
      photoId: item.photoId,
      seq: item.seq,
      status: item.status,
      tags: item.tags,
      albums: item.albums,
      priceTier: item.priceTier,
      shootingAt: item.shootingAt,
      createdAt: item.createdAt,
    });
  }
  result.nextCursor = data.nextCursor ?? undefined;

  const tmp = parseOrThrow(PhotoListResponse, result);
  console.log("tmp", tmp);
  return http.ok(tmp);
});

async function getAllPhoto(facilityCode: string) {
  return await Photo.list(facilityCode);
}

function getUnsetPhoto() {}

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
