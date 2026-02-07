/**
 * FAC#${facilityCode}#PHOTOZIP
 * gsi1 : 全件：アップロード日ソート
 * gsi2 : 全件：撮影日ソート
 * gsi3 : アルバム未設定：アップロード日ソート
 * gsi4 : アルバム未設定：撮影日ソート
 * gsi5 : 自身がアップした写真：アップロード日ソート
 */

import {docClient} from "../dynamo";
import {PutCommand, GetCommand} from "@aws-sdk/lib-dynamodb";
import {PhotoZipConfig} from "../../../config";

export async function getZipMeta(
  facilityCode: string,
  zipId: string,
): Promise<Record<string, any> | undefined> {
  // コマンド実行
  const result = await docClient().send(
    new GetCommand({
      TableName: PhotoZipConfig.TABLE_NAME,
      Key: {
        pk: `FAC#${facilityCode}#PHOTOZIP`,
        sk: `META#${zipId}`,
      },
    }),
  );
  return result.Item;
}

export async function createZip(
  facilityCode: string,
  userId: string,
  userName: string,
  shootingAt: string,
  priceTier: string,
  tags: string[],
  albums: string[],
): Promise<string> {
  const nowISO = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + PhotoZipConfig.ZIP_EXPIRATION;
  const zipId = crypto.randomUUID();

  // コマンド実行
  await docClient().send(
    new PutCommand({
      TableName: PhotoZipConfig.TABLE_NAME,
      Item: {
        pk: `FAC#${facilityCode}#PHOTOZIP`,
        sk: `META#${zipId}`,
        facilityCode: facilityCode,
        shootingAt: shootingAt,
        shootingUserName: userName,
        priceTier: priceTier,
        createdAt: nowISO,
        createdBy: userId,
        updatedAt: nowISO,
        updatedBy: userId,
        tags: tags,
        albums: albums,
        ttl: ttl,
      },
      ConditionExpression: "attribute_not_exists(pk)", // 重複登録抑制
    }),
  );

  return zipId;
}
