import {PhotoConfig} from "../../../config";
import * as PhotoModel from "./Model";
import * as Relation from "../Relation";

function encodeCursor(payload: PhotoModel.CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): PhotoModel.CursorPayload {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const payload = JSON.parse(json) as PhotoModel.CursorPayload;
    if (
      payload?.v !== 1 ||
      (payload.field !== "shootingAt" && payload.field !== "createdAt") ||
      (payload.order !== "asc" && payload.order !== "desc") ||
      typeof payload.t !== "number" ||
      typeof payload.id !== "string"
    ) {
      throw new Error("Invalid cursor payload shape");
    }
    return payload;
  } catch {
    throw new Error("Invalid cursor");
  }
}

function compareBy(field: PhotoModel.SortField, order: PhotoModel.SortOrder) {
  return (a: PhotoModel.Photo, b: PhotoModel.Photo) => {
    const aT = new Date(a[field]).getTime();
    const bT = new Date(b[field]).getTime();

    if (aT !== bT) {
      return order === "asc" ? aT - bT : bT - aT;
    }

    // tie-breaker: photoId（安定ソート用）
    if (a.photoId === b.photoId) return 0;
    const idCmp = a.photoId < b.photoId ? -1 : 1;
    return order === "asc" ? idCmp : -idCmp;
  };
}

function isAfterCursor(
  photo: PhotoModel.Photo,
  cursor: PhotoModel.CursorPayload,
): boolean {
  const t = new Date(photo[cursor.field]).getTime();

  if (cursor.order === "asc") {
    // (t > cursor.t) OR (t == cursor.t AND photoId > cursor.id)
    return t > cursor.t || (t === cursor.t && photo.photoId > cursor.id);
  } else {
    // desc: (t < cursor.t) OR (t == cursor.t AND photoId < cursor.id)
    return t < cursor.t || (t === cursor.t && photo.photoId < cursor.id);
  }
}

export async function getPhotosByAlbumId(
  facilityCode: string,
  albumId: string,
) {
  // 1. 対象のアルバムに属する写真一覧を取得
  const photoIds = await Relation.getPhotoIdsByAlbumId(facilityCode, albumId);
  console.log("photoIds", photoIds);

  // // 2. バッチゲットで写真一覧を取得
  const photos = await PhotoModel.photoListBatchgetAll(facilityCode, photoIds);
  console.log("photos", photos);

  return photos;
}

export async function getPhotosBySequenceIds(
  facilityCode: string,
  sequenceIds: number[],
) {
  // 1. 対象のSequenceIdに属する写真一覧を取得
  const photoIds = await PhotoModel.getPhotoIdsBySeqs(
    facilityCode,
    sequenceIds,
  );
  console.log("photoIds", photoIds);

  // // 2. バッチゲットで写真一覧を取得
  const photos = await PhotoModel.photoListBatchgetAll(facilityCode, photoIds);
  console.log("photos", photos);

  return photos;
}

export function filterSortPagePhotos(
  photos: PhotoModel.Photo[],
  filter: PhotoModel.FilterOptions,
  sort: PhotoModel.SortOptions,
  page: PhotoModel.PageOptions = {},
): PhotoModel.PageResult<PhotoModel.Photo> {
  const sortField = sort.field;
  const sortOrder = sort.order;
  const limit = page.limit ?? PhotoConfig.FILTER_LIMIT.MAX;

  console.log("filter", filter);

  // 1) filter
  const filtered = photos.filter((photo) => {
    // PhotoID 指定チェック、もし指定がある場合、いずれも一致しないものは除外 ※ SequenceId 検索に変更したため不要
    // if (filter.photoIds && filter.photoIds.length > 0) {
    //   const hasAll = filter.photoIds.some(
    //     (photoId) => photo.photoId === photoId
    //   );
    //   if (!hasAll) return false;
    // }

    // アルバムチェック ※ SequenceId に属する写真一覧を取得時のみ判定がある
    if (filter.albumId) {
      if (filter.albumId === "ALL") {
      } else if (filter.albumId === "UNSET") {
        if (photo.albums && photo.albums.length > 0) return false;
      } else {
        if (!photo.albums || photo.albums.length === 0) return false;
        if (!photo.albums.includes(filter.albumId)) return false;
      }
    }

    // 撮影者指定がある場合はチェック
    if (filter.photographer && photo.createdBy !== filter.photographer) {
      return false;
    }

    // 編集可能状態チェック ACTIVE 以外は除外
    if (photo.status !== PhotoConfig.STATUS.ACTIVE) {
      return false;
    }

    // 価格帯チェック
    // if (filter.priceTier && photo.priceTier !== filter.priceTier) return false;

    // タグチェック
    if (filter.tags && filter.tags.length > 0) {
      if (!photo.tags || photo.tags.length === 0) return false;
      const hasAll = filter.tags.every((tag) => photo.tags.includes(tag));
      if (!hasAll) return false;
    }

    // 撮影日チェック
    if (filter.shootingAt) {
      const t = new Date(photo.shootingAt).getTime();
      if (
        filter.shootingAt.from &&
        t < new Date(filter.shootingAt.from).getTime()
      )
        return false;
      if (filter.shootingAt.to && t > new Date(filter.shootingAt.to).getTime())
        return false;
    }

    // 登録日チェック
    if (filter.createdAt) {
      const t = new Date(photo.createdAt).getTime();
      if (
        filter.createdAt.from &&
        t < new Date(filter.createdAt.from).getTime()
      )
        return false;
      if (filter.createdAt.to && t > new Date(filter.createdAt.to).getTime())
        return false;
    }

    return true;
  });

  // 1) idOnly の場合は直接返却
  if (page.idOnly) {
    return {items: filtered, nextCursor: ""};
  }

  // 2) sort（安定：field → photoId）
  const cmp = compareBy(sortField, sortOrder);
  const sorted = filtered.slice().sort(cmp);

  // 3) cursor 適用（次ページ開始位置までスキップ）
  let startList = sorted;
  if (page.cursor) {
    const cur = decodeCursor(page.cursor);

    // カーソルは「同じソート条件」でのみ有効にする（事故防止）
    if (cur.field !== sortField || cur.order !== sortOrder) {
      throw new Error("Cursor does not match current sort options");
    }

    startList = sorted.filter((p) => isAfterCursor(p, cur));
  }

  // 4) limit + nextCursor
  const items = startList.slice(0, limit);

  let nextCursor: string | undefined = undefined;
  if (items.length === limit && startList.length > limit) {
    const last = items[items.length - 1];
    const payload: PhotoModel.CursorPayload = {
      v: 1,
      field: sortField,
      order: sortOrder,
      t: new Date(last[sortField]).getTime(),
      id: last.photoId,
    };
    nextCursor = encodeCursor(payload);
  }

  return {items, nextCursor};
}

