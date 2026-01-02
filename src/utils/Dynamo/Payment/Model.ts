import {docClient} from "../dynamo";
import {
  PutCommand,
  QueryCommand,
  DeleteCommand,
  GetCommand,
  UpdateCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {PaymentConfig} from "../../../config";

type PaymentCreateResult = {
  orderId: string;
};

export async function create(
  facilityCode: string,
  userId: string,
  countPrint: number,
  countDl: number,
  tierStandard: Record<string, any>,
  tierPremium: Record<string, any>,
  subTotal: number,
  shippingFee: number,
  grandTotal: number
): Promise<PaymentCreateResult> {
  const nowISO = new Date().toISOString();
  const seq = await nextSequence();
  const seqStr = String(seq).padStart(10, "0");
  const orderId = `${
    PaymentConfig.ORDER_ID_PREFIX
  }-${dateYmdHiJST()}-${seqStr}`;

  // コマンド実行
  const result = await docClient().send(
    new PutCommand({
      TableName: PaymentConfig.TABLE_NAME,
      Item: {
        pk: `PAYMENT#META`,
        sk: orderId,
        orderId: orderId,
        countPrint: countPrint,
        countDl: countDl,
        sequenceId: seq,
        userId: userId,
        facilityCode: facilityCode,
        paymentStatus: PaymentConfig.STATUS.CREATED,
        tierStandard: tierStandard,
        tierPremium: tierPremium,
        subTotal: subTotal,
        shippingFee: shippingFee,
        grandTotal: grandTotal,
        createdAt: nowISO,
        createdBy: userId,
        updatedAt: nowISO,
        updatedBy: userId,
      },
      ConditionExpression: "attribute_not_exists(pk)", // 重複登録抑制
    })
  );

  return {orderId: orderId};
}

export async function get(orderId: string): Promise<any> {
  const command = new GetCommand({
    TableName: PaymentConfig.TABLE_NAME,
    Key: {
      pk: `PAYMENT#META`,
      sk: orderId,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Item;
}

function dateYmdHiJST(baseDate: Date = new Date()): string {
  // UTC → JST (+9h)
  const jstTime = baseDate.getTime() + 9 * 60 * 60 * 1000;
  const jstDate = new Date(jstTime);

  const yy = String(jstDate.getUTCFullYear()).slice(-2);
  const mm = String(jstDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(jstDate.getUTCDate()).padStart(2, "0");
  const HH = String(jstDate.getUTCHours()).padStart(2, "0");
  const ii = String(jstDate.getUTCMinutes()).padStart(2, "0");

  return `${yy}${mm}${dd}-${HH}${ii}`;
}

export async function setCompleted(
  orderId: string,
  smbcProcessDate: string,
  userId: string,
  updatedBy: string
): Promise<void> {
  const command = new UpdateCommand({
    TableName: PaymentConfig.TABLE_NAME,
    Key: {
      pk: `PAYMENT#META`,
      sk: orderId,
    },
    UpdateExpression:
      "SET #paymentStatus = :paymentStatus, #lsi1 = :lsi1, #smbcProcessDate = :smbcProcessDate, #updatedAt = :updatedAt, #updatedBy = :updatedBy",
    ExpressionAttributeNames: {
      "#paymentStatus": "paymentStatus",
      "#lsi1": "lsi1",
      "#smbcProcessDate": "smbcProcessDate",
      "#updatedAt": "updatedAt",
      "#updatedBy": "updatedBy",
    },
    ExpressionAttributeValues: {
      ":paymentStatus": PaymentConfig.STATUS.COMPLETED,
      ":lsi1": `USER#${userId}#PROCESS#${smbcProcessDate}`,
      ":smbcProcessDate": smbcProcessDate,
      ":updatedAt": new Date().toISOString(),
      ":updatedBy": updatedBy,
    },
  });

  // コマンド実行
  await docClient().send(command);
}

export async function myList(userId: string): Promise<any> {
  const command = new QueryCommand({
    TableName: PaymentConfig.TABLE_NAME,
    IndexName: "lsi1_index",
    ScanIndexForward: false,
    KeyConditionExpression: "#pk = :pk AND begins_with(#lsi1, :lsi1)",
    ProjectionExpression:
      "#sk, #orderId, #countPrint, #countDl, #smbcProcessDate, grandTotal",
    ExpressionAttributeNames: {
      "#pk": "pk",
      "#lsi1": "lsi1",
      "#sk": "sk",
      "#orderId": "orderId",
      "#countPrint": "countPrint",
      "#countDl": "countDl",
      "#smbcProcessDate": "smbcProcessDate",
      "#grandTotal": "grandTotal",
    },
    ExpressionAttributeValues: {
      ":pk": `PAYMENT#META`,
      ":lsi1": `USER#${userId}#PROCESS#`,
    },
  });

  // コマンド実行
  const result = await docClient().send(command);
  return result.Items;
}

async function nextSequence(): Promise<number> {
  const command = new UpdateCommand({
    TableName: PaymentConfig.TABLE_NAME,
    Key: {
      pk: `PAYMENT#SEQ`,
      sk: `PAYMENT#COUNTER`,
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
