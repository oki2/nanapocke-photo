import {docClient} from "../dynamo";
import {
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {Setting} from "./Setting";

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
      TableName: Setting.TABLE_NAME_MAIN,
      Item: {
        pk: `FAC#${facilityCode}#ALBUM#META`,
        sk: albumId,
        facilityCode: facilityCode,
        albumId: albumId,
        seq: seq,
        title: title,
        description: description,
        priceTable: priceTable,
        nbf: nbf,
        exp: exp,
        salesStatus: Setting.SALES_STATUS.STOPPED,
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
    TableName: Setting.TABLE_NAME_MAIN,
    KeyConditionExpression: "#pk = :pk",
    ProjectionExpression:
      "#sk, #albumId, #seq, #title, #description, #priceTable, #nbf, #exp, #salesStatus, #createdAt, #createdBy, #updatedAt, #updatedBy",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#sk": "sk",
      "#albumId": "albumId",
      "#seq": "seq",
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
  name: string,
  description: string,
  nbf: string,
  exp: string
): Promise<Record<string, any> | undefined> {
  const nowISO = new Date().toISOString();

  // コマンド生成
  const command = new UpdateCommand({
    TableName: Setting.TABLE_NAME_MAIN,
    Key: {
      pk: `FAC#${facilityCode}#ALBUM#META`,
      sk: albumId,
    },
    UpdateExpression: `SET #name = :name, #description = :description, #nbf = :nbf, #exp = :exp, #updatedAt = :updatedAt, #updatedBy = :updatedBy`,
    ConditionExpression: "#salesStatus = :salesStatus",
    ExpressionAttributeNames: {
      "#name": "name",
      "#description": "description",
      "#nbf": "nbf",
      "#exp": "exp",
      "#salesStatus": "salesStatus",
      "#updatedAt": "updatedAt",
      "#updatedBy": "updatedBy",
    },
    ExpressionAttributeValues: {
      ":name": name,
      ":description": description,
      ":nbf": nbf,
      ":exp": exp,
      ":salesStatus": Setting.SALES_STATUS.STOPPED,
      ":updatedAt": nowISO,
      ":updatedBy": userId,
    },
    ReturnValues: "ALL_NEW",
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Attributes;
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
      TableName: Setting.TABLE_NAME_MAIN,
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
    TableName: Setting.TABLE_NAME_MAIN,
    Key: {
      pk: `FAC#${facilityCode}#SEQ`,
      sk: `ALBUM#COUNTER`,
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
