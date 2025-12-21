import {PhotoConfig} from "../../../config";
import * as PhotoModel from "./Model";

type Photo = {
  facilityCode: string;
  photoId: string;
  seq: number;
  status: string;
  tags: string[];
  albums: string[];
  priceTier: string;
  shootingAt: string; // ISO8601
  createdAt: string; // ISO8601
  createdBy: string;
};

type DateRange = {
  from?: string; // ISO8601
  to?: string; // ISO8601
};

export type FilterOptions = {
  photographer?: string;
  editability?: string;
  tags?: string[]; // AND 条件（すべて含む）
  photoIds?: string[]; // OR 条件（すべて含む）
  priceTier?: string;
  shootingAt?: DateRange;
  createdAt?: DateRange;
};

type SortField = "shootingAt" | "createdAt";
type SortOrder = "asc" | "desc";

export type SortOptions = {
  field: SortField; // 未指定時 createdAt
  order: SortOrder; // 未指定時 desc
};

type PageOptions = {
  limit?: number; // 未指定時 50
  cursor?: string; // 前回レスポンスの nextCursor を渡す
};

type PageResult<T> = {
  items: T[];
  nextCursor?: string; // 次ページがあれば返す
};

type CursorPayload = {
  v: 1;
  field: SortField;
  order: SortOrder;
  t: number; // sortField の epoch ms
  id: string; // tie-breaker (photoId)
};

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): CursorPayload {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const payload = JSON.parse(json) as CursorPayload;
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

function compareBy(field: SortField, order: SortOrder) {
  return (a: Photo, b: Photo) => {
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

function isAfterCursor(photo: Photo, cursor: CursorPayload): boolean {
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
  albumId: string
) {
  // 1. 対象のアルバムに属する写真一覧を取得
  const photoIds = await PhotoModel.photoIdsByAlbumId(facilityCode, albumId);
  console.log("photoIds", photoIds);

  // // 2. バッチゲットで写真一覧を取得
  const photos = await PhotoModel.photoListBatchgetAll(facilityCode, photoIds);
  console.log("photos", photos);

  return photos;
}

export function filterSortPagePhotos(
  photos: Photo[],
  filter: FilterOptions,
  sort: SortOptions,
  page: PageOptions = {}
): PageResult<Photo> {
  const sortField = sort.field;
  const sortOrder = sort.order;
  const limit = page.limit ?? 50;

  console.log("filter", filter);

  // 1) filter
  const filtered = photos.filter((photo) => {
    // PhotoID 指定チェック、もし指定がある場合、いずれも一致しないものは除外
    if (filter.photoIds && filter.photoIds.length > 0) {
      const hasAll = filter.photoIds.some(
        (photoId) => photo.photoId === photoId
      );
      if (!hasAll) return false;
    }

    // 撮影者指定がある場合はチェック
    if (filter.photographer && photo.createdBy !== filter.photographer)
      return false;

    // 編集可能状態チェック
    if (
      filter.editability &&
      filter.editability === PhotoConfig.EDITABILITY.EDITABLE &&
      photo.status !== PhotoConfig.STATUS.ACTIVE
    )
      return false;

    // 編集不可能状態チェック
    if (
      filter.editability &&
      filter.editability === PhotoConfig.EDITABILITY.LOCKED &&
      photo.status !== PhotoConfig.STATUS.DELETED_LOGICAL &&
      photo.status !== PhotoConfig.STATUS.BULK_DELETED
    )
      return false;

    // 価格帯チェック
    // if (filter.priceTier && photo.priceTier !== filter.priceTier) return false;

    // タグチェック
    if (filter.tags && filter.tags.length > 0) {
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
    const payload: CursorPayload = {
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
