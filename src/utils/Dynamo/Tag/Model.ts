import {docClient} from "../dynamo";
import {
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {TagConfig} from "../../../config";

export async function historyAdd(
  facilityCode: string,
  userId: string,
  tags: string[]
): Promise<void> {
  const nowISO = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + TagConfig.HISTORY_EXPIRATION;

  // タグを全て保存する（BatchWriteで実行）
  const requestItems = tags.map((tag) => ({
    PutRequest: {
      Item: {
        pk: `TAG#FAC#${facilityCode}#HISTORY`,
        sk: tag,
        tag,
        ttl,
        lsi1: nowISO,
        createdAt: nowISO,
        createdBy: userId,
      },
    },
  }));
  const command = new BatchWriteCommand({
    RequestItems: {
      [TagConfig.TABLE_NAME]: requestItems,
    },
  });

  // コマンド実行
  await docClient().send(command);
}

export async function historyList(facilityCode: string): Promise<any> {
  const command = new QueryCommand({
    TableName: TagConfig.TABLE_NAME,
    IndexName: "lsi1_index",
    ScanIndexForward: false,
    KeyConditionExpression: "#pk = :pk",
    ProjectionExpression: "#tag",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#tag": "tag",
    },
    ExpressionAttributeValues: {
      ":pk": `TAG#FAC#${facilityCode}#HISTORY`,
    },
    Limit: TagConfig.TAG_LIMIT_PER_LIST,
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Items;
}
