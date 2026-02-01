/**
 * PHOTO#FAC#${facilityCode}#META
 * gsi1 : 全件：アップロード日ソート
 * gsi2 : 全件：撮影日ソート
 * gsi3 : アルバム未設定：アップロード日ソート
 * gsi4 : アルバム未設定：撮影日ソート
 * gsi5 : 自身がアップした写真：アップロード日ソート
 */

import {docClient, batchWriteAll} from "../dynamo";
import {
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
  BatchGetCommand,
  BatchWriteCommand,
  TransactWriteCommand,
  QueryCommandInput,
  QueryCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import {PhotoConfig} from "../../../config";

import * as User from "../User";

import {
  chunk,
  sleep,
  decodeCursorToken,
  encodeCursorToken,
  makeQueryHash,
} from "../../../libs/tool";

import * as Relation from "../Relation";

export type Photo = {
  facilityCode: string;
  photoId: string;
  sequenceId: number;
  status: string;
  tags: string[];
  albums: string[];
  priceTier: string;
  salesSizeDl: string[];
  salesSizePrint: string[];
  width: number;
  height: number;
  shootingAt: string; // ISO8601
  createdAt: string; // ISO8601
  createdBy: string;
};

export type DateRange = {
  from?: string; // ISO8601
  to?: string; // ISO8601
};

export type FilterOptions = {
  photographer?: string;
  tags?: string[]; // AND 条件（すべて含む）
  photoIds?: string[]; // OR 条件（すべて含む）
  priceTier?: string;
  albumId?: string;
  shootingAt?: DateRange;
  createdAt?: DateRange;
};

export type SortField = "shootingAt" | "createdAt";
export type SortOrder = "asc" | "desc";

export type SortOptions = {
  field: SortField; // 未指定時 createdAt
  order: SortOrder; // 未指定時 desc
};

export type PageOptions = {
  limit?: number; // 未指定時 50
  cursor?: string; // 前回レスポンスの nextCursor を渡す
  idOnly?: boolean;
};

export type PageResult<T> = {
  items: T[];
  nextCursor?: string; // 次ページがあれば返す
};

export type CursorPayload = {
  v: 1;
  field: SortField;
  order: SortOrder;
  t: number; // sortField の epoch ms
  id: string; // tie-breaker (photoId)
};

// PK、GSI等の定義 ========================================
export const getPk = (facilityCode: string) => `FAC#${facilityCode}`;
export const getSk = (photoId: string) => `META#${photoId}`;

const getGsiDeletePkNotSales = () => `PHOTO#UNSOLD#EXPIRESAT`;
const getGsiDeleteSkNotSales = (expiredAt: string) => expiredAt;

export const getGsiUploadPk = (facilityCode: string) =>
  `SORT#FAC#${facilityCode}#UPLOAD`;
export const getGsiUploadSk = (uploadAt: string) => uploadAt;

export const getGsiShootingPk = (facilityCode: string) =>
  `SORT#FAC#${facilityCode}#SHOOTING`;
export const getGsiShootingSk = (shootingAt: string) => shootingAt;

export const getGsiUnsetUploadPk = (facilityCode: string) =>
  `SORT#FAC#${facilityCode}#UNSET#UPLOAD`;
export const getGsiUnsetUploadSk = (uploadAt: string) => uploadAt;

export const getGsiUnsetShootingPk = (facilityCode: string) =>
  `SORT#FAC#${facilityCode}#UNSET#SHOOTING`;
export const getGsiUnsetShootingSk = (shootingAt: string) => shootingAt;

export const getGsiMyPk = (facilityCode: string, userId: string) =>
  `SORT#FAC#${facilityCode}#USER#${userId}`;
export const getGsiMySk = (uploadAt: string) => uploadAt;

const getSeq2PhotoPk = (facilityCode: string) =>
  `SEQ2PHOTO#FAC#${facilityCode}`;
const getSeq2PhotoSk = (seq: number) => `SEQ#${seq}`;

const getDlAcceptPk = (facilityCode: string, userId: string) =>
  `FAC#${facilityCode}#USER#${userId}#DOWNLOADACCEPT`;
const getDlAcceptSk = (photoId: string) => `PHOTO#${photoId}`;

/**
 * Get a single photo by facility code and photo ID.
 * @param {string} facilityCode - facility code
 * @param {string} photoId - photo ID
 * @returns {Promise<Record<string, any> | undefined>} - photo data or undefined if not found
 */
export async function get(
  facilityCode: string,
  photoId: string,
): Promise<Record<string, any> | undefined> {
  const command = new GetCommand({
    TableName: PhotoConfig.TABLE_NAME,
    Key: {
      pk: getPk(facilityCode),
      sk: getSk(photoId),
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Item;
}

export async function create(
  facilityCode: string,
  userId: string,
  userName: string,
  shootingAt: string,
  priceTier: string,
  tags: string[],
  albums: string[],
): Promise<string> {
  const nowISO = new Date().toISOString();
  const photoId = crypto.randomUUID();
  const deleteExp = new Date(Date.now() + PhotoConfig.UNSOLD_EXPIRES_IN);
  const seq = await nextSequence(facilityCode);
  console.log("next sequenceId", seq);

  // 写真情報を保存
  await docClient().send(
    new PutCommand({
      TableName: PhotoConfig.TABLE_NAME,
      Item: {
        pk: getPk(facilityCode),
        sk: getSk(photoId),
        facilityCode: facilityCode,
        photoId: photoId,
        shootingAt: shootingAt,
        shootingUserName: userName,
        priceTier: priceTier,
        sequenceId: seq,
        status: PhotoConfig.STATUS.CREATE,
        createdAt: nowISO,
        createdBy: userId,
        updatedAt: nowISO,
        updatedBy: userId,
        tags: tags,
        albums: albums,
        ttl: Math.floor(deleteExp.getTime() / 1000), // 画像が正常にアップされなかった場合に自動削除
        GsiDeletePk: getGsiDeletePkNotSales(),
        GsiDeleteSk: getGsiDeleteSkNotSales(deleteExp.toISOString()),
      },
      ConditionExpression: "attribute_not_exists(pk)", // 重複登録抑制
    }),
  );

  return photoId;
}

export async function setPhotoMeta(p: {
  facilityCode: string;
  photoId: string;
  sequenceId: number;
  width: number;
  height: number;
  salesSizeDl: string[];
  salesSizePrint: string[];
  shootingAt: string;
  createdBy: string;
  createdAt: string;
}): Promise<Record<string, any> | undefined> {
  // コマンド生成
  const nowISO = new Date().toISOString();
  const command = new UpdateCommand({
    TableName: PhotoConfig.TABLE_NAME,
    Key: {
      pk: getPk(p.facilityCode),
      sk: getSk(p.photoId),
    },
    UpdateExpression:
      "SET #GsiUploadPK = :GsiUploadPK" +
      ", #GsiUploadSK = :GsiUploadSK" +
      ", #GsiShootingPK = :GsiShootingPK" +
      ", #GsiShootingSK = :GsiShootingSK" +
      ", #GsiUnsetUploadPK = :GsiUnsetUploadPK" +
      ", #GsiUnsetUploadSK = :GsiUnsetUploadSK" +
      ", #GsiUnsetShootingPK = :GsiUnsetShootingPK" +
      ", #GsiUnsetShootingSK = :GsiUnsetShootingSK" +
      ", #GsiMyPK = :GsiMyPK" +
      ", #GsiMySK = :GsiMySK" +
      ", #status = :status, #width = :width, #height = :height, #salesSizeDl = :salesSizeDl, #salesSizePrint = :salesSizePrint, #shootingAt = :shootingAt, #updatedAt = :updatedAt" +
      " REMOVE #ttl", // ttl を削除して、自動削除を停止
    ExpressionAttributeNames: {
      "#GsiUploadPK": "GsiUploadPK",
      "#GsiUploadSK": "GsiUploadSK",
      "#GsiShootingPK": "GsiShootingPK",
      "#GsiShootingSK": "GsiShootingSK",
      "#GsiUnsetUploadPK": "GsiUnsetUploadPK",
      "#GsiUnsetUploadSK": "GsiUnsetUploadSK",
      "#GsiUnsetShootingPK": "GsiUnsetShootingPK",
      "#GsiUnsetShootingSK": "GsiUnsetShootingSK",
      "#GsiMyPK": "GsiMyPK",
      "#GsiMySK": "GsiMySK",
      "#status": "status",
      "#width": "width",
      "#height": "height",
      "#salesSizeDl": "salesSizeDl",
      "#salesSizePrint": "salesSizePrint",
      "#shootingAt": "shootingAt",
      "#updatedAt": "updatedAt",
      "#ttl": "ttl",
    },
    ExpressionAttributeValues: {
      ":GsiUploadPK": getGsiUploadPk(p.facilityCode),
      ":GsiUploadSK": getGsiUploadSk(p.createdAt),
      ":GsiShootingPK": getGsiShootingPk(p.facilityCode),
      ":GsiShootingSK": getGsiShootingSk(p.shootingAt),
      ":GsiUnsetUploadPK": getGsiUnsetUploadPk(p.facilityCode),
      ":GsiUnsetUploadSK": getGsiUnsetUploadSk(p.createdAt),
      ":GsiUnsetShootingPK": getGsiUnsetShootingPk(p.facilityCode),
      ":GsiUnsetShootingSK": getGsiUnsetShootingSk(p.shootingAt),
      ":GsiMyPK": getGsiMyPk(p.facilityCode, p.createdBy),
      ":GsiMySK": getGsiMySk(p.createdAt),
      ":status": PhotoConfig.STATUS.ACTIVE,
      ":width": p.width,
      ":height": p.height,
      ":salesSizeDl": p.salesSizeDl,
      ":salesSizePrint": p.salesSizePrint,
      ":shootingAt": p.shootingAt,
      ":updatedAt": nowISO,
    },
    ReturnValues: "ALL_NEW",
  });

  // コマンド実行
  const result = await docClient().send(command);

  // sequenceId 指定時の検索用に、紐付け情報を保存
  await docClient().send(
    new PutCommand({
      TableName: PhotoConfig.TABLE_NAME,
      Item: {
        pk: getSeq2PhotoPk(p.facilityCode),
        sk: getSeq2PhotoSk(p.sequenceId),
        photoId: p.photoId,
      },
      ConditionExpression: "attribute_not_exists(pk)", // 重複登録抑制
    }),
  );

  return result.Attributes;
}

export async function list(facilityCode: string): Promise<any> {
  const command = new QueryCommand({
    TableName: PhotoConfig.TABLE_NAME,
    KeyConditionExpression: "#pk = :pk",
    ProjectionExpression:
      "#sk, #photoId, #sequenceId, #facilityCode, #status, #tags, #priceTier, #shootingAt, #width, #height, #createdAt, #createdBy, #updatedAt, #updatedBy",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#sk": "sk",
      "#photoId": "photoId",
      "#sequenceId": "sequenceId",
      "#facilityCode": "facilityCode",
      "#status": "status",
      "#tags": "tags",
      "#priceTier": "priceTier",
      "#shootingAt": "shootingAt",
      "#width": "width",
      "#height": "height",
      "#createdAt": "createdAt",
      "#createdBy": "createdBy",
      "#updatedAt": "updatedAt",
      "#updatedBy": "updatedBy",
    },
    ExpressionAttributeValues: {
      ":pk": getPk(facilityCode),
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Items;
}

export async function myList(
  facilityCode: string,
  userId: string,
  cursor: string = "",
): Promise<any> {
  const qh = makeQueryHash({
    facilityCode: facilityCode,
    userId: userId,
  });

  const input: QueryCommandInput = {
    TableName: PhotoConfig.TABLE_NAME,
    IndexName: "GsiMy_Index",
    ScanIndexForward: false,
    KeyConditionExpression: "#GsiMyPK = :GsiMyPK",
    ProjectionExpression:
      "#sk, #photoId, #sequenceId, #facilityCode, #status, #tags, #albums, #priceTier, #shootingAt, #shootingUserName, #width, #height, #salesSizePrint, #createdAt, #createdBy, #updatedAt, #updatedBy",
    ExpressionAttributeNames: {
      "#GsiMyPK": "GsiMyPK",
      "#sk": "sk",
      "#photoId": "photoId",
      "#sequenceId": "sequenceId",
      "#facilityCode": "facilityCode",
      "#status": "status",
      "#tags": "tags",
      "#albums": "albums",
      "#priceTier": "priceTier",
      "#shootingAt": "shootingAt",
      "#shootingUserName": "shootingUserName",
      "#width": "width",
      "#height": "height",
      "#salesSizePrint": "salesSizePrint",
      "#createdAt": "createdAt",
      "#createdBy": "createdBy",
      "#updatedAt": "updatedAt",
      "#updatedBy": "updatedBy",
    },
    ExpressionAttributeValues: {
      ":GsiMyPK": getGsiMyPk(facilityCode, userId),
    },
    Limit: PhotoConfig.PHOTO_LIMIT_STUDIO,
  };

  if (cursor) {
    const token = decodeCursorToken(cursor);
    if (token.qh !== qh) {
      // 条件が違うのに cursor を流用された
      throw new Error("Cursor does not match query conditions.");
    }
    input.ExclusiveStartKey = token.lek as Record<string, any>;
  }

  // コマンド実行
  const res = await docClient().send(new QueryCommand(input));
  console.log("result", res);

  const nextCursor = res.LastEvaluatedKey
    ? encodeCursorToken({
        lek: res.LastEvaluatedKey as Record<string, unknown>,
        qh,
      })
    : undefined;

  return {
    totalItems: res.Items?.length ?? 0,
    photos: res.Items,
    nextCursor: nextCursor,
  };
}

/**
 * Get photo IDs by sequence IDs.
 *
 * @param {string} facilityCode - facility code
 * @param {string[]} sequenceIds - sequence IDs
 * @returns {Promise<any[]>} - promise of array of photo IDs
 */
export async function getPhotoIdsBySeqs(
  facilityCode: string,
  sequenceIds: number[],
) {
  if (sequenceIds.length === 0) return [];

  console.log("sequenceIds", sequenceIds);

  const tableName = PhotoConfig.TABLE_NAME;
  const pk = getSeq2PhotoPk(facilityCode);
  const allPhotoIds: string[] = [];

  // BatchGet は 1回100件まで
  const idChunks = chunk(sequenceIds, 100);

  for (const ids of idChunks) {
    let requestItems: Record<string, any> = {
      [tableName]: {
        Keys: ids.map((seq) => ({pk, sk: getSeq2PhotoSk(seq)})),
        ProjectionExpression: "#photoId",
        ExpressionAttributeNames: {
          "#photoId": "photoId",
        },
      },
    };

    console.log("requestItems", requestItems);

    // UnprocessedKeys がなくなるまで繰り返す
    while (Object.keys(requestItems).length > 0) {
      const res = await docClient().send(
        new BatchGetCommand({RequestItems: requestItems}),
      );
      console.log("res", res);

      const items = res.Responses?.[tableName] ?? [];
      for (const item of items) {
        if (item.photoId) {
          allPhotoIds.push(item.photoId);
        }
      }
      requestItems = res.UnprocessedKeys ?? {};
    }
  }

  return allPhotoIds;
}

/**
 * Increment the sequence number for the given facility code.
 * If the sequence number does not exist, it will be created with value 1.
 * @param facilityCode The facility code to increment the sequence number for.
 * @returns The updated sequence number.
 */
async function nextSequence(facilityCode: string): Promise<string> {
  const command = new UpdateCommand({
    TableName: PhotoConfig.TABLE_NAME,
    Key: {
      pk: `FAC#${facilityCode}#SEQ`,
      sk: `PHOTO#COUNTER`,
    },
    // seq を 1 加算（存在しなければ 1 で作られる）
    UpdateExpression: "ADD #sequenceId :inc",
    ExpressionAttributeNames: {
      "#sequenceId": "sequenceId",
    },
    ExpressionAttributeValues: {
      ":inc": 1,
    },
    ReturnValues: "UPDATED_NEW",
  });

  // コマンド実行
  const result = await docClient().send(command);
  const value = result.Attributes?.sequenceId;
  if (!value) throw new Error("sequenceId not returned");
  return value;
}

export async function photoListBatchget(
  facilityCode: string,
  photoIds: string[],
): Promise<any> {
  const command = new BatchGetCommand({
    RequestItems: {
      [PhotoConfig.TABLE_NAME]: {
        Keys: photoIds.map((photoId) => {
          return {
            pk: getPk(facilityCode),
            sk: getSk(photoId),
          };
        }),
      },
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Responses?.[PhotoConfig.TABLE_NAME];
}

export async function photoListBatchgetAll(
  facilityCode: string,
  photoIds: string[],
): Promise<any[]> {
  if (photoIds.length === 0) return [];

  const tableName = PhotoConfig.TABLE_NAME;
  const pk = getPk(facilityCode);
  const allItems: any[] = [];

  // BatchGet は 1回100件まで
  const idChunks = chunk(photoIds, 100);

  for (const ids of idChunks) {
    let requestItems: Record<string, any> = {
      [tableName]: {
        Keys: ids.map((photoId) => ({pk, sk: getSk(photoId)})),
      },
    };

    // UnprocessedKeys がなくなるまで繰り返す
    while (Object.keys(requestItems).length > 0) {
      const res = await docClient().send(
        new BatchGetCommand({RequestItems: requestItems}),
      );
      allItems.push(...(res.Responses?.[tableName] ?? []));
      requestItems = res.UnprocessedKeys ?? {};
    }
  }

  return allItems;
}

export const QueryTypes = {
  OBJECT: "OBJECT",
  COUNT: "COUNT",
  ID_ONLY: "ID_ONLY",
} as const;

type queryPhotosOptions = {
  type?: "OBJECT" | "COUNT" | "ID_ONLY";
  keys: {
    pkValue: string;
    skName: string;
  };
  indexName: string;
  scanIndexForward: boolean;
  filter: FilterOptions;
  page: PageOptions;
};
export async function queryPhotos({
  type = "OBJECT",
  keys,
  indexName,
  scanIndexForward,
  filter,
  page,
}: queryPhotosOptions): Promise<QueryCommandOutput> {
  // // 排他チェック（仕様通り）
  // if (shootingAt && createdAt) {
  //   throw new Error("shootingAt と createdAt は同時指定できません。");
  // }

  const ExpressionAttributeNames: Record<string, string> = {};
  const ExpressionAttributeValues: Record<string, any> = {};

  // ---- KeyConditionExpression ----
  const KeyConditionExpression = "#pk = :pk AND begins_with(#sk, :sk)";
  ExpressionAttributeNames["#pk"] = "pk";
  ExpressionAttributeValues[":pk"] = keys.pkValue;
  ExpressionAttributeNames["#sk"] = keys.skName;
  ExpressionAttributeValues[":sk"] = `${PhotoConfig.STATUS.ACTIVE}#`;

  // ---- FilterExpression ----
  const filters: string[] = [];

  // tags: AND（tags属性は String Set もしくは String List を想定）
  if (filter.tags && filter.tags.length > 0) {
    ExpressionAttributeNames["#tags"] = "tags";
    filter.tags.forEach((t, i) => {
      const v = `:tag${i}`;
      ExpressionAttributeValues[v] = t;
      filters.push(`contains(#tags, ${v})`);
    });
  }

  // photographer
  if (filter.photographer) {
    filters.push(`#createdBy = :createdBy`);
    ExpressionAttributeNames["#createdBy"] = "createdBy";
    ExpressionAttributeValues[":createdBy"] = filter.photographer;
  }

  // shootingAt / createdAt: Range（attribute は文字列ソート可能な形式を想定）
  let rangeAttr = "";
  let from = "";
  let to = "";

  if (filter.createdAt) {
    rangeAttr = "createdAt";
    from = filter.createdAt.from ?? "";
    to = filter.createdAt.to ?? "";
  } else if (filter.shootingAt) {
    rangeAttr = "shootingAt";
    from = filter.shootingAt.from ?? "";
    to = filter.shootingAt.to ?? "";
  }
  if (rangeAttr && from && to) {
    filters.push("#term BETWEEN :from AND :to");
    ExpressionAttributeNames["#term"] = rangeAttr;
    ExpressionAttributeValues[":from"] = from;
    ExpressionAttributeValues[":to"] = to;
  }

  const input: QueryCommandInput = {
    TableName: PhotoConfig.TABLE_NAME,
    IndexName: indexName,
    ScanIndexForward: scanIndexForward,
    KeyConditionExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  };

  if (filters.length > 0) {
    input.FilterExpression = filters.join(" AND ");
  }

  // photoId のみ取得
  switch (type) {
    case QueryTypes.ID_ONLY:
      input.ProjectionExpression = "#photoId";
      ExpressionAttributeNames["#photoId"] = "photoId";
      break;
    case QueryTypes.COUNT:
      input.Select = "COUNT";
      break;
    case QueryTypes.OBJECT:
    default:
      input.Limit = page.limit ?? PhotoConfig.FILTER_LIMIT.MAX;
      // input.ExclusiveStartKey: exclusiveStartKey,
      break;
  }

  console.log("input", input);

  const command = new QueryCommand(input);

  // コマンド実行
  const result = await docClient().send(command);
  return result;
}

export async function downloadAceptPhoto(
  facilityCode: string,
  userId: string,
  photoIds: string[],
  expiredAt: string,
) {
  const nowISO = new Date().toISOString();
  const ttl = Math.floor(new Date(expiredAt).getTime() / 1000) + 15552000; // 有効期限切れの半年後にレコード消す

  // 1バッチ分の PutRequest を作成
  let requestItems: Record<string, any>[] = photoIds.map((photoId) => ({
    PutRequest: {
      Item: {
        pk: getDlAcceptPk(facilityCode, userId),
        sk: getDlAcceptSk(photoId),
        facilityCode,
        photoId,
        expiredAt,
        ttl,
        createdAt: nowISO,
      },
    },
  }));

  await batchWriteAll(
    PhotoConfig.DL_ACCEPT_TABLE_NAME,
    requestItems,
    docClient(),
  );
}

// 保護者購入時に保護者ディレクトリ配下へ写真コピーする方式に変更した為不要
// ※後ほど削除
// export async function setFirstSoldAt(facilityCode: string, photoIds: string[]) {
//   const nowISO = new Date().toISOString();
//   for (const photoId of photoIds) {
//     await docClient().send(
//       new UpdateCommand({
//         TableName: PhotoConfig.TABLE_NAME,
//         Key: {
//           pk: `PHOTO#FAC#${facilityCode}#META`,
//           sk: photoId,
//         },
//         UpdateExpression:
//           "SET #firstSoldAt = if_not_exists(#firstSoldAt, :now) REMOVE #GsiDeletePk, #GsiDeleteSk, #ttl",
//         ExpressionAttributeNames: {
//           "#firstSoldAt": "firstSoldAt",
//           "#GsiDeletePk": "GsiDeletePk",
//           "#GsiDeleteSk": "GsiDeleteSk",
//           "#ttl": "ttl",
//         },
//         ExpressionAttributeValues: {
//           ":now": nowISO,
//         },
//       }),
//     );
//   }
//   // コマンド実行
// }

// ========================================================= //

export async function setAlbumsOnePhotoSafe(
  facilityCode: string,
  photoId: string,
  albumIds: string[],
) {
  // 1) 写真META 更新
  // gsi3/gsi4 に gsi1/gsi2 を入れる必要があるので、
  // 「Updateだけで同一アイテム内コピーはできない」→ 安全寄りに Get して値を取得
  const metaKey = {
    pk: getPk(facilityCode),
    sk: getSk(photoId),
  };

  // gsi1/gsi2 は必須想定
  const metaRes = await docClient().send(
    new GetCommand({
      TableName: PhotoConfig.TABLE_NAME,
      Key: metaKey,
      ProjectionExpression: "#status, #createdAt, #shootingAt",
      ExpressionAttributeNames: {
        "#status": "status",
        "#createdAt": "createdAt",
        "#shootingAt": "shootingAt",
      },
    }),
  );
  console.log("metaRes", metaRes);
  const meta = metaRes.Item as
    | {status?: string; createdAt?: string; shootingAt?: string}
    | undefined;
  console.log("meta", meta);
  if (
    !meta?.status ||
    meta.status !== PhotoConfig.STATUS.ACTIVE ||
    !meta?.createdAt ||
    !meta?.shootingAt
  ) {
    // 販売可状態以外は更新しない
    return;
  }

  const isUnassigned = albumIds.length === 0;

  // albums は常に配列で持つ
  if (isUnassigned) {
    // アルバムの紐付けが無い状態
    await docClient().send(
      new UpdateCommand({
        TableName: PhotoConfig.TABLE_NAME,
        Key: metaKey,
        UpdateExpression:
          "SET #albums = :albums, #GsiUnsetUploadPK = :GsiUnsetUploadPK, #GsiUnsetUploadSK = :GsiUnsetUploadSK, #GsiUnsetShootingPK = :GsiUnsetShootingPK, #GsiUnsetShootingSK = :GsiUnsetShootingSK",
        ExpressionAttributeNames: {
          "#albums": "albums",
          "#GsiUnsetUploadPK": "GsiUnsetUploadPK",
          "#GsiUnsetUploadSK": "GsiUnsetUploadSK",
          "#GsiUnsetShootingPK": "GsiUnsetShootingPK",
          "#GsiUnsetShootingSK": "GsiUnsetShootingSK",
        },
        ExpressionAttributeValues: {
          ":albums": [],
          ":GsiUnsetUploadPK": getGsiUnsetUploadPk(facilityCode),
          ":GsiUnsetUploadSK": getGsiUnsetUploadSk(meta.createdAt),
          ":GsiUnsetShootingPK": getGsiUnsetShootingPk(facilityCode),
          ":GsiUnsetShootingSK": getGsiUnsetShootingSk(meta.shootingAt),
        },
      }),
    );
  } else {
    // アルバムの紐付けがある状態
    await docClient().send(
      new UpdateCommand({
        TableName: PhotoConfig.TABLE_NAME,
        Key: metaKey,
        UpdateExpression:
          "SET #albums = :albums REMOVE #GsiUnsetUploadPK, #GsiUnsetUploadSK, #GsiUnsetShootingPK, #GsiUnsetShootingSK",
        ExpressionAttributeNames: {
          "#albums": "albums",
          "#GsiUnsetUploadPK": "GsiUnsetUploadPK",
          "#GsiUnsetUploadSK": "GsiUnsetUploadSK",
          "#GsiUnsetShootingPK": "GsiUnsetShootingPK",
          "#GsiUnsetShootingSK": "GsiUnsetShootingSK",
        },
        ExpressionAttributeValues: {
          ":albums": albumIds,
        },
      }),
    );
  }
  return;
}

// ====================================================
// ChatGPT で整理したバージョン

type QueryBaseOptions = {
  keys: {pkName: string; pkValue: string};
  indexName: string;
  scanIndexForward: boolean;
  filter: FilterOptions;
};

type QueryPhotosPageOptions = QueryBaseOptions & {
  page: PageOptions;
};

export type QueryPhotosPageResult<TItem> = {
  items: TItem[];
  nextCursor?: string; // 次ページがある時だけ返す
};

function buildPhotoQueryInput(opts: QueryBaseOptions): QueryCommandInput {
  const ExpressionAttributeNames: Record<string, string> = {};
  const ExpressionAttributeValues: Record<string, any> = {};

  // const KeyConditionExpression = "#pk = :pk AND begins_with(#sk, :sk)";
  const KeyConditionExpression = "#pk = :pk";
  ExpressionAttributeNames["#pk"] = opts.keys.pkName;
  ExpressionAttributeValues[":pk"] = opts.keys.pkValue;
  // ExpressionAttributeNames["#sk"] = opts.keys.skName;
  // ExpressionAttributeValues[":sk"] = `${PhotoConfig.STATUS.ACTIVE}#`;

  const filters: string[] = [];

  if (opts.filter.tags?.length) {
    ExpressionAttributeNames["#tags"] = "tags";
    opts.filter.tags.forEach((t, i) => {
      const v = `:tag${i}`;
      ExpressionAttributeValues[v] = t;
      filters.push(`contains(#tags, ${v})`);
    });
  }

  if (opts.filter.photographer) {
    ExpressionAttributeNames["#createdBy"] = "createdBy";
    ExpressionAttributeValues[":createdBy"] = opts.filter.photographer;
    filters.push("#createdBy = :createdBy");
  }

  let rangeAttr = "";
  let from = "";
  let to = "";

  if (opts.filter.createdAt) {
    rangeAttr = "createdAt";
    from = opts.filter.createdAt.from ?? "";
    to = opts.filter.createdAt.to ?? "";
  } else if (opts.filter.shootingAt) {
    rangeAttr = "shootingAt";
    from = opts.filter.shootingAt.from ?? "";
    to = opts.filter.shootingAt.to ?? "";
  }

  if (rangeAttr && from && to) {
    ExpressionAttributeNames["#term"] = rangeAttr;
    ExpressionAttributeValues[":from"] = from;
    ExpressionAttributeValues[":to"] = to;
    filters.push("#term BETWEEN :from AND :to");
  }

  const input: QueryCommandInput = {
    TableName: PhotoConfig.TABLE_NAME,
    IndexName: opts.indexName,
    ScanIndexForward: opts.scanIndexForward,
    KeyConditionExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  };

  if (filters.length) input.FilterExpression = filters.join(" AND ");
  return input;
}

export async function countPhotosAll(opts: QueryBaseOptions): Promise<number> {
  let total = 0;
  let ExclusiveStartKey: Record<string, any> | undefined;

  do {
    const input = buildPhotoQueryInput(opts);
    input.Select = "COUNT";
    input.ExclusiveStartKey = ExclusiveStartKey;

    const res = await docClient().send(new QueryCommand(input));
    total += res.Count ?? 0;
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return total;
}

export async function listPhotoIdsAll(
  opts: QueryBaseOptions,
): Promise<string[]> {
  const ids: string[] = [];
  let ExclusiveStartKey: Record<string, any> | undefined;

  do {
    const input = buildPhotoQueryInput(opts);
    input.ProjectionExpression = "#photoId";
    input.ExpressionAttributeNames!["#photoId"] = "photoId";
    input.ExclusiveStartKey = ExclusiveStartKey;

    const res = await docClient().send(new QueryCommand(input));
    for (const item of res.Items ?? []) {
      if (typeof item.photoId === "string") ids.push(item.photoId);
    }
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return ids;
}

export async function queryPhotosPage<TItem extends Record<string, any>>(
  opts: QueryPhotosPageOptions,
): Promise<QueryPhotosPageResult<TItem>> {
  // この queryHash を cursor に埋める（検索条件が同一か検証する）
  const qh = makeQueryHash({
    keys: opts.keys,
    indexName: opts.indexName,
    scanIndexForward: opts.scanIndexForward,
    filter: opts.filter,
    // limit はページング条件ではあるが「別 limit の cursor を使うのはOK」にしたいなら含めない
    // 厳密にしたいなら page.limit も入れてください
  });

  const input: QueryCommandInput = buildPhotoQueryInput(opts);

  // limit
  input.Limit = opts.page.limit ?? PhotoConfig.FILTER_LIMIT.MAX;

  // cursor -> ExclusiveStartKey
  if (opts.page.cursor) {
    const token = decodeCursorToken(opts.page.cursor);

    if (token.qh !== qh) {
      // 条件が違うのに cursor を流用された
      throw new Error("Cursor does not match query conditions.");
    }

    input.ExclusiveStartKey = token.lek as Record<string, any>;
  }

  const res = await docClient().send(new QueryCommand(input));

  const items = (res.Items ?? []) as TItem[];

  // nextCursor 作成（次ページがある場合のみ）
  const nextCursor = res.LastEvaluatedKey
    ? encodeCursorToken({
        lek: res.LastEvaluatedKey as Record<string, unknown>,
        qh,
      })
    : undefined;

  return {items, nextCursor};
}

export async function photoManualDelete(
  facilityCode: string,
  photoId: string,
  userId: string,
): Promise<void> {
  // コマンド生成
  const nowISO = new Date().toISOString();

  // 70日後のDateを取得
  const purgedAt = new Date();
  purgedAt.setDate(purgedAt.getDate() + PhotoConfig.PURGED_IN_DAYS);

  // 1. 写真を論理削除
  const command = new UpdateCommand({
    TableName: PhotoConfig.TABLE_NAME,
    Key: {
      pk: getPk(facilityCode),
      sk: getSk(photoId),
    },
    UpdateExpression:
      `SET #status = :status, #deleteType = :deleteType, #deletedAt = :deletedAt, #deletedBy = :deletedBy, #purgedAt = :purgedAt, #ttl = :ttl, #updatedAt = :updatedAt, #updatedBy = :updatedBy ` +
      `REMOVE #GsiSeqPK` +
      ", #GsiSeqSK" +
      ", #GsiUploadPK" +
      ", #GsiUploadSK" +
      ", #GsiShootingPK" +
      ", #GsiShootingSK" +
      ", #GsiUnsetUploadPK" +
      ", #GsiUnsetUploadSK" +
      ", #GsiUnsetShootingPK" +
      ", #GsiUnsetShootingSK" +
      ", #GsiMyPK" +
      ", #GsiMySK",
    ExpressionAttributeNames: {
      "#status": "status",
      "#deleteType": "deleteType",
      "#deletedAt": "deletedAt",
      "#deletedBy": "deletedBy",
      "#purgedAt": "purgedAt",
      "#ttl": "ttl",
      "#updatedAt": "updatedAt",
      "#updatedBy": "updatedBy",
      "#GsiSeqPK": "GsiSeqPK",
      "#GsiSeqSK": "GsiSeqSK",
      "#GsiUploadPK": "GsiUploadPK",
      "#GsiUploadSK": "GsiUploadSK",
      "#GsiShootingPK": "GsiShootingPK",
      "#GsiShootingSK": "GsiShootingSK",
      "#GsiUnsetUploadPK": "GsiUnsetUploadPK",
      "#GsiUnsetUploadSK": "GsiUnsetUploadSK",
      "#GsiUnsetShootingPK": "GsiUnsetShootingPK",
      "#GsiUnsetShootingSK": "GsiUnsetShootingSK",
      "#GsiMyPK": "GsiMyPK",
      "#GsiMySK": "GsiMySK",
    },
    ExpressionAttributeValues: {
      ":status": PhotoConfig.STATUS.DELETED_LOGICAL,
      ":deleteType": PhotoConfig.LOGICAL_DELETE_TYPE.MANUAL,
      ":deletedAt": nowISO,
      ":deletedBy": userId,
      ":purgedAt": purgedAt.toISOString(),
      ":ttl": Math.floor(purgedAt.getTime() / 1000), // 物理削除はTTLで対応
      ":updatedBy": userId,
      ":updatedAt": nowISO,
    },
  });
  // コマンド実行
  await docClient().send(command);

  // 2. アルバムの紐付けを削除
  Relation.deleteRelationPhotoAlbums(facilityCode, photoId);
}
