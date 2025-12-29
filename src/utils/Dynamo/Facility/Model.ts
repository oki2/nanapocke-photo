import {docClient} from "../dynamo";
import {
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
  BatchWriteCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {FacilityConfig} from "../../../config";

type ClassData = {
  code: string;
  name: string;
  grade: string;
};
export async function create(
  code: string,
  name: string,
  nbf: string,
  exp: string,
  classList: ClassData[],
  userId: string
): Promise<void> {
  const nowISO = new Date().toISOString();

  const TransactItems: any[] = [];

  TransactItems.push({
    Put: {
      TableName: FacilityConfig.TABLE_NAME,
      Item: {
        pk: "FACILITY",
        sk: code,
        code: code,
        name: name,
        nbf: nbf,
        exp: exp,
        status: FacilityConfig.STATUS.ACTIVE,
        createdAt: nowISO,
        createdBy: userId,
        updatedAt: nowISO,
        updatedBy: userId,
      },
    },
  });

  for (const data of classList) {
    TransactItems.push({
      Put: {
        TableName: FacilityConfig.TABLE_NAME,
        Item: {
          pk: `FACILITY#${code}#CLASS`,
          sk: data.code,
          facilityCode: code,
          classCode: data.code,
          className: data.name,
          gradeCode: data.grade,
          lsi1: data.grade,
          createdAt: nowISO,
          createdBy: userId,
        },
      },
    });
  }

  // コマンド実行
  const result = await docClient().send(
    new TransactWriteCommand({TransactItems: TransactItems})
  );
}

export async function list(): Promise<any> {
  const command = new QueryCommand({
    TableName: FacilityConfig.TABLE_NAME,
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
    TableName: FacilityConfig.TABLE_NAME,
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

export async function get(
  code: string
): Promise<Record<string, any> | undefined> {
  const command = new GetCommand({
    TableName: FacilityConfig.TABLE_NAME,
    Key: {
      pk: "FACILITY",
      sk: code,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Item;
}

// クラス管理 ===========================================
export async function classList(facilityCode: string): Promise<any> {
  const command = new QueryCommand({
    TableName: FacilityConfig.TABLE_NAME,
    KeyConditionExpression: "#pk = :pk",
    IndexName: "lsi1_index",
    ProjectionExpression:
      "#sk, #classCode, #className, #gradeCode, #createdAt, #createdBy",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#sk": "sk",
      "#classCode": "classCode",
      "#className": "className",
      "#gradeCode": "gradeCode",
      "#createdAt": "createdAt",
      "#createdBy": "createdBy",
    },
    ExpressionAttributeValues: {
      ":pk": `FACILITY#${facilityCode}#CLASS`,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Items;
}

export async function addClass(
  facilityCode: string,
  classList: ClassData[],
  userId: string
): Promise<void> {
  const nowISO = new Date().toISOString();

  // タグを全て保存する（BatchWriteで実行）
  const requestItems = classList.map((data) => ({
    PutRequest: {
      Item: {
        pk: `FACILITY#${facilityCode}#CLASS`,
        sk: data.code,
        facilityCode: facilityCode,
        classCode: data.code,
        gradeCode: data.grade,
        lsi1: data.grade,
        createdAt: nowISO,
        createdBy: userId,
      },
    },
  }));
  const command = new BatchWriteCommand({
    RequestItems: {
      [FacilityConfig.TABLE_NAME]: requestItems,
    },
  });

  // コマンド実行
  await docClient().send(command);
}
