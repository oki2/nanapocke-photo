import {docClient} from "../dynamo";

import {
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {Setting} from "./Setting";

// ユーザー情報を取得する
export async function get(userSub: string): Promise<any> {
  const command = new GetCommand({
    TableName: Setting.TABLE_NAME_NANAPOCKE_USER,
    Key: {
      pk: "USER",
      sk: userSub,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Item;
}

// ユーザー情報を登録する
export async function create(
  userSub: string,
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
      TableName: Setting.TABLE_NAME_NANAPOCKE_USER,
      Item: {
        pk: "USER",
        sk: userSub,
        lsi1: `${facilityCode}#${userRole}`,
        userCode: userCode,
        userName: userName,
        userRole: userRole,
        facilityCode: facilityCode,
        status: Setting.STATUS.ACTIVE,
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
  userSub: string,
  userCode: string,
  now?: string
): Promise<Record<string, any>> {
  const nowISO = now ?? new Date().toISOString();
  return await docClient().send(
    new UpdateCommand({
      TableName: Setting.TABLE_NAME_NANAPOCKE_USER,
      Key: {
        pk: "USER",
        sk: userSub,
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
  userSub: string,
  userName: string,
  now?: string
): Promise<void> {
  const nowISO = now ?? new Date().toISOString();
  await docClient().send(
    new UpdateCommand({
      TableName: Setting.TABLE_NAME_NANAPOCKE_USER,
      Key: {
        pk: "USER",
        sk: userSub,
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
    TableName: Setting.TABLE_NAME_NANAPOCKE_USER,
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
      ":lsi1": `${facilityCode}#${Setting.ROLE.PHOTOGRAPHER}`,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Items;
}
