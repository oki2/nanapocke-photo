/**
 * PK : FAC#${facilityCode}
 * SK : META#${albumId}
 * gsi1 : 全件：アップロード日ソート
 * gsi2 : 全件：撮影日ソート
 * gsi3 : アルバム未設定：アップロード日ソート
 * gsi4 : アルバム未設定：撮影日ソート
 * gsi5 : 自身がアップした写真：アップロード日ソート
 */

import {docClient} from "../dynamo";
import {
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import {AlbumConfig, PhotoConfig} from "../../../config";

import * as Photo from "../Photo";
import * as Relation from "../Relation";

const getPk = (facilityCode: string) => `FAC#${facilityCode}`;
const getSk = (albumId: string) => `META#${albumId}`;

export async function get(facilityCode: string, albumId: string): Promise<any> {
  const command = new GetCommand({
    TableName: AlbumConfig.TABLE_NAME,
    Key: {
      pk: getPk(facilityCode),
      sk: getSk(albumId),
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
  salesPeriod: {
    start: string;
    end: string;
  },
  coverImageStatus: string,
): Promise<Record<string, any>> {
  const nowISO = new Date().toISOString();
  const albumId = crypto.randomUUID();
  const seq = await nextSequence(facilityCode);

  // コマンド実行
  const result = await docClient().send(
    new PutCommand({
      TableName: AlbumConfig.TABLE_NAME,
      Item: {
        pk: getPk(facilityCode),
        sk: getSk(albumId),
        lsi1: nowISO,
        facilityCode: facilityCode,
        albumId: albumId,
        sequenceId: seq,
        title: title,
        description: description,
        priceTable: priceTable,
        salesPeriod: salesPeriod,
        salesStatus: AlbumConfig.SALES_STATUS.DRAFT,
        coverImageStatus: coverImageStatus,
        coverImage: "",
        createdAt: nowISO,
        createdBy: userId,
        updatedAt: nowISO,
        updatedBy: userId,
      },
      ConditionExpression: "attribute_not_exists(pk)", // 重複登録抑制
    }),
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
      "#sk, #albumId, #sequenceId, #title, #description, #priceTable, #salesPeriod, #salesStatus, #photoCount, #coverImage, #coverImageStatus, #createdAt, #createdBy, #updatedAt, #updatedBy",
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
      "#coverImageStatus": "coverImageStatus",
      "#createdAt": "createdAt",
      "#createdBy": "createdBy",
      "#updatedAt": "updatedAt",
      "#updatedBy": "updatedBy",
    },
    ExpressionAttributeValues: {
      ":pk": getPk(facilityCode),
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
  salesPeriod: {
    start: string;
    end: string;
  },
  coverImageStatus: string,
): Promise<boolean> {
  const nowISO = new Date().toISOString();

  let UpdateExpression = `SET #title = :title, #description = :description, #priceTable = :priceTable, #salesPeriod = :salesPeriod, #updatedAt = :updatedAt, #updatedBy = :updatedBy`;
  const ExpressionAttributeNames: Record<string, string> = {
    "#title": "title",
    "#description": "description",
    "#priceTable": "priceTable",
    "#salesPeriod": "salesPeriod",
    "#salesStatus": "salesStatus",
    "#updatedAt": "updatedAt",
    "#updatedBy": "updatedBy",
  };
  const ExpressionAttributeValues: Record<string, any> = {
    ":title": title,
    ":description": description,
    ":priceTable": priceTable,
    ":salesPeriod": salesPeriod,
    ":salesStatus": AlbumConfig.SALES_STATUS.DRAFT,
    ":updatedAt": nowISO,
    ":updatedBy": userId,
  };

  // アルバムのカバーイメージの更新がある場合
  if (coverImageStatus) {
    UpdateExpression += `, #coverImageStatus = :coverImageStatus, #coverImage = :coverImage`;
    ExpressionAttributeNames["#coverImageStatus"] = "coverImageStatus";
    ExpressionAttributeNames["#coverImage"] = "coverImage";
    ExpressionAttributeValues[":coverImageStatus"] = coverImageStatus;
    ExpressionAttributeValues[":coverImage"] = "";
  }

  // コマンド生成
  const command = new UpdateCommand({
    TableName: AlbumConfig.TABLE_NAME,
    Key: {
      pk: getPk(facilityCode),
      sk: getSk(albumId),
    },
    UpdateExpression: UpdateExpression,
    ConditionExpression: "#salesStatus = :salesStatus",
    ExpressionAttributeNames: ExpressionAttributeNames,
    ExpressionAttributeValues: ExpressionAttributeValues,
  });

  // コマンド実行
  await docClient().send(command);
  return true;
}

export async function setCoverImage(
  facilityCode: string,
  albumId: string,
  coverImage: string,
  userId: string,
): Promise<boolean> {
  const nowISO = new Date().toISOString();

  // コマンド生成
  const command = new UpdateCommand({
    TableName: AlbumConfig.TABLE_NAME,
    Key: {
      pk: getPk(facilityCode),
      sk: getSk(albumId),
    },
    UpdateExpression: `SET #coverImage = :coverImage, #coverImageStatus = :coverImageStatus, #updatedAt = :updatedAt, #updatedBy = :updatedBy`,
    ConditionExpression: "#salesStatus = :salesStatus",
    ExpressionAttributeNames: {
      "#coverImage": "coverImage",
      "#coverImageStatus": "coverImageStatus",
      "#salesStatus": "salesStatus",
      "#updatedAt": "updatedAt",
      "#updatedBy": "updatedBy",
    },
    ExpressionAttributeValues: {
      ":coverImage": coverImage,
      ":coverImageStatus": AlbumConfig.IMAGE_STATUS.VALID,
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
  topicsClassReceivedList: string[],
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
      pk: getPk(facilityCode),
      sk: getSk(albumId),
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
  userId: string,
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
      pk: getPk(facilityCode),
      sk: getSk(albumId),
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
  userId: string,
): Promise<Record<string, any>> {
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
      pk: getPk(facilityCode),
      sk: getSk(albumId),
    },
    UpdateExpression: UpdateExpression,
    ConditionExpression: "#salesStatus = :beforeSalesStatus",
    ExpressionAttributeNames: ExpressionAttributeNames,
    ExpressionAttributeValues: ExpressionAttributeValues,
    ReturnValues: "ALL_NEW",
  });

  // コマンド実行
  const res = await docClient().send(command);
  console.log("res", res);
  return res.Attributes ?? {};
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

export async function draftList(facilityCode: string): Promise<any> {
  const command = new QueryCommand({
    TableName: AlbumConfig.TABLE_NAME,
    KeyConditionExpression: "#pk = :pk",
    FilterExpression: "#salesStatus = :salesStatus",
    ProjectionExpression: "#albumId",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#salesStatus": "salesStatus",
      "#albumId": "albumId",
    },
    ExpressionAttributeValues: {
      ":pk": getPk(facilityCode),
      ":salesStatus": AlbumConfig.SALES_STATUS.DRAFT,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Items;
}

export async function deleteAlbum(
  facilityCode: string,
  albumId: string,
): Promise<any> {
  // アルバム削除
  await docClient().send(
    new DeleteCommand({
      TableName: AlbumConfig.TABLE_NAME,
      Key: {
        pk: getPk(facilityCode),
        sk: getSk(albumId),
      },
    }),
  );
}

type NanapockeTopicT = {
  noticeId: string;
  sendAt: string;
};
export type NanapockeTopicsT = {
  facilityCode: string;
  albumId: string;
  startNotice?: NanapockeTopicT;
  end5Notice?: NanapockeTopicT;
  end1Notice?: NanapockeTopicT;
  endNotice?: NanapockeTopicT;
};
export async function setNanapockeTopicsIds(
  p: NanapockeTopicsT,
): Promise<void> {
  // 一つも通知が無い場合はそのまま終了
  if (!p.startNotice && !p.end5Notice && !p.end1Notice && !p.endNotice) {
    return;
  }

  let UpdateExpression = "SET ";
  const ExpressionAttributeNames: Record<string, any> = {
    "#updatedAt": "updatedAt",
  };
  const ExpressionAttributeValues: Record<string, any> = {
    ":updatedAt": new Date().toISOString(),
  };

  if (p.startNotice && p.startNotice.noticeId) {
    UpdateExpression += `#startNotice = :startNotice, `;
    ExpressionAttributeNames["#startNotice"] = "topicsSendStart";
    ExpressionAttributeValues[":startNotice"] = p.startNotice;
  }
  if (p.end5Notice && p.end5Notice.noticeId) {
    UpdateExpression += `#end5Notice = :end5Notice, `;
    ExpressionAttributeNames["#end5Notice"] = "topicsSendEnd5";
    ExpressionAttributeValues[":end5Notice"] = p.end5Notice;
  }
  if (p.end1Notice && p.end1Notice.noticeId) {
    UpdateExpression += `#end1Notice = :end1Notice, `;
    ExpressionAttributeNames["#end1Notice"] = "topicsSendEnd1";
    ExpressionAttributeValues[":end1Notice"] = p.end1Notice;
  }
  if (p.endNotice && p.endNotice.noticeId) {
    UpdateExpression += `#endNotice = :endNotice, `;
    ExpressionAttributeNames["#endNotice"] = "topicsSendEnd";
    ExpressionAttributeValues[":endNotice"] = p.endNotice;
  }
  UpdateExpression += `#updatedAt = :updatedAt`;

  // コマンド実行
  await docClient().send(
    new UpdateCommand({
      TableName: AlbumConfig.TABLE_NAME,
      Key: {
        pk: getPk(p.facilityCode),
        sk: getSk(p.albumId),
      },
      UpdateExpression: UpdateExpression,
      ExpressionAttributeNames: ExpressionAttributeNames,
      ExpressionAttributeValues: ExpressionAttributeValues,
    }),
  );
}
