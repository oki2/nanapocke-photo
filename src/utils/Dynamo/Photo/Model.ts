import {docClient} from "../dynamo";
import {
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {Setting} from "./Setting";

export async function get(
  facilityCode: string,
  photoId: string
): Promise<Record<string, any> | undefined> {
  const command = new GetCommand({
    TableName: Setting.TABLE_NAME_MAIN,
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
  valueType: string,
  tags: string[]
): Promise<string> {
  const nowISO = new Date().toISOString();
  const photoId = crypto.randomUUID();

  const seq = await nextSequence(facilityCode);
  console.log("next seq", seq);

  // コマンド実行
  const result = await docClient().send(
    new PutCommand({
      TableName: Setting.TABLE_NAME_MAIN,
      Item: {
        pk: `FAC#${facilityCode}#PHOTO#META`,
        sk: photoId,
        facilityCode: facilityCode,
        photoId: photoId,
        shootingAt: shootingAt,
        valueType: valueType,
        tags: tags,
        seq: seq,
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
      pk: `FAC#${facilityCode}#PHOTO#META`,
      sk: photoId,
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
      "#sk, #photoId, #seq, #facilityCode, #status, #tags, #valueType, #shootingAt, #width, #height, #createdAt, #createdBy, #updatedAt, #updatedBy",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#sk": "sk",
      "#photoId": "photoId",
      "#seq": "seq",
      "#facilityCode": "facilityCode",
      "#status": "status",
      "#tags": "tags",
      "#valueType": "valueType",
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
    TableName: Setting.TABLE_NAME_MAIN,
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
