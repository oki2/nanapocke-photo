/**
 * PHOTO#FAC#${facilityCode}#META
 * lsi1 : 全件：アップロード日ソート
 * lsi2 : 全件：撮影日ソート
 * lsi3 : アルバム未設定：アップロード日ソート
 * lsi4 : アルバム未設定：撮影日ソート
 */

import {docClient} from "../dynamo";
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

import {chunk, sleep} from "../../../libs/tool";

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
  editability?: string;
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

export async function get(
  facilityCode: string,
  photoId: string
): Promise<Record<string, any> | undefined> {
  const command = new GetCommand({
    TableName: PhotoConfig.TABLE_NAME,
    Key: {
      pk: `PHOTO#FAC#${facilityCode}#META`,
      sk: photoId,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Item;
}

export async function getZipMeta(
  facilityCode: string,
  zipId: string
): Promise<Record<string, any> | undefined> {
  const command = new GetCommand({
    TableName: PhotoConfig.TABLE_NAME,
    Key: {
      pk: `PHOTOZIP#${facilityCode}`,
      sk: `META#${zipId}`,
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
  albums: string[]
): Promise<string> {
  const nowISO = new Date().toISOString();
  const photoId = crypto.randomUUID();

  const seq = await nextSequence(facilityCode);
  console.log("next sequenceId", seq);

  // 写真情報を保存
  await docClient().send(
    new PutCommand({
      TableName: PhotoConfig.TABLE_NAME,
      Item: {
        pk: `PHOTO#FAC#${facilityCode}#META`,
        sk: photoId,
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
        ...(tags && tags.length > 0 ? {tags} : {}),
        ...(albums && albums.length > 0 ? {albums} : {}),
        gsi1pk: `PHOTO#UNSOLD#EXPIRESAT`,
        gsi1sk: new Date(
          Date.now() + PhotoConfig.UNSOLD_EXPIRES_IN
        ).toISOString(),
      },
      ConditionExpression: "attribute_not_exists(pk)", // 重複登録抑制
    })
  );

  // sequenceId 指定時の検索用に、紐付け情報を保存
  await docClient().send(
    new PutCommand({
      TableName: PhotoConfig.TABLE_NAME,
      Item: {
        pk: `PHOTO#FAC#${facilityCode}#SEQ2PHOTO`,
        sk: `SEQ#${seq}`,
        photoId: photoId,
      },
      ConditionExpression: "attribute_not_exists(pk)", // 重複登録抑制
    })
  );

  return photoId;
}

export async function createZip(
  facilityCode: string,
  userId: string,
  userName: string,
  shootingAt: string,
  priceTier: string,
  tags: string[],
  albums: string[]
): Promise<string> {
  const nowISO = new Date().toISOString();
  const zipId = crypto.randomUUID();

  // コマンド実行
  const result = await docClient().send(
    new PutCommand({
      TableName: PhotoConfig.TABLE_NAME,
      Item: {
        pk: `PHOTOZIP#${facilityCode}`,
        sk: `META#${zipId}`,
        facilityCode: facilityCode,
        shootingAt: shootingAt,
        shootingUserName: userName,
        priceTier: priceTier,
        status: PhotoConfig.STATUS.CREATE,
        createdAt: nowISO,
        createdBy: userId,
        updatedAt: nowISO,
        updatedBy: userId,
        ...(tags && tags.length > 0 ? {tags} : {}),
        ...(albums && albums.length > 0 ? {albums} : {}),
      },
      ConditionExpression: "attribute_not_exists(pk)", // 重複登録抑制
    })
  );

  return zipId;
}

export async function setPhotoMeta(
  facilityCode: string,
  photoId: string,
  lsi1: string,
  lsi2: string,
  width: number,
  height: number,
  salesSizeDl: string[],
  salesSizePrint: string[],
  shootingAt: string
): Promise<Record<string, any> | undefined> {
  // コマンド生成
  const nowISO = new Date().toISOString();
  const command = new UpdateCommand({
    TableName: PhotoConfig.TABLE_NAME,
    Key: {
      pk: `PHOTO#FAC#${facilityCode}#META`,
      sk: photoId,
    },
    UpdateExpression: `SET #lsi1 = :lsi1, #lsi2 = :lsi2, #lsi3 = :lsi3, #lsi4 = :lsi4, #status = :status, #width = :width, #height = :height, #salesSizeDl = :salesSizeDl, #salesSizePrint = :salesSizePrint, #shootingAt = :shootingAt, #updatedAt = :updatedAt`,
    ExpressionAttributeNames: {
      "#lsi1": "lsi1",
      "#lsi2": "lsi2",
      "#lsi3": "lsi3",
      "#lsi4": "lsi4",
      "#status": "status",
      "#width": "width",
      "#height": "height",
      "#salesSizeDl": "salesSizeDl",
      "#salesSizePrint": "salesSizePrint",
      "#shootingAt": "shootingAt",
      "#updatedAt": "updatedAt",
    },
    ExpressionAttributeValues: {
      ":lsi1": lsi1,
      ":lsi2": lsi2,
      ":lsi3": lsi1,
      ":lsi4": lsi2,
      ":status": PhotoConfig.STATUS.ACTIVE,
      ":width": width,
      ":height": height,
      ":salesSizeDl": salesSizeDl,
      ":salesSizePrint": salesSizePrint,
      ":shootingAt": shootingAt,
      ":updatedAt": nowISO,
    },
    ReturnValues: "ALL_NEW",
  });

  // コマンド実行
  const result = await docClient().send(command);
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
      ":pk": `PHOTO#FAC#${facilityCode}#META`,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Items;
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
  sequenceIds: string[]
) {
  if (sequenceIds.length === 0) return [];

  console.log("sequenceIds", sequenceIds);

  const tableName = PhotoConfig.TABLE_NAME;
  const pk = `PHOTO#FAC#${facilityCode}#SEQ2PHOTO`;
  const allPhotoIds: string[] = [];

  // BatchGet は 1回100件まで
  const idChunks = chunk(sequenceIds, 100);

  for (const ids of idChunks) {
    let requestItems: Record<string, any> = {
      [tableName]: {
        Keys: ids.map((seq) => ({pk, sk: `SEQ#${seq}`})),
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
        new BatchGetCommand({RequestItems: requestItems})
      );

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
async function nextSequence(facilityCode: string): Promise<number> {
  const command = new UpdateCommand({
    TableName: PhotoConfig.TABLE_NAME,
    Key: {
      pk: `SEQ#FAC#${facilityCode}`,
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

/**
 * Set albums for a photo.
 * If addAlbums is not empty, it will add the albums to the photo.
 * If delAlbums is not empty, it will delete the albums from the photo.
 * If albumList is empty, it will set the albums to undefined.
 * @param facilityCode The facility code of the photo.
 * @param photoId The ID of the photo.
 * @param addAlbums The albums to add to the photo.
 * @param delAlbums The albums to delete from the photo.
 * @param albumList The list of albums to set to the photo.
 * @param userId The ID of the user who is setting the albums.
 * @returns The result of the operation.
 */
export async function setAlbums(
  facilityCode: string,
  photoId: string,
  addAlbums: string[],
  delAlbums: string[],
  albumList: string[],
  userId: string
): Promise<any> {
  const nowISO = new Date().toISOString();
  const TransactItems: any[] = [];
  // アルバム追加
  for (const album of addAlbums) {
    // TransactItems.push({
    //   Put: {
    //     TableName: PhotoConfig.TABLE_NAME,
    //     Item: {
    //       pk: `FAC#${facilityCode}#PHOTO#${photoId}`,
    //       sk: album,
    //       albumId: album,
    //       createdAt: nowISO,
    //       createdBy: userId,
    //     },
    //   },
    // });
    TransactItems.push({
      Put: {
        TableName: PhotoConfig.TABLE_NAME,
        Item: {
          pk: `JOIN#ALBUM2PHOTO#FAC#${facilityCode}`,
          sk: `ALBUM#${album}#PHOTO#${photoId}`,
          lsi1: `PHOTO#${photoId}`,
          photoId: photoId,
          createdAt: nowISO,
          createdBy: userId,
        },
      },
    });
  }

  // アルバム削除
  for (const album of delAlbums) {
    // TransactItems.push({
    //   Delete: {
    //     TableName: PhotoConfig.TABLE_NAME,
    //     Key: {
    //       pk: `FAC#${facilityCode}#PHOTO#${photoId}`,
    //       sk: album,
    //     },
    //   },
    // });
    TransactItems.push({
      Delete: {
        TableName: PhotoConfig.TABLE_NAME,
        Key: {
          pk: `JOIN#ALBUM2PHOTO#FAC#${facilityCode}`,
          sk: `ALBUM#${album}#PHOTO#${photoId}`,
        },
      },
    });
  }

  let UpdateExpression = "SET #albums = :albums";
  let ExpressionAttributeNames: any = {
    "#albums": "albums",
  };
  let ExpressionAttributeValues: any = {
    ":albums": albumList,
  };
  // 削除有、かつアルバム設定無しの場合は、未割当状態(GSIに設定)にする
  if (delAlbums.length > 0 && albumList.length === 0) {
    // 現在の写真情報を取得
    const tmpPhoto = await get(facilityCode, photoId);
    if (!tmpPhoto) throw new Error("photo not found");

    UpdateExpression = "SET #lsi3 = :lsi3, #lsi4 = :lsi4 REMOVE #albums";
    ExpressionAttributeNames = {
      "#albums": "albums",
      "#lsi3": "lsi3",
      "#lsi4": "lsi4",
    };
    ExpressionAttributeValues = {
      ":lsi3": tmpPhoto.lsi1,
      ":lsi4": tmpPhoto.lsi2,
    };
    // 追加有の場合は、割当状態(GSIの削除)にする
  } else if (addAlbums.length > 0) {
    UpdateExpression = "SET #albums = :albums REMOVE #lsi3, #lsi4";
    ExpressionAttributeNames = {
      "#albums": "albums",
      "#lsi3": "lsi3",
      "#lsi4": "lsi4",
    };
    ExpressionAttributeValues = {
      ":albums": albumList,
    };
  }

  // META情報更新
  TransactItems.push({
    Update: {
      TableName: PhotoConfig.TABLE_NAME,
      Key: {
        pk: `PHOTO#FAC#${facilityCode}#META`,
        sk: photoId,
      },
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
    },
  });

  // コマンド実行
  const result = await docClient().send(
    new TransactWriteCommand({TransactItems: TransactItems})
  );
  return result;
}

export async function photoIdsByAlbumId(
  facilityCode: string,
  albumId: string
): Promise<any> {
  const command = new QueryCommand({
    TableName: PhotoConfig.TABLE_NAME,
    KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :sk)",
    ProjectionExpression: "#photoId",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#sk": "sk",
      "#photoId": "photoId",
    },
    ExpressionAttributeValues: {
      ":pk": `JOIN#ALBUM2PHOTO#FAC#${facilityCode}`,
      ":sk": `ALBUM#${albumId}#`,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  console.log("result", result);
  return result.Items?.map((item) => item.photoId);
}

export async function photoListBatchget(
  facilityCode: string,
  photoIds: string[]
): Promise<any> {
  const command = new BatchGetCommand({
    RequestItems: {
      [PhotoConfig.TABLE_NAME]: {
        Keys: photoIds.map((photoId) => {
          return {
            pk: `PHOTO#FAC#${facilityCode}#META`,
            sk: photoId,
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
  photoIds: string[]
): Promise<any[]> {
  if (photoIds.length === 0) return [];

  const tableName = PhotoConfig.TABLE_NAME;
  const pk = `PHOTO#FAC#${facilityCode}#META`;
  const allItems: any[] = [];

  // BatchGet は 1回100件まで
  const idChunks = chunk(photoIds, 100);

  for (const ids of idChunks) {
    let requestItems: Record<string, any> = {
      [tableName]: {
        Keys: ids.map((photoId) => ({pk, sk: photoId})),
      },
    };

    // UnprocessedKeys がなくなるまで繰り返す
    while (Object.keys(requestItems).length > 0) {
      const res = await docClient().send(
        new BatchGetCommand({RequestItems: requestItems})
      );
      allItems.push(...(res.Responses?.[tableName] ?? []));
      requestItems = res.UnprocessedKeys ?? {};
    }
  }

  return allItems;
}

export async function getPhotoByAlbumIdAndPhotoId(
  facilityCode: string,
  albumId: string,
  photoId: string
) {
  const command = new GetCommand({
    TableName: PhotoConfig.TABLE_NAME,
    Key: {
      pk: `JOIN#ALBUM2PHOTO#FAC#${facilityCode}`,
      sk: `ALBUM#${albumId}#PHOTO#${photoId}`,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Item;
}

export async function queryPhotos(
  keys: any,
  indexName: string,
  scanIndexForward: boolean,
  filter: FilterOptions,
  page: PageOptions = {}
): Promise<QueryCommandOutput> {
  // // 排他チェック（仕様通り）
  // if (shootingAt && createdAt) {
  //   throw new Error("shootingAt と createdAt は同時指定できません。");
  // }

  const ExpressionAttributeNames: Record<string, string> = {};
  const ExpressionAttributeValues: Record<string, any> = {};

  // ---- KeyConditionExpression ----
  const KeyConditionExpression = "#pk = :pk AND begins_with(#sk, :sk)";
  ExpressionAttributeNames["#pk"] = keys.pk.name;
  ExpressionAttributeValues[":pk"] = keys.pk.value;
  ExpressionAttributeNames["#sk"] = keys.sk.name;
  ExpressionAttributeValues[":sk"] = keys.sk.value;

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

  // status
  // lsi1、lsi2 で、ソートと一緒に判定する

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
    Limit: page.limit,
    // ExclusiveStartKey: exclusiveStartKey,
  };

  if (filters.length > 0) {
    input.FilterExpression = filters.join(" AND ");
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
  expiredAt: string
) {
  const nowISO = new Date().toISOString();
  const ttl = Math.floor(new Date(expiredAt).getTime() / 1000) + 15552000; // 有効期限切れの半年後にレコード消す

  // 25件ずつに分割
  const batches = chunk(photoIds, 25);

  // リトライ設定（必要に応じて調整）
  const MAX_RETRIES = 8; // 合計リトライ回数
  const BASE_DELAY_MS = 100; // 初期待ち
  const MAX_DELAY_MS = 3000; // 最大待ち

  for (const photoIdBatch of batches) {
    // 1バッチ分の PutRequest を作成
    let requestItems: Record<string, any>[] = photoIdBatch.map((photoId) => ({
      PutRequest: {
        Item: {
          pk: `FAC#${facilityCode}#USER#${userId}#DONWLOADACCEPT`,
          sk: `PHOTO#${photoId}`,
          facilityCode,
          photoId,
          expiredAt,
          ttl,
          createdAt: nowISO,
        },
      },
    }));

    // UnprocessedItems を拾いながらリトライ
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const command = new BatchWriteCommand({
        RequestItems: {
          [PhotoConfig.TABLE_NAME]: requestItems,
        },
      });

      const res = await docClient().send(command);

      const unprocessed = res.UnprocessedItems?.[PhotoConfig.TABLE_NAME] ?? [];
      if (unprocessed.length === 0) {
        // このバッチは全件完了
        break;
      }

      // 次の試行は未処理分だけ再送
      requestItems = unprocessed;

      // リトライ上限超え → 漏れを防ぐため例外
      if (attempt === MAX_RETRIES) {
        throw new Error(
          `BatchWriteCommand failed after retries. UnprocessedItems=${unprocessed.length} (table=${PhotoConfig.TABLE_NAME})`
        );
      }

      // 指数バックオフ + ジッター（軽くランダム）
      const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
      const jitter = Math.floor(Math.random() * 100);
      await sleep(exp + jitter);
    }
  }
}

export async function setFirstSoldAt(facilityCode: string, photoIds: string[]) {
  const nowISO = new Date().toISOString();

  for (const photoId of photoIds) {
    await docClient().send(
      new UpdateCommand({
        TableName: PhotoConfig.TABLE_NAME,
        Key: {
          pk: `PHOTO#FAC#${facilityCode}#META`,
          sk: photoId,
        },
        UpdateExpression:
          "SET #firstSoldAt = if_not_exists(#firstSoldAt, :now) REMOVE #gsi1pk, #gsi1sk",
        ExpressionAttributeNames: {
          "#firstSoldAt": "firstSoldAt",
          "#gsi1pk": "gsi1pk",
          "#gsi1sk": "gsi1sk",
        },
        ExpressionAttributeValues: {
          ":now": nowISO,
        },
      })
    );
  }
  // コマンド実行
}
