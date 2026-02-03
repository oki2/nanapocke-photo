import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import {AppConfig} from "../../config";

let _doc: DynamoDBDocumentClient | null = null;

export function docClient(): DynamoDBDocumentClient {
  if (!_doc) {
    const client = new DynamoDBClient({region: AppConfig.MAIN_REGION});
    _doc = DynamoDBDocumentClient.from(client);
  }
  return _doc;
}

export async function batchWriteAll(
  tableName: string,
  requests: Array<{PutRequest?: any; DeleteRequest?: any}>,
  docClient: any,
) {
  // 25件ずつ
  for (let i = 0; i < requests.length; i += 25) {
    let chunk = requests.slice(i, i + 25);

    // UnprocessedItems が無くなるまでリトライ
    while (chunk.length > 0) {
      const res = await docClient.send(
        new BatchWriteCommand({
          RequestItems: {[tableName]: chunk},
        }),
      );

      chunk = res.UnprocessedItems?.[tableName] ?? [];
      if (chunk.length > 0) {
        // 軽いバックオフ（安全寄り）
        await new Promise((r) => setTimeout(r, 150));
      }
    }
  }
}

export async function batchGetAll<T>(
  tableName: string,
  keys: Record<string, any>[],
  docClient: any,
): Promise<T[]> {
  if (!keys || keys.length === 0) return [];

  const results: T[] = [];

  console.log("keys", keys);

  // 100件ずつ
  for (let i = 0; i < keys.length; i += 100) {
    let requestItems = {
      [tableName]: {
        Keys: keys.slice(i, i + 100),
      },
    };

    // UnprocessedKeys が無くなるまでリトライ
    while (Object.keys(requestItems).length > 0) {
      const res = await docClient.send(
        new BatchGetCommand({
          RequestItems: requestItems,
        }),
      );

      // 取得できた分を追加
      const items = (res.Responses?.[tableName] ?? []) as T[];
      results.push(...items);

      requestItems = res.UnprocessedKeys ?? {};

      if (Object.keys(requestItems).length > 0) {
        // 軽いバックオフ
        await new Promise((r) => setTimeout(r, 150));
      }
    }
  }

  return results;
}
