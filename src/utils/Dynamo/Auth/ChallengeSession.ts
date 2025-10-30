import {docClient} from "../dynamo";

import {
  PutCommand,
  // GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {Setting} from "./Setting";
import * as crypto from "crypto";

export async function put(session: string): Promise<string | undefined> {
  const flowId = crypto
    .randomBytes(Setting.FLOW_ID_LENGTH)
    .toString("base64url");
  const now = new Date();
  const createdAt = now.toISOString();
  const ttl =
    Math.floor(now.getTime() / 1000) + Setting.CHALLENGE_SESSION_EXPIRATION; // ミリ秒から秒に変換し、10分後まで有効とする

  // コマンド生成
  const command = new PutCommand({
    TableName: Setting.TABLE_NAME_AUTHFLOW,
    Item: {
      pk: "CHALLENGE#SESSION",
      sk: flowId,
      session: session,
      ttl: ttl,
      createdAt: createdAt,
    },
    ConditionExpression: "attribute_not_exists(pk)", // 重複登録抑制
  });

  // コマンド実行
  const response = await docClient().send(command);
  return response.$metadata.httpStatusCode == 200 ? flowId : undefined;
}

export async function get(flowId: string): Promise<string | undefined> {
  const now = new Date();

  const command = new UpdateCommand({
    TableName: Setting.TABLE_NAME_AUTHFLOW,
    Key: {
      pk: "CHALLENGE#SESSION",
      sk: flowId,
    },
    UpdateExpression: "SET #usedAt = :usedAt",
    ConditionExpression: "attribute_not_exists(#usedAt) AND #ttl > :now",
    ExpressionAttributeNames: {
      "#usedAt": "usedAt",
      "#ttl": "ttl",
    },
    ExpressionAttributeValues: {
      ":usedAt": now.toISOString(),
      ":now": Math.floor(now.getTime() / 1000),
    },
    ReturnValues: "ALL_NEW", // 更新後の値を返す : session を取得する
  });

  // コマンド実行
  const response = await docClient().send(command);
  console.log("response", response);
  return response.Attributes?.session ?? undefined;
}
