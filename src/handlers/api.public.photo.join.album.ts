import {AppConfig, PhotoConfig} from "../config";
import * as http from "../http";
import {
  FacilityCodePathParameters,
  PhotoJoinAlbumBody,
  ResultOK,
} from "../schemas/public";
import {parseOrThrow} from "../libs/validate";

import * as Photo from "../utils/Dynamo/Photo";
import * as Album from "../utils/Dynamo/Album";
import * as Relation from "../utils/Dynamo/Relation";

import {tagSplitter, photoIdSplitter} from "../libs/tool";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // パスパラメータの施設コード、写真ID取得
  const path = parseOrThrow(
    FacilityCodePathParameters,
    event.pathParameters ?? {},
  );

  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(PhotoJoinAlbumBody, raw);
  console.log("data", data);

  // 1. 編集可能アルバム一覧を取得
  const draftList = await Album.draftList(authContext.facilityCode);
  console.log("draftList", draftList);
  const draftIds = draftList.map((a: any) => a.albumId);
  console.log("draftIds", draftIds);

  // 2. アルバムIDを取得
  const addAlbums: string[] = [];
  const delAlbums: string[] = [];
  switch (data.album.mode) {
    case PhotoConfig.PHOTO_JOIN_ALBUM.ADD:
      addAlbums.push(...data.album.albums);
      break;
    case PhotoConfig.PHOTO_JOIN_ALBUM.REPLACE:
      addAlbums.push(data.album.to);
      delAlbums.push(data.album.from);
      break;
    case PhotoConfig.PHOTO_JOIN_ALBUM.REMOVE:
      delAlbums.push(...data.album.albums);
      break;
    case PhotoConfig.PHOTO_JOIN_ALBUM.SET:
      // ※実装は後で
      break;
  }

  // 3. 写真IDを取得
  let photoIds: string[] = [];
  if (data.scope.mode === PhotoConfig.PHOTO_JOIN_SCOPE.CHECKED) {
    // ID指定の場合
    photoIds = data.scope.selectedIds;
  } else if (data.scope.mode === PhotoConfig.PHOTO_JOIN_SCOPE.FILTER) {
    const sequenceIds = photoIdSplitter(data.scope.filters.sequenceIds);
    const tags = tagSplitter(data.scope.filters.tags);

    const filter: Photo.FilterOptions = {
      photographer:
        data.scope.filters.photographer == "ALL"
          ? ""
          : data.scope.filters.photographer,
      tags: tags, // AND 条件（すべて含む）
      // photoIds: photoIds, // OR 条件（すべて含む）
      // priceTier: {},
      shootingAt: {},
      createdAt: {},
    };
    if (data.scope.filters.dateType === PhotoConfig.DATE_TYPE.UPLOAD) {
      filter.createdAt = {
        from: data.scope.filters.dateFrom,
        to: data.scope.filters.dateTo,
      };
    } else if (data.scope.filters.dateType === PhotoConfig.DATE_TYPE.SHOOTING) {
      filter.shootingAt = {
        from: data.scope.filters.dateFrom,
        to: data.scope.filters.dateTo,
      };
    }

    // 検索条件を指定する場合
    photoIds = await getPhotoIdsByFilter({
      facilityCode: authContext.facilityCode,
      sequenceIds: sequenceIds,
      albumId: data.scope.filters.albumId,
      filter: filter,
    });
  }

  // 6. DynamoDB に写真とアルバムの紐付け情報を登録
  for (const photoId of photoIds) {
    await Relation.setRelationPhotoAlbums({
      facilityCode: authContext.facilityCode,
      photoId: photoId,
      addAlbums: addAlbums,
      delAlbums: delAlbums,
      userId: authContext.userId,
    });
  }

  // 3. レスポンス
  return http.ok(parseOrThrow(ResultOK, {ok: true}));
});

function hasOnlyInArrayCheck<T>(a: T[], b: T[]): boolean {
  const setB = new Set(b);
  return a.some((item) => !setB.has(item));
}

async function getPhotoIdsByFilter(p: {
  facilityCode: string;
  sequenceIds: string[];
  albumId: string;
  filter: Photo.FilterOptions;
}): Promise<any> {
  let data: any;

  // sequenceIds がある場合はそれを優先
  if (p.sequenceIds.length > 0) {
    return await getPhotosBySequenceIdsAndFilter(
      p.facilityCode,
      p.sequenceIds,
      p.albumId,
      p.filter,
    );
  } else {
    // sequenceIds がない場合
    switch (p.albumId) {
      case "ALL":
        return await getAllPhoto(p.facilityCode, p.filter);
      case "UNSET":
        return await getUnsetPhoto(p.facilityCode, p.filter);
      default:
        return await getAlbumPhoto(p.facilityCode, p.albumId, p.filter);
    }
  }
}

async function getPhotosBySequenceIdsAndFilter(
  facilityCode: string,
  sequenceIds: string[],
  albumId: string,
  filter: Photo.FilterOptions,
): Promise<string[]> {
  // 1. sequenceIds から写真一覧を取得
  const photos = await Photo.getPhotosBySequenceIds(facilityCode, sequenceIds);

  // 2. 写真Meta情報を取得（絞込み & 並べ替えも同時に）
  const res = Photo.filterSortPagePhotos(
    photos,
    {...filter, albumId: albumId},
    {
      field: "shootingAt", // 実際には利用しないから適当で
      order: "asc", // 実際には利用しないから適当で
    },
  );
  console.log("res", res);

  return res.items.map((p: any) => p.photoId);
}

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
): Promise<string[]> {
  // 1. 写真の全PhotoIDを取得
  return await Photo.listPhotoIdsAll({
    keys: {
      pkName: "GsiUploadPK",
      pkValue: Photo.getGsiUploadPk(facilityCode),
    },
    indexName: "GsiUpload_Index",
    scanIndexForward: false,
    filter: filter,
  });
}

async function getUnsetPhoto(
  facilityCode: string,
  filter: Photo.FilterOptions,
): Promise<string[]> {
  console.log("getUnsetPhoto");

  // 1. 写真の全PhotoIDを取得
  return await Photo.listPhotoIdsAll({
    keys: {
      pkName: "GsiUnsetUploadPK",
      pkValue: Photo.getGsiUnsetUploadPk(facilityCode),
    },
    indexName: "GsiUnsetUpload_Index",
    scanIndexForward: false,
    filter: filter,
  });
}

async function getAlbumPhoto(
  facilityCode: string,
  albumId: string,
  filter: Photo.FilterOptions,
): Promise<string[]> {
  // 1. 対象のアルバムに属する写真一覧を取得
  const photos = await Photo.getPhotosByAlbumId(facilityCode, albumId);
  console.log("photos", photos);

  // 2. 写真Meta情報を取得（絞込み & 並べ替えも同時に）
  const res = Photo.filterSortPagePhotos(photos, filter, {
    field: "shootingAt", // 実際には利用しないから適当で
    order: "asc", // 実際には利用しないから適当で
  });
  console.log("res", res);

  return res.items.map((p: any) => p.photoId);
}
