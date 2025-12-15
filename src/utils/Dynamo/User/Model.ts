import {docClient} from "../dynamo";

import {
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {UserConfig} from "../../../config";

// ユーザー情報を取得する
export async function get(userId: string): Promise<any> {
  const command = new GetCommand({
    TableName: UserConfig.TABLE_NAME,
    Key: {
      pk: "USER",
      sk: userId,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Item;
}

// ユーザー情報を登録する
export async function create(
  userId: string,
  userCode: string,
  userName: string,
  userRole: string,
  facilityCode: string,
  options: Record<string, any>,
  now?: string
) {
  const nowISO = now ?? new Date().toISOString();
  await docClient().send(
    new PutCommand({
      TableName: UserConfig.TABLE_NAME,
      Item: {
        pk: "USER",
        sk: userId,
        lsi1: `${facilityCode}#${userRole}`,
        userCode: userCode,
        userName: userName,
        userRole: userRole,
        facilityCode: facilityCode,
        status: UserConfig.STATUS.ACTIVE,
        createdAt: nowISO,
        updatedAt: nowISO,
        ...options,
      },
      ConditionExpression: "attribute_not_exists(pk)", // 重複登録抑制
    })
  );
}

// 最終ログイン日時の更新
export async function updateLastLoginAt(
  userId: string,
  userCode: string,
  now?: string
): Promise<Record<string, any>> {
  const nowISO = now ?? new Date().toISOString();
  return await docClient().send(
    new UpdateCommand({
      TableName: UserConfig.TABLE_NAME,
      Key: {
        pk: "USER",
        sk: userId,
      },
      UpdateExpression: "set #lastLoginAt = :lastLoginAt",
      ConditionExpression: "#userCode = :userCode", // レコードが存在しない場合は登録しないように、必要な項目を指定する
      ExpressionAttributeNames: {
        "#lastLoginAt": "lastLoginAt",
        "#userCode": "userCode",
      },
      ExpressionAttributeValues: {
        ":lastLoginAt": nowISO,
        ":userCode": userCode,
      },
      ReturnValues: "ALL_NEW",
    })
  );
}

// ユーザー名の更新
export async function updateUserName(
  userId: string,
  userName: string,
  now?: string
): Promise<void> {
  const nowISO = now ?? new Date().toISOString();
  await docClient().send(
    new UpdateCommand({
      TableName: UserConfig.TABLE_NAME,
      Key: {
        pk: "USER",
        sk: userId,
      },
      UpdateExpression: "set #userName = :userName, #updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#userName": "userName",
        "#updatedAt": "updatedAt",
      },
      ExpressionAttributeValues: {
        ":userName": userName,
        ":updatedAt": nowISO,
      },
    })
  );
}

export async function photographerList(facilityCode: string): Promise<any> {
  const command = new QueryCommand({
    TableName: UserConfig.TABLE_NAME,
    IndexName: "lsi1_index",
    KeyConditionExpression: "#pk = :pk AND #lsi1 = :lsi1",
    ProjectionExpression:
      "#sk, #userCode, #userName, #nbf, #exp, #status, #createdAt, #updatedAt",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#lsi1": "lsi1",
      "#sk": "sk",
      "#userCode": "userCode",
      "#userName": "userName",
      "#nbf": "nbf",
      "#exp": "exp",
      "#status": "status",
      "#createdAt": "createdAt",
      "#updatedAt": "updatedAt",
    },
    ExpressionAttributeValues: {
      ":pk": "USER",
      ":lsi1": `${facilityCode}#${UserConfig.ROLE.PHOTOGRAPHER}`,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Items;
}
