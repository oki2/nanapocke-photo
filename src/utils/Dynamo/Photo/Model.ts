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
  shootingAt: string,
  valueType: string,
  tags: string[]
): Promise<string> {
  const nowISO = new Date().toISOString();
  const photoId = crypto.randomUUID();

  // コマンド実行
  const result = await docClient().send(
    new PutCommand({
      TableName: Setting.TABLE_NAME_MAIN,
      Item: {
        pk: `PHOTO#${facilityCode}`,
        sk: `META#${photoId}`,
        facilityCode: facilityCode,
        shootingAt: shootingAt,
        valueType: valueType,
        tags: tags,
        status: Setting.PHOTO_STATUS.INACTIVE,
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
  valueType: string,
  tags: string[]
): Promise<string> {
  const nowISO = new Date().toISOString();
  const photoId = crypto.randomUUID();

  // コマンド実行
  const result = await docClient().send(
    new PutCommand({
      TableName: Setting.TABLE_NAME_MAIN,
      Item: {
        pk: `PHOTOZIP#${facilityCode}`,
        sk: `META#${photoId}`,
        facilityCode: facilityCode,
        shootingAt: shootingAt,
        valueType: valueType,
        tags: tags,
        status: Setting.PHOTO_STATUS.INACTIVE,
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
  height: number
): Promise<Record<string, any> | undefined> {
  // コマンド生成
  const nowISO = new Date().toISOString();
  const command = new UpdateCommand({
    TableName: Setting.TABLE_NAME_MAIN,
    Key: {
      pk: `PHOTO#${facilityCode}`,
      sk: `META#${photoId}`,
    },
    UpdateExpression: `SET #status = :status, #width = :width, #height = :height, #updatedAt = :updatedAt`,
    ExpressionAttributeNames: {
      "#status": "status",
      "#width": "width",
      "#height": "height",
      "#updatedAt": "updatedAt",
    },
    ExpressionAttributeValues: {
      ":status": Setting.PHOTO_STATUS.INACTIVE,
      ":width": width,
      ":height": height,
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
    TableName: Setting.TABLE_NAME_MAIN,
    KeyConditionExpression: "#pk = :pk",
    ProjectionExpression:
      "#sk, #albumId, #title, #description, #priceTable, #nbf, #exp, #status, #createdAt, #createdBy, #updatedAt, #updatedBy",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#sk": "sk",
      "#albumId": "albumId",
      "#title": "title",
      "#description": "description",
      "#priceTable": "priceTable",
      "#nbf": "nbf",
      "#exp": "exp",
      "#status": "status",
      "#createdAt": "createdAt",
      "#createdBy": "createdBy",
      "#updatedAt": "updatedAt",
      "#updatedBy": "updatedBy",
    },
    ExpressionAttributeValues: {
      ":pk": `ALBUM#${facilityCode}`,
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
  exp: string,
  status: string
): Promise<Record<string, any> | undefined> {
  const nowISO = new Date().toISOString();

  // コマンド生成
  const command = new UpdateCommand({
    TableName: Setting.TABLE_NAME_MAIN,
    Key: {
      pk: `ALBUM#${facilityCode}`,
      sk: albumId,
    },
    UpdateExpression: `SET #name = :name, #description = :description, #nbf = :nbf, #exp = :exp, #status = :status, #updatedAt = :updatedAt, #updatedBy = :updatedBy`,
    ExpressionAttributeNames: {
      "#name": "name",
      "#description": "description",
      "#nbf": "nbf",
      "#exp": "exp",
      "#status": "status",
      "#updatedAt": "updatedAt",
      "#updatedBy": "updatedBy",
    },
    ExpressionAttributeValues: {
      ":name": name,
      ":description": description,
      ":nbf": nbf,
      ":exp": exp,
      ":status": status,
      ":updatedAt": nowISO,
      ":updatedBy": userId,
    },
    ReturnValues: "ALL_NEW",
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Attributes;
}
