import {docClient} from "../dynamo";
import {
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {AlbumConfig} from "../../../config";

export async function get(facilityCode: string, albumId: string): Promise<any> {
  const command = new GetCommand({
    TableName: AlbumConfig.TABLE_NAME,
    Key: {
      pk: `FAC#${facilityCode}#ALBUM#META`,
      sk: albumId,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Item;
}

export async function create(
  facilityCode: string,
  userId: string,
  title: string,
  description: string,
  priceTable: string,
  salesPeriod: any | undefined
): Promise<Record<string, any>> {
  const nowISO = new Date().toISOString();
  const albumId = crypto.randomUUID();
  const seq = await nextSequence(facilityCode);

  // コマンド実行
  const result = await docClient().send(
    new PutCommand({
      TableName: AlbumConfig.TABLE_NAME,
      Item: {
        pk: `FAC#${facilityCode}#ALBUM#META`,
        sk: albumId,
        lsi1: nowISO,
        facilityCode: facilityCode,
        albumId: albumId,
        sequenceId: seq,
        title: title,
        description: description,
        priceTable: priceTable,
        salesPeriod: salesPeriod,
        salesStatus: AlbumConfig.SALES_STATUS.DRAFT,
        createdAt: nowISO,
        createdBy: userId,
        updatedAt: nowISO,
        updatedBy: userId,
      },
      ConditionExpression: "attribute_not_exists(pk)", // 重複登録抑制
    })
  );

  return {
    albumId: albumId,
    title: title,
  };
}

export async function list(facilityCode: string): Promise<any> {
  const command = new QueryCommand({
    TableName: AlbumConfig.TABLE_NAME,
    IndexName: "lsi1_index",
    ScanIndexForward: false,
    KeyConditionExpression: "#pk = :pk",
    ProjectionExpression:
      "#sk, #albumId, #sequenceId, #title, #description, #priceTable, #salesPeriod, #salesStatus, #photoCount, #coverImage, #createdAt, #createdBy, #updatedAt, #updatedBy",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#sk": "sk",
      "#albumId": "albumId",
      "#sequenceId": "sequenceId",
      "#title": "title",
      "#description": "description",
      "#priceTable": "priceTable",
      "#salesPeriod": "salesPeriod",
      "#salesStatus": "salesStatus",
      "#photoCount": "photoCount",
      "#coverImage": "coverImage",
      "#createdAt": "createdAt",
      "#createdBy": "createdBy",
      "#updatedAt": "updatedAt",
      "#updatedBy": "updatedBy",
    },
    ExpressionAttributeValues: {
      ":pk": `FAC#${facilityCode}#ALBUM#META`,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Items;
}

export async function update(
  facilityCode: string,
  albumId: string,
  userId: string,
  title: string,
  description: string,
  priceTable: string,
  salesPeriod: any | undefined
): Promise<boolean> {
  const nowISO = new Date().toISOString();

  // コマンド生成
  const command = new UpdateCommand({
    TableName: AlbumConfig.TABLE_NAME,
    Key: {
      pk: `FAC#${facilityCode}#ALBUM#META`,
      sk: albumId,
    },
    UpdateExpression: `SET #title = :title, #description = :description, #priceTable = :priceTable, #salesPeriod = :salesPeriod, #updatedAt = :updatedAt, #updatedBy = :updatedBy`,
    ConditionExpression: "#salesStatus = :salesStatus",
    ExpressionAttributeNames: {
      "#title": "title",
      "#description": "description",
      "#priceTable": "priceTable",
      "#salesPeriod": "salesPeriod",
      "#salesStatus": "salesStatus",
      "#updatedAt": "updatedAt",
      "#updatedBy": "updatedBy",
    },
    ExpressionAttributeValues: {
      ":title": title,
      ":description": description,
      ":priceTable": priceTable,
      ":salesPeriod": salesPeriod,
      ":salesStatus": AlbumConfig.SALES_STATUS.DRAFT,
      ":updatedAt": nowISO,
      ":updatedBy": userId,
    },
  });

  // コマンド実行
  await docClient().send(command);
  return true;
}

export async function setCoverImage(
  facilityCode: string,
  albumId: string,
  coverImage: string,
  userId: string
): Promise<boolean> {
  const nowISO = new Date().toISOString();

  // コマンド生成
  const command = new UpdateCommand({
    TableName: AlbumConfig.TABLE_NAME,
    Key: {
      pk: `FAC#${facilityCode}#ALBUM#META`,
      sk: albumId,
    },
    UpdateExpression: `SET #coverImage = :coverImage, #updatedAt = :updatedAt, #updatedBy = :updatedBy`,
    ConditionExpression: "#salesStatus = :salesStatus",
    ExpressionAttributeNames: {
      "#coverImage": "coverImage",
      "#salesStatus": "salesStatus",
      "#updatedAt": "updatedAt",
      "#updatedBy": "updatedBy",
    },
    ExpressionAttributeValues: {
      ":coverImage": coverImage,
      ":salesStatus": AlbumConfig.SALES_STATUS.DRAFT,
      ":updatedAt": nowISO,
      ":updatedBy": userId,
    },
  });

  // コマンド実行
  await docClient().send(command);
  return true;
}

/**
 * アルバム内の写真枚数を取得
 *
 * @param {string} facilityCode - Facility code.
 * @param {string} albumId - Album ID.
 * @returns {Promise<number>} - Promise of count of photos.
 */
export async function photoCount(
  facilityCode: string,
  albumId: string
): Promise<number> {
  const nowISO = new Date().toISOString();

  // コマンド実行
  const result = await docClient().send(
    new QueryCommand({
      TableName: AlbumConfig.TABLE_NAME,
      KeyConditionExpression: "#pk = :pk",
      Select: "COUNT",
      ExpressionAttributeNames: {
        "#pk": "pk",
      },
      ExpressionAttributeValues: {
        ":pk": `FAC#${facilityCode}#ALBUM#${albumId}`,
      },
    })
  );
  return result.Count ?? 0;
}

/**
 * アルバムを公開準備にする
 *
 * @param {string} facilityCode - Facility code.
 * @param {string} albumId - Album ID.
 * @param {string} userId - User ID.
 * @returns {Promise<void>} - Promise of void.
 */
export async function actionSalesPublishing(
  facilityCode: string,
  albumId: string,
  userId: string,
  topicsSend: boolean,
  topicsAcademicYear: string,
  topicsClassReceivedList: string[]
): Promise<void> {
  const nowISO = new Date().toISOString();

  let UpdateExpression =
    "SET #salesStatus = :salesStatus, #topicsSend = :topicsSend, #topicsAcademicYear = :topicsAcademicYear, #topicsClassReceivedList = :topicsClassReceivedList, #updatedAt = :updatedAt, #updatedBy = :updatedBy, #publishingAt = :publishingAt, #publishingBy = :publishingBy";

  let ExpressionAttributeNames: any = {
    "#salesStatus": "salesStatus",
    "#topicsSend": "topicsSend",
    "#topicsAcademicYear": "topicsAcademicYear",
    "#topicsClassReceivedList": "topicsClassReceivedList",
    "#updatedAt": "updatedAt",
    "#updatedBy": "updatedBy",
    "#publishingAt": "publishingAt",
    "#publishingBy": "publishingBy",
  };

  let ExpressionAttributeValues: any = {
    ":salesStatus": AlbumConfig.SALES_STATUS.PUBLISHING,
    ":topicsSend": topicsSend,
    ":topicsAcademicYear": topicsAcademicYear,
    ":topicsClassReceivedList": topicsClassReceivedList,
    ":beforeSalesStatus": AlbumConfig.SALES_STATUS.DRAFT,
    ":updatedAt": nowISO,
    ":updatedBy": userId,
    ":publishingAt": nowISO,
    ":publishingBy": userId,
  };

  // コマンド生成
  const command = new UpdateCommand({
    TableName: AlbumConfig.TABLE_NAME,
    Key: {
      pk: `FAC#${facilityCode}#ALBUM#META`,
      sk: albumId,
    },
    UpdateExpression: UpdateExpression,
    ConditionExpression: "#salesStatus = :beforeSalesStatus",
    ExpressionAttributeNames: ExpressionAttributeNames,
    ExpressionAttributeValues: ExpressionAttributeValues,
  });

  // コマンド実行
  await docClient().send(command);
}

/**
 * アルバムを公開状態にする
 *
 * @param {string} facilityCode - Facility code.
 * @param {string} albumId - Album ID.
 * @param {string} userId - User ID.
 * @returns {Promise<void>} - Promise of void.
 */
export async function actionSalesPublished(
  facilityCode: string,
  albumId: string,
  photoCount: number,
  userId: string
): Promise<void> {
  const nowISO = new Date().toISOString();

  let UpdateExpression =
    "SET #salesStatus = :salesStatus, #photoCount = :photoCount, #updatedAt = :updatedAt, #updatedBy = :updatedBy, #publishedAt = :publishedAt, #publishedBy = :publishedBy";

  let ExpressionAttributeNames: any = {
    "#salesStatus": "salesStatus",
    "#photoCount": "photoCount",
    "#updatedAt": "updatedAt",
    "#updatedBy": "updatedBy",
    "#publishedAt": "publishedAt",
    "#publishedBy": "publishedBy",
  };

  let ExpressionAttributeValues: any = {
    ":salesStatus": AlbumConfig.SALES_STATUS.PUBLISHED,
    ":beforeSalesStatus": AlbumConfig.SALES_STATUS.PUBLISHING,
    ":photoCount": photoCount,
    ":updatedAt": nowISO,
    ":updatedBy": userId,
    ":publishedAt": nowISO,
    ":publishedBy": userId,
  };

  // コマンド生成
  const command = new UpdateCommand({
    TableName: AlbumConfig.TABLE_NAME,
    Key: {
      pk: `FAC#${facilityCode}#ALBUM#META`,
      sk: albumId,
    },
    UpdateExpression: UpdateExpression,
    ConditionExpression: "#salesStatus = :beforeSalesStatus",
    ExpressionAttributeNames: ExpressionAttributeNames,
    ExpressionAttributeValues: ExpressionAttributeValues,
  });

  // コマンド実行
  await docClient().send(command);
  return;
}

/**
 * アルバムを非公開にする
 *
 * @param {string} facilityCode - Facility code.
 * @param {string} albumId - Album ID.
 * @param {string} userId - User ID.
 * @returns {Promise<void>} - Promise of void.
 */
export async function actionSalesUnpublished(
  facilityCode: string,
  albumId: string,
  userId: string
): Promise<void> {
  const nowISO = new Date().toISOString();

  let UpdateExpression =
    "SET #salesStatus = :salesStatus, #updatedAt = :updatedAt, #updatedBy = :updatedBy, #unpublishedAt = :unpublishedAt, #unpublishedBy = :unpublishedBy";

  let ExpressionAttributeNames: any = {
    "#salesStatus": "salesStatus",
    "#updatedAt": "updatedAt",
    "#updatedBy": "updatedBy",
    "#unpublishedAt": "unpublishedAt",
    "#unpublishedBy": "unpublishedBy",
  };

  let ExpressionAttributeValues: any = {
    ":salesStatus": AlbumConfig.SALES_STATUS.UNPUBLISHED,
    ":beforeSalesStatus": AlbumConfig.SALES_STATUS.PUBLISHED,
    ":updatedAt": nowISO,
    ":updatedBy": userId,
    ":unpublishedAt": nowISO,
    ":unpublishedBy": userId,
  };

  // コマンド生成
  const command = new UpdateCommand({
    TableName: AlbumConfig.TABLE_NAME,
    Key: {
      pk: `FAC#${facilityCode}#ALBUM#META`,
      sk: albumId,
    },
    UpdateExpression: UpdateExpression,
    ConditionExpression: "#salesStatus = :beforeSalesStatus",
    ExpressionAttributeNames: ExpressionAttributeNames,
    ExpressionAttributeValues: ExpressionAttributeValues,
  });

  // コマンド実行
  await docClient().send(command);
  return;
}

async function nextSequence(facilityCode: string): Promise<number> {
  const command = new UpdateCommand({
    TableName: AlbumConfig.TABLE_NAME,
    Key: {
      pk: `FAC#${facilityCode}#SEQ`,
      sk: `ALBUM#COUNTER`,
    },
    // seq を 1 加算（存在しなければ 1 で作られる）
    UpdateExpression: "ADD #sequenceId :inc",
    ExpressionAttributeNames: {
      "#sequenceId": "sequenceId",
    },
    ExpressionAttributeValues: {
      ":inc": 1,
    },
    ReturnValues: "UPDATED_NEW",
  });

  // コマンド実行
  const result = await docClient().send(command);
  const value = result.Attributes?.sequenceId;
  if (!value) throw new Error("sequenceId not returned");
  return value;
}
