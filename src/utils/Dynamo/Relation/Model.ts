/**
 * アルバムと写真のリレーション管理
 * lsi1 : PhotoID 絞込み用
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
import {RelationConfig} from "../../../config";

export type SetAlbumsOneParamsT = {
  facilityCode: string;
  photoId: string;
  addAlbums: string[]; // 追加したい albumId
  delAlbums: string[]; // 削除したい albumId
  userId: string;
};

const getPk = (facilityCode: string) => `FAC#${facilityCode}#ALBUM2PHOTO`;
const getSk = (albumId: string, photoId: string) =>
  `ALBUM#${albumId}#PHOTO#${photoId}`;

export async function update(p: SetAlbumsOneParamsT) {
  const nowISO = new Date().toISOString();
  const reqs: Array<{PutRequest?: any; DeleteRequest?: any}> = [];

  // 追加関連
  for (const albumId of p.addAlbums) {
    reqs.push({
      PutRequest: {
        Item: {
          pk: getPk(p.facilityCode),
          sk: getSk(albumId, p.photoId),
          lsi1: `PHOTO#${p.photoId}`,
          photoId: p.photoId,
          albumId: albumId,
          createdAt: nowISO,
          createdBy: p.userId,
        },
      },
    });
  }

  // 削除関連
  for (const albumId of p.delAlbums) {
    reqs.push({
      DeleteRequest: {
        Key: {
          pk: getPk(p.facilityCode),
          sk: getSk(albumId, p.photoId),
        },
      },
    });
  }

  // JOIN更新が無ければ飛ばす
  if (reqs.length > 0) {
    await batchWriteAll(RelationConfig.TABLE_NAME, reqs, docClient());
  }
}

export async function getAlbumIds(facilityCode: string, photoId: string) {
  const joinRes = await docClient().send(
    new QueryCommand({
      TableName: RelationConfig.TABLE_NAME,
      IndexName: "lsi1_index",
      KeyConditionExpression: "#pk = :pk AND #lsi1 = :lsi1",
      ProjectionExpression: "#albumId",
      ExpressionAttributeNames: {
        "#pk": "pk",
        "#lsi1": "lsi1",
        "#albumId": "albumId",
      },
      ExpressionAttributeValues: {
        ":pk": getPk(facilityCode),
        ":lsi1": `PHOTO#${photoId}`,
      },
    }),
  );
  console.log("joinRes", joinRes);

  return (joinRes.Items ?? []).map((it: any) => it.albumId);
}

export async function deleteRelationPhotoAlbums(
  facilityCode: string,
  photoId: string,
) {
  // 1. アルバムの紐付け情報を取得
  const joinPk = getPk(facilityCode);
  const delList = await docClient().send(
    new QueryCommand({
      TableName: RelationConfig.TABLE_NAME,
      IndexName: "lsi1_index",
      KeyConditionExpression: "#pk = :pk AND #lsi1 = :lsi1",
      ProjectionExpression: "#sk",
      ExpressionAttributeNames: {
        "#pk": "pk",
        "#sk": "sk",
        "#lsi1": "lsi1",
      },
      ExpressionAttributeValues: {
        ":pk": joinPk,
        ":lsi1": `PHOTO#${photoId}`,
      },
    }),
  );

  // 2. アルバムの紐付けを削除
  const reqs: Array<{PutRequest?: any; DeleteRequest?: any}> = [];
  for (const item of delList.Items ?? []) {
    reqs.push({
      DeleteRequest: {
        Key: {
          pk: joinPk,
          sk: item.sk,
        },
      },
    });
  }
  if (reqs.length > 0) {
    await batchWriteAll(RelationConfig.TABLE_NAME, reqs, docClient());
  }
}

export async function getPhotoIdsByAlbumId(
  facilityCode: string,
  albumId: string,
): Promise<any> {
  const command = new QueryCommand({
    TableName: RelationConfig.TABLE_NAME,
    KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :sk)",
    ProjectionExpression: "#photoId",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#sk": "sk",
      "#photoId": "photoId",
    },
    ExpressionAttributeValues: {
      ":pk": getPk(facilityCode),
      ":sk": `ALBUM#${albumId}#`,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  console.log("result", result);
  return result.Items?.map((item) => item.photoId);
}

export async function getPhotoByAlbumIdAndPhotoId(
  facilityCode: string,
  albumId: string,
  photoId: string,
) {
  const command = new GetCommand({
    TableName: RelationConfig.TABLE_NAME,
    Key: {
      pk: getPk(facilityCode),
      sk: getSk(albumId, photoId),
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Item;
}

export async function photoCount(
  facilityCode: string,
  albumId: string,
): Promise<number> {
  // コマンド実行
  const result = await docClient().send(
    new QueryCommand({
      TableName: RelationConfig.TABLE_NAME,
      KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :sk)",
      Select: "COUNT",
      ExpressionAttributeNames: {
        "#pk": "pk",
        "#sk": "sk",
      },
      ExpressionAttributeValues: {
        ":pk": getPk(facilityCode),
        ":sk": `ALBUM#${albumId}#`,
      },
    }),
  );
  return result.Count ?? 0;
}
