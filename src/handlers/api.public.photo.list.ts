import * as http from "../http";

import {tagSplitter, photoIdSplitter} from "../libs/tool";

import {PhotoConfig, UserConfig} from "../config";

import {
  PhotoSelect,
  PhotoSelectT,
  PhotoListResponse,
  PhotoListResponseT,
} from "../schemas/public";
import {parseOrThrow} from "../libs/validate";

import * as Photo from "../utils/Dynamo/Photo";
import {userInfo} from "os";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // 1. クエリストリングチェック =========== //
  const query = parseOrThrow(PhotoSelect, event.queryStringParameters ?? {});
  console.log("query", query);

  // 2. 権限により写真一覧取得方法の分岐
  let data: any;
  if (
    // 保育士、フォトグラファーの場合
    authContext.role === UserConfig.ROLE.TEACHER ||
    authContext.role === UserConfig.ROLE.PHOTOGRAPHER
  ) {
    data = await runByStudio(
      authContext.facilityCode,
      authContext.userId,
      query,
    );
  } else if (authContext.role === UserConfig.ROLE.PRINCIPAL) {
    // 園長の場合
    data = await runByPrincipal(
      query,
      authContext.facilityCode,
      authContext.userId,
    );
  }

  console.log("data", data);

  const result: PhotoListResponseT = {
    photos: [],
    totalItems: 0,
    nextCursor: "",
  };

  for (const item of data.photos) {
    result.photos.push({
      facilityCode: item.facilityCode,
      photoId: item.photoId,
      sequenceId: Number(item.sequenceId),
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
  result.totalItems = data.totalItems;
  result.nextCursor = data.nextCursor ?? "";

  return http.ok(parseOrThrow(PhotoListResponse, result));
});

async function runByStudio(
  facilityCode: string,
  userId: string,
  query: any = {},
) {
  // 保育士、フォトグラファーの場合は自身の写真を返して終了
  return await Photo.myList(facilityCode, userId, 2, query.cursor ?? "");
}

async function runByPrincipal(
  query: PhotoSelectT,
  facilityCode: string,
  userId: string,
) {
  // Step.1 検索条件の整理 =========== //
  const tags = tagSplitter(query.tags); // タグの分解
  // const photoIds = photoIdSplitter(query.photoIdQuery); // 写真IDの分解
  const sequenceIds = photoIdSplitter(query.sequenceIds); // 写真通し番号の分解
  if (sequenceIds.length > PhotoConfig.FILTER_LIMIT.MAX) {
    return http.badRequest({
      detail: `指定可能な写真IDの数は${PhotoConfig.FILTER_LIMIT.MAX}件までです。`,
    });
  }

  // === Step.2 絞込み情報作成 =========== //
  const filter: Photo.FilterOptions = {
    photographer: query.photographer == "ALL" ? "" : query.photographer,
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
  return (
    (await getPhotosByFilter({
      facilityCode: facilityCode,
      sequenceIds: sequenceIds,
      albumId: query.albumId,
      filter: filter,
      sort: sort,
      limit: query.limit,
      cursor: query.cursor ?? "",
    })) ?? []
  );
}

async function getPhotosByFilter(p: {
  facilityCode: string;
  sequenceIds: string[];
  albumId: string;
  filter: Photo.FilterOptions;
  sort: Photo.SortOptions;
  limit: number;
  cursor: string;
}): Promise<any> {
  let data: any;

  // sequenceIds がある場合はそれを優先
  if (p.sequenceIds.length > 0) {
    return await Photo.getPhotosBySequenceIdsAndFilter(
      p.facilityCode,
      p.sequenceIds,
      p.albumId,
      p.filter,
      p.sort,
      p.limit,
      p.cursor ?? "",
    );
  } else {
    // sequenceIds がない場合
    switch (p.albumId) {
      case "ALL":
        return await Photo.getAllPhoto(
          p.facilityCode,
          p.filter,
          p.sort,
          p.limit,
          p.cursor ?? "",
        );
      case "UNSET":
        return await Photo.getUnsetPhoto(
          p.facilityCode,
          p.filter,
          p.sort,
          p.limit,
          p.cursor ?? "",
        );
      default:
        return await Photo.getAlbumPhoto(
          p.facilityCode,
          p.albumId,
          p.filter,
          p.sort,
          p.limit,
          p.cursor ?? "",
        );
    }
  }
}
