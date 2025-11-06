import {docClient} from "../dynamo";

import {
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {Setting} from "./Setting";

export async function signin(
  userSub: string,
  userCode: string,
  userName: string,
  userRole: string,
  facilityCode: string
): Promise<void> {
  const nowISO = new Date().toISOString();

  try {
    // 先ずは最終ログイン日時を更新する
    const result = await docClient().send(
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
    console.log(result);

    // もし userName が変わっていたら、更新する
    if (result.Attributes?.userName !== userName) {
      console.log(`update userName : ${userName}`);
      await docClient().send(
        new UpdateCommand({
          TableName: Setting.TABLE_NAME_NANAPOCKE_USER,
          Key: {
            pk: "USER",
            sk: userSub,
          },
          UpdateExpression:
            "set #userName = :userName, #updatedAt = :updatedAt",
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
  } catch (e: any) {
    console.log(e);
    if (e.name !== "ConditionalCheckFailedException") throw e;

    // アカウント情報が存在しない場合は登録する
    console.log(`account not found : create new account : ${userSub}`);
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
          createdAt: nowISO,
          updatedAt: nowISO,
          lastLoginAt: nowISO,
        },
        ConditionExpression: "attribute_not_exists(pk)", // 重複登録抑制
      })
    );
  }
}

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

export async function create(
  userSub: string,
  userCode: string,
  userName: string,
  userRole: string,
  facilityCode: string,
  options: Record<string, any>
) {
  const nowISO = new Date().toISOString();

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