export async function getAllPhoto(
  facilityCode: string,
  filter: PhotoModel.FilterOptions,
  sort: PhotoModel.SortOptions,
  limit: number,
  cursor: string,
) {
  // 1. Index の判定
  const indexName =
    sort.field === "shootingAt" ? "GsiShooting_Index" : "GsiUpload_Index"; //
  const scanIndexForward = sort.order === "asc";
  const keys =
    sort.field === "shootingAt"
      ? {
          pkName: "GsiShootingPK",
          pkValue: PhotoModel.getGsiShootingPk(facilityCode),
        }
      : {
          pkName: "GsiUploadPK",
          pkValue: PhotoModel.getGsiUploadPk(facilityCode),
        };

  // 2. 写真の全件を取得
  const count = await PhotoModel.countPhotosAll({
    keys: keys,
    indexName: indexName,
    scanIndexForward: scanIndexForward,
    filter: filter,
  });
  console.log("count", count);

  // 3. 写真一覧を取得
  const res = await PhotoModel.queryPhotosPage({
    keys: keys,
    indexName: indexName,
    scanIndexForward: scanIndexForward,
    filter: filter,
    page: {
      limit: limit,
      cursor: cursor,
    },
  });
  console.log("res", res);

  return {
    totalItems: count,
    photos: res.items,
    nextCursor: res.nextCursor ?? "",
  };
}

export async function getUnsetPhoto(
  facilityCode: string,
  filter: PhotoModel.FilterOptions,
  sort: PhotoModel.SortOptions,
  limit: number,
  cursor: string,
) {
  console.log("getUnsetPhoto");
  // 1. Index の判定
  const indexName =
    sort.field === "shootingAt"
      ? "GsiUnsetShooting_Index"
      : "GsiUnsetUpload_Index"; //
  const scanIndexForward = sort.order === "asc";
  const keys =
    sort.field === "shootingAt"
      ? {
          pkName: "GsiUnsetShootingPK",
          pkValue: PhotoModel.getGsiUnsetShootingPk(facilityCode),
        }
      : {
          pkName: "GsiUnsetUploadPK",
          pkValue: PhotoModel.getGsiUnsetUploadPk(facilityCode),
        };

  // 2. 写真の全件を取得
  const count = await PhotoModel.countPhotosAll({
    keys: keys,
    indexName: indexName,
    scanIndexForward: scanIndexForward,
    filter: filter,
  });
  console.log("count", count);

  // 3. 写真一覧を取得
  const res = await PhotoModel.queryPhotosPage({
    keys: keys,
    indexName: indexName,
    scanIndexForward: scanIndexForward,
    filter: filter,
    page: {
      limit: limit,
      cursor: cursor,
    },
  });
  console.log("res", res);

  return {
    totalItems: count,
    photos: res.items,
    nextCursor: res.nextCursor ?? "",
  };
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

export async function getAlbumPhoto(
  facilityCode: string,
  albumId: string,
  filter: PhotoModel.FilterOptions,
  sort: PhotoModel.SortOptions,
  limit: number,
  cursor: string,
) {
  // 1. 対象のアルバムに属する写真一覧を取得
  const photos = await getPhotosByAlbumId(facilityCode, albumId);
  console.log("photos", photos);

  // 2. 写真Meta情報を取得（絞込み & 並べ替えも同時に）
  const res = filterSortPagePhotos(photos, filter, sort, {
    limit: limit,
    cursor: cursor,
  });
  console.log("res", res);

  return {
    totalItems: photos.length,
    photos: res.items,
    nextCursor: res.nextCursor ?? "",
  };
}

export async function getPhotosBySequenceIdsAndFilter(
  facilityCode: string,
  sequenceIds: number[],
  albumId: string,
  filter: PhotoModel.FilterOptions,
  sort: PhotoModel.SortOptions,
  limit: number,
  cursor: string,
) {
  // 1. sequenceIds から写真一覧を取得
  const photos = await getPhotosBySequenceIds(facilityCode, sequenceIds);

  // 2. 写真Meta情報を取得（絞込み & 並べ替えも同時に）
  const res = filterSortPagePhotos(
    photos,
    {...filter, albumId: albumId},
    sort,
    {
      limit: limit,
      cursor: cursor,
    },
  );
  console.log("res", res);

  return {
    totalItems: photos.length ?? 0,
    photos: res.items,
    nextCursor: res.nextCursor ?? "",
  };
}
