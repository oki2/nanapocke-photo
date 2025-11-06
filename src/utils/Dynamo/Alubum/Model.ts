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
  name: string,
  description: string,
  nbf: string,
  exp: string
): Promise<Record<string, any>> {
  const nowISO = new Date().toISOString();
  const id = crypto.randomUUID();

  // コマンド実行
  const result = await docClient().send(
    new PutCommand({
      TableName: Setting.TABLE_NAME_MAIN,
      Item: {
        pk: `ALBUM#${facilityCode}`,
        sk: id,
        facilityCode: facilityCode,
        albumId: id,
        name: name,
        description: description,
        nbf: nbf,
        exp: exp,
        status: Setting.STATUS.INACTIVE,
        createdAt: nowISO,
        createdBy: userId,
        updatedAt: nowISO,
        updatedBy: userId,
      },
      ConditionExpression: "attribute_not_exists(pk)", // 重複登録抑制
    })
  );

  return {
    albumId: id,
    name: name,
  };
}

export async function list(facilityCode: string): Promise<any> {
  const command = new QueryCommand({
    TableName: Setting.TABLE_NAME_MAIN,
    KeyConditionExpression: "#pk = :pk",
    ProjectionExpression:
      "#sk, #albumId, #name, #nbf, #exp, #status, #createdAt, #updatedAt",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#sk": "sk",
      "#albumId": "albumId",
      "#name": "name",
      "#description": "description",
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
