import {docClient} from "../dynamo";
import {
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {AlbumConfig} from "../../../config";

export async function create(
  facilityCode: string,
  userId: string,
  title: string,
  description: string,
  priceTable: string,
  nbf: string | undefined,
  exp: string | undefined
): Promise<Record<string, any>> {
  const nowISO = new Date().toISOString();
  const albumId = crypto.randomUUID();
  const seq = await nextSequence(facilityCode);

  // コマンド実行
  const result = await docClient().send(
    new PutCommand({
      TableName: AlbumConfig.TABLE_NAME,
      Item: {
        pk: `FAC#${facilityCode}#ALBUM#META`,
        sk: albumId,
        lsi1: nowISO,
        facilityCode: facilityCode,
        albumId: albumId,
        sequenceId: seq,
        title: title,
        description: description,
        priceTable: priceTable,
        nbf: nbf,
        exp: exp,
        salesStatus: AlbumConfig.SALES_STATUS.DRAFT,
        createdAt: nowISO,
        createdBy: userId,
        updatedAt: nowISO,
        updatedBy: userId,
      },
      ConditionExpression: "attribute_not_exists(pk)", // 重複登録抑制
    })
  );

  return {
    albumId: albumId,
    title: title,
  };
}

export async function list(facilityCode: string): Promise<any> {
  const command = new QueryCommand({
    TableName: AlbumConfig.TABLE_NAME,
    IndexName: "lsi1_index",
    ScanIndexForward: false,
    KeyConditionExpression: "#pk = :pk",
    ProjectionExpression:
      "#sk, #albumId, #sequenceId, #title, #description, #priceTable, #nbf, #exp, #salesStatus, #createdAt, #createdBy, #updatedAt, #updatedBy",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#sk": "sk",
      "#albumId": "albumId",
      "#sequenceId": "sequenceId",
      "#title": "title",
      "#description": "description",
      "#priceTable": "priceTable",
      "#nbf": "nbf",
      "#exp": "exp",
      "#salesStatus": "salesStatus",
      "#createdAt": "createdAt",
      "#createdBy": "createdBy",
      "#updatedAt": "updatedAt",
      "#updatedBy": "updatedBy",
    },
    ExpressionAttributeValues: {
      ":pk": `FAC#${facilityCode}#ALBUM#META`,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Items;
}

export async function update(
  facilityCode: string,
  albumId: string,
  userId: string,
  title: string,
  description: string,
  priceTable: string,
  nbf: string,
  exp: string
): Promise<boolean> {
  const nowISO = new Date().toISOString();

  // コマンド生成
  const command = new UpdateCommand({
    TableName: AlbumConfig.TABLE_NAME,
    Key: {
      pk: `FAC#${facilityCode}#ALBUM#META`,
      sk: albumId,
    },
    UpdateExpression: `SET #title = :title, #description = :description, #priceTable = :priceTable, #nbf = :nbf, #exp = :exp, #updatedAt = :updatedAt, #updatedBy = :updatedBy`,
    ConditionExpression: "#salesStatus = :salesStatus",
    ExpressionAttributeNames: {
      "#title": "title",
      "#description": "description",
      "#priceTable": "priceTable",
      "#nbf": "nbf",
      "#exp": "exp",
      "#salesStatus": "salesStatus",
      "#updatedAt": "updatedAt",
      "#updatedBy": "updatedBy",
    },
    ExpressionAttributeValues: {
      ":title": title,
      ":description": description,
      ":priceTable": priceTable,
      ":nbf": nbf,
      ":exp": exp,
      ":salesStatus": AlbumConfig.SALES_STATUS.DRAFT,
      ":updatedAt": nowISO,
      ":updatedBy": userId,
    },
  });

  // コマンド実行
  await docClient().send(command);
  return true;
}

export async function setPhoto(
  facilityCode: string,
  userId: string,
  albumId: string,
  photoId: string
): Promise<void> {
  const nowISO = new Date().toISOString();

  // コマンド実行
  const result = await docClient().send(
    new PutCommand({
      TableName: AlbumConfig.TABLE_NAME,
      Item: {
        pk: `FAC#${facilityCode}#ALBUM#PHOTO`,
        sk: `ALBUM#${albumId}#PHOTO#${photoId}`,
        lsi1: photoId,
        facilityCode: facilityCode,
        albumId: albumId,
        photoId: photoId,
        createdAt: nowISO,
        createdBy: userId,
      },
      // ConditionExpression: "attribute_not_exists(pk)", // 重複登録抑制
    })
  );

  return;
}

async function nextSequence(facilityCode: string): Promise<number> {
  const command = new UpdateCommand({
    TableName: AlbumConfig.TABLE_NAME,
    Key: {
      pk: `FAC#${facilityCode}#SEQ`,
      sk: `ALBUM#COUNTER`,
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
