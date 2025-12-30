import {docClient} from "../dynamo";
import {
  PutCommand,
  QueryCommand,
  DeleteCommand,
  GetCommand,
  UpdateCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {CartConfig, PhotoConfig} from "../../../config";

import * as Photo from "../Photo";

type AddOptions = {
  albumSequenceId: number;
  photoSequenceId: number;
  albumTitle: string;
  purchaseDeadline: string;
  priceTier: string;
  downloadOption: Record<string, any>;
  printLOption: Record<string, any>;
  print2LOption: Record<string, any>;
};

export async function add(
  facilityCode: string,
  userId: string,
  albumId: string,
  photoId: string,
  options: AddOptions
): Promise<void> {
  const nowISO = new Date().toISOString();
  const ttl = Math.floor(new Date(options.purchaseDeadline).getTime() / 1000);

  // コマンド生成
  const item: Record<string, any> = {};

  try {
    const command = new PutCommand({
      TableName: CartConfig.TABLE_NAME,
      Item: {
        pk: `FAC#${facilityCode}#CART#USER#${userId}`,
        sk: `ALBUM#${albumId}#PHOTO#${photoId}`,
        lsi1: `${options.albumSequenceId}#${options.photoSequenceId}`,
        facilityCode: facilityCode,
        albumId: albumId,
        photoId: photoId,
        albumSequenceId: options.albumSequenceId,
        photoSequenceId: options.photoSequenceId,
        albumTitle: options.albumTitle,
        purchaseDeadline: options.purchaseDeadline,
        priceTier: options.priceTier,
        ttl: ttl,
        createdAt: nowISO,
        createdBy: userId,
        downloadOption: options.downloadOption,
        printLOption: options.printLOption,
        print2LOption: options.print2LOption,
      },
      ConditionExpression: "attribute_not_exists(pk)", // 重複登録抑制
    });
    // コマンド実行
    await docClient().send(command);
  } catch (e: any) {
    // 既に存在するなら「何もしない」
    console.log("error", e);
    if (e?.name === "ConditionalCheckFailedException") {
      return;
    }
    throw e;
  }
}

export async function edit(
  facilityCode: string,
  userId: string,
  albumId: string,
  photoId: string,
  dl: boolean | undefined,
  printl: number | undefined,
  print2l: number | undefined
): Promise<any> {
  const nowISO = new Date().toISOString();

  let UpdateExpression = "SET #updatedAt = :updatedAt";
  const ExpressionAttributeNames: Record<string, any> = {
    "#updatedAt": "updatedAt",
  };
  const ExpressionAttributeValues: Record<string, any> = {
    ":updatedAt": nowISO,
  };

  // dl の更新
  if (dl !== undefined) {
    UpdateExpression += ", #downloadOption.#selected = :dl";
    ExpressionAttributeNames["#downloadOption"] = "downloadOption";
    ExpressionAttributeNames["#selected"] = "selected";
    ExpressionAttributeValues[":dl"] = dl;
  }

  // printl の更新
  if (printl !== undefined) {
    UpdateExpression += ", #printLOption.#quantity = :printl";
    ExpressionAttributeNames["#printLOption"] = "printLOption";
    ExpressionAttributeNames["#quantity"] = "quantity";
    ExpressionAttributeValues[":printl"] = printl;
  }

  // print2l の更新
  if (print2l !== undefined) {
    UpdateExpression += ", #print2LOption.#quantity = :print2l";
    ExpressionAttributeNames["#print2LOption"] = "print2LOption";
    ExpressionAttributeNames["#quantity"] = "quantity";
    ExpressionAttributeValues[":print2l"] = print2l;
  }

  const command = new UpdateCommand({
    TableName: PhotoConfig.TABLE_NAME,
    Key: {
      pk: `FAC#${facilityCode}#CART#USER#${userId}`,
      sk: `ALBUM#${albumId}#PHOTO#${photoId}`,
    },
    UpdateExpression: UpdateExpression,
    ExpressionAttributeNames: ExpressionAttributeNames,
    ExpressionAttributeValues: ExpressionAttributeValues,
  });

  // コマンド実行
  await docClient().send(command);
}

export async function list(facilityCode: string, userId: string): Promise<any> {
  const command = new QueryCommand({
    TableName: CartConfig.TABLE_NAME,
    IndexName: "lsi1_index",
    KeyConditionExpression: "#pk = :pk",
    ProjectionExpression:
      "#sk, #albumId, #photoId, #albumSequenceId, #photoSequenceId, #albumTitle, #purchaseDeadline, #priceTier, #downloadOption, #printLOption, #print2LOption, #createdAt, #createdBy, #updatedAt, #updatedBy",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#sk": "sk",
      "#albumId": "albumId",
      "#photoId": "photoId",
      "#albumSequenceId": "albumSequenceId",
      "#photoSequenceId": "photoSequenceId",
      "#albumTitle": "albumTitle",
      "#purchaseDeadline": "purchaseDeadline",
      "#priceTier": "priceTier",
      "#downloadOption": "downloadOption",
      "#printLOption": "printLOption",
      "#print2LOption": "print2LOption",
      "#createdAt": "createdAt",
      "#createdBy": "createdBy",
      "#updatedAt": "updatedAt",
      "#updatedBy": "updatedBy",
    },
    ExpressionAttributeValues: {
      ":pk": `FAC#${facilityCode}#CART#USER#${userId}`,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Items;
}

export async function photoDelete(
  facilityCode: string,
  userId: string,
  albumId: string,
  photoId: string
): Promise<void> {
  const command = new DeleteCommand({
    TableName: CartConfig.TABLE_NAME,
    Key: {
      pk: `FAC#${facilityCode}#CART#USER#${userId}`,
      sk: `ALBUM#${albumId}#PHOTO#${photoId}`,
    },
  });
  // コマンド実行
  await docClient().send(command);
}
