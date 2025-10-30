import {docClient} from "../dynamo";

import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  // GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {Setting} from "./Setting";

export async function create(
  code: string,
  name: string,
  nbf: string,
  exp: string
): Promise<Record<string, any>> {
  const nowISO = new Date().toISOString();

  // コマンド生成
  const command = new PutCommand({
    TableName: Setting.TABLE_NAME_MAIN,
    Item: {
      pk: "FACILITY",
      sk: code,
      code: code,
      name: name,
      nbf: nbf,
      exp: exp,
      status: Setting.STATUS.ACTIVE,
      createdAt: nowISO,
      updatedAt: nowISO,
    },
    ConditionExpression: "attribute_not_exists(pk)", // 重複登録抑制
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.$metadata.httpStatusCode == 200
    ? {
        code: code,
        name: name,
        nbf: nbf,
        exp: exp,
        status: Setting.STATUS.ACTIVE,
        createdAt: nowISO,
        updatedAt: nowISO,
      }
    : {};
}

export async function list(): Promise<any> {
  const command = new QueryCommand({
    TableName: Setting.TABLE_NAME_MAIN,
    KeyConditionExpression: "#pk = :pk",
    ProjectionExpression:
      "#sk, #code, #name, #nbf, #exp, #status, #createdAt, #updatedAt",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#sk": "sk",
      "#code": "code",
      "#name": "name",
      "#nbf": "nbf",
      "#exp": "exp",
      "#status": "status",
      "#createdAt": "createdAt",
      "#updatedAt": "updatedAt",
    },
    ExpressionAttributeValues: {
      ":pk": "FACILITY",
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Items;
}

export async function update(
  code: string,
  name: string | undefined,
  nbf: string | undefined,
  exp: string | undefined,
  status: string | undefined
): Promise<Record<string, any> | undefined> {
  const nowISO = new Date().toISOString();

  const updates: Record<string, any> = {
    name,
    nbf,
    exp,
    status,
    updatedAt: nowISO,
  };
  const validUpdates = Object.entries(updates).filter(
    ([, value]) => value !== undefined
  );

  if (validUpdates.length === 0) {
    console.log("No fields to update");
    return undefined;
  }

  // UpdateExpression を動的生成
  const updateExpr = validUpdates
    .map(([key]) => `#${key} = :${key}`)
    .join(", ");

  // ExpressionAttributeNames を動的生成
  const exprNames = Object.fromEntries(
    validUpdates.map(([key]) => [`#${key}`, key])
  );

  // ExpressionAttributeValues を動的生成
  const exprValues = Object.fromEntries(
    validUpdates.map(([key, value]) => [`:${key}`, value])
  );

  // コマンド生成
  const command = new UpdateCommand({
    TableName: Setting.TABLE_NAME_MAIN,
    Key: {
      pk: "FACILITY",
      sk: code,
    },
    UpdateExpression: `SET ${updateExpr}`,
    ExpressionAttributeNames: exprNames,
    ExpressionAttributeValues: exprValues,
    ReturnValues: "ALL_NEW",
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Attributes;
}
