import {docClient} from "../dynamo";
import {
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
  BatchGetCommand,
  BatchWriteCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {PhotoConfig} from "../../../config";

export async function get(
  facilityCode: string,
  photoId: string
): Promise<Record<string, any> | undefined> {
  const command = new GetCommand({
    TableName: PhotoConfig.TABLE_NAME,
    Key: {
      pk: `FAC#${facilityCode}#PHOTO#META`,
      sk: photoId,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Item;
}

export async function create(
  facilityCode: string,
  userId: string,
  shootingAt: string,
  priceTier: string,
  tags: string[]
): Promise<string> {
  const nowISO = new Date().toISOString();
  const photoId = crypto.randomUUID();

  const seq = await nextSequence(facilityCode);
  console.log("next seq", seq);

  // コマンド実行
  const result = await docClient().send(
    new PutCommand({
      TableName: PhotoConfig.TABLE_NAME,
      Item: {
        pk: `FAC#${facilityCode}#PHOTO#META`,
        sk: photoId,
        facilityCode: facilityCode,
        photoId: photoId,
        shootingAt: shootingAt,
        priceTier: priceTier,
        tags: tags,
        seq: seq,
        status: PhotoConfig.STATUS.CREATE,
        createdAt: nowISO,
        createdBy: userId,
        updatedAt: nowISO,
        updatedBy: userId,
      },
      ConditionExpression: "attribute_not_exists(pk)", // 重複登録抑制
    })
  );

  return photoId;
}

export async function createZip(
  facilityCode: string,
  userId: string,
  shootingAt: string,
  priceTier: string,
  tags: string[]
): Promise<string> {
  const nowISO = new Date().toISOString();
  const photoId = crypto.randomUUID();

  // コマンド実行
  const result = await docClient().send(
    new PutCommand({
      TableName: PhotoConfig.TABLE_NAME,
      Item: {
        pk: `PHOTOZIP#${facilityCode}`,
        sk: `META#${photoId}`,
        facilityCode: facilityCode,
        shootingAt: shootingAt,
        priceTier: priceTier,
        tags: tags,
        status: PhotoConfig.STATUS.CREATE,
        createdAt: nowISO,
        createdBy: userId,
        updatedAt: nowISO,
        updatedBy: userId,
      },
      ConditionExpression: "attribute_not_exists(pk)", // 重複登録抑制
    })
  );

  return photoId;
}

export async function setPhotoMeta(
  facilityCode: string,
  photoId: string,
  width: number,
  height: number,
  shootingAt: string
): Promise<Record<string, any> | undefined> {
  // コマンド生成
  const nowISO = new Date().toISOString();
  const command = new UpdateCommand({
    TableName: PhotoConfig.TABLE_NAME,
    Key: {
      pk: `FAC#${facilityCode}#PHOTO#META`,
      sk: photoId,
    },
    UpdateExpression: `SET #status = :status, #width = :width, #height = :height, #shootingAt = :shootingAt, #updatedAt = :updatedAt`,
    ExpressionAttributeNames: {
      "#status": "status",
      "#width": "width",
      "#height": "height",
      "#shootingAt": "shootingAt",
      "#updatedAt": "updatedAt",
    },
    ExpressionAttributeValues: {
      ":status": PhotoConfig.STATUS.ACTIVE,
      ":width": width,
      ":height": height,
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
      "#sk, #photoId, #seq, #facilityCode, #status, #tags, #priceTier, #shootingAt, #width, #height, #createdAt, #createdBy, #updatedAt, #updatedBy",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#sk": "sk",
      "#photoId": "photoId",
      "#seq": "seq",
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
      ":pk": `FAC#${facilityCode}#PHOTO#META`,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Items;
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
      pk: `FAC#${facilityCode}#SEQ`,
      sk: `PHOTO#COUNTER`,
    },
    // seq を 1 加算（存在しなければ 1 で作られる）
    UpdateExpression: "ADD #seq :inc",
    ExpressionAttributeNames: {
      "#seq": "seq",
    },
    ExpressionAttributeValues: {
      ":inc": 1,
    },
    ReturnValues: "UPDATED_NEW",
  });

  // コマンド実行
  const result = await docClient().send(command);
  const value = result.Attributes?.seq;
  if (!value) throw new Error("seq not returned");
  return value;
}

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
    TransactItems.push({
      Put: {
        TableName: PhotoConfig.TABLE_NAME,
        Item: {
          pk: `FAC#${facilityCode}#PHOTO#${photoId}`,
          sk: album,
          albumId: album,
          createdAt: nowISO,
          createdBy: userId,
        },
      },
    });
    TransactItems.push({
      Put: {
        TableName: PhotoConfig.TABLE_NAME,
        Item: {
          pk: `FAC#${facilityCode}#ALBUM#${album}`,
          sk: photoId,
          photoId: photoId,
          createdAt: nowISO,
          createdBy: userId,
        },
      },
    });
  }

  // アルバム削除
  for (const album of delAlbums) {
    TransactItems.push({
      Delete: {
        TableName: PhotoConfig.TABLE_NAME,
        Key: {
          pk: `FAC#${facilityCode}#PHOTO#${photoId}`,
          sk: album,
        },
      },
    });
    TransactItems.push({
      Delete: {
        TableName: PhotoConfig.TABLE_NAME,
        Key: {
          pk: `FAC#${facilityCode}#ALBUM#${album}`,
          sk: photoId,
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
    UpdateExpression =
      "SET #gsi1pk = :gsi1pk, #gsi1sk = :gsi1sk, #gsi2pk = :gsi2pk, #gsi2sk = :gsi2sk REMOVE #albums";
    ExpressionAttributeNames = {
      "#albums": "albums",
      "#gsi1pk": "gsi1pk",
      "#gsi1sk": "gsi1si",
      "#gsi2pk": "gsi2pk",
      "#gsi2sk": "gsi2sk",
    };
    ExpressionAttributeValues = {
      ":gsi1pk": "UPpk",
      ":gsi1sk": "UPsk",
      ":gsi2pk": "SHOTpk",
      ":gsi2sk": "SHOTsk",
    };
    // 追加有の場合は、割当状態(GSIの削除)にする
  } else if (addAlbums.length > 0) {
    UpdateExpression =
      "SET #albums = :albums REMOVE #gsi1pk, #gsi1sk, #gsi2pk, #gsi2sk";
    ExpressionAttributeNames = {
      "#albums": "albums",
      "#gsi1pk": "gsi1pk",
      "#gsi1sk": "gsi1si",
      "#gsi2pk": "gsi2pk",
      "#gsi2sk": "gsi2sk",
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
        pk: `FAC#${facilityCode}#PHOTO#META`,
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
    KeyConditionExpression: "#pk = :pk",
    ProjectionExpression: "#photoId",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#photoId": "photoId",
    },
    ExpressionAttributeValues: {
      ":pk": `FAC#${facilityCode}#ALBUM#${albumId}`,
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
            pk: `FAC#${facilityCode}#PHOTO#META`,
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
  const pk = `FAC#${facilityCode}#PHOTO#META`;
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

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};
