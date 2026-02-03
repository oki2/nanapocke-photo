import type {SQSEvent, SQSRecord} from "aws-lambda";
import {AppConfig, PhotoConfig} from "../../config";
import * as S3 from "../../utils/S3";

import axios from "redaxios";

type PayloadT = {
  job: string;
  data: Record<string, any>;
};

export const handler = async (event: SQSEvent) => {
  // バッチで複数レコードが届く
  for (const record of event.Records) {
    await handleRecord(record);
  }
};

async function handleRecord(record: SQSRecord): Promise<void> {
  console.log("record", record);
  const payload: PayloadT = JSON.parse(record.body);

  switch (payload.job) {
    case AppConfig.SQS_JOB_SEND_PHOTO_FILE_BY_ORDERID:
      await SqsJobSendPhotoFileByOrderId(payload.data);
      break;
  }

  // 例外を投げると、そのメッセージは再試行されます（最大受信回数超えでDLQへ）
}

async function SqsJobSendPhotoFileByOrderId(data: Record<string, any>) {
  const orderId = data.orderId;
  const orderData = await S3.getOrderData(orderId);
  console.log("orderData", orderData);

  const userInfo = await S3.getUserInfo(orderId);
  console.log("userInfo", userInfo);

  // しまうま用データ生成 =========================
  // 注文番号を生成
  const shimaumaId = orderId[0] + orderId[3] + orderId.slice(19);
  const printDataAry = [];
  // 現在日時（日本時間）のyyyyMMdd を取得
  const d = new Date(
    new Date().toLocaleString("ja-JP", {timeZone: "Asia/Tokyo"}),
  );
  const yyyymmdd =
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");

  // カート内情報を処理
  for (const cart of orderData.cart) {
    // 印刷Lがある場合
    if (cart.printLOption.quantity) {
      printDataAry.push({
        photoId: cart.photoId,
        photoSequanceId: cart.photoSequenceId,
        size: "L",
        fileName: `${cart.photoSequenceId}-${PhotoConfig.PHOTO_SIZE_SUFFIX.PRINT_L}.jpg`,
        s3Path: `storage/photo/${orderData.facilityCode}/${cart.shootingBy}/${cart.photoId}/${cart.photoSequenceId}-${PhotoConfig.PHOTO_SIZE_SUFFIX.PRINT_L}.jpg`,
        quantity: cart.printLOption.quantity,
      });
    }

    // 印刷2Lがある場合
    if (cart.print2LOption.quantity) {
      printDataAry.push({
        photoId: cart.photoId,
        photoSequanceId: cart.photoSequenceId,
        size: "2L",
        fileName: `${cart.photoSequenceId}-${PhotoConfig.PHOTO_SIZE_SUFFIX.PRINT_2L}.jpg`,
        s3Path: `storage/photo/${orderData.facilityCode}/${cart.shootingBy}/${cart.photoId}/${cart.photoSequenceId}-${PhotoConfig.PHOTO_SIZE_SUFFIX.PRINT_2L}.jpg`,
        quantity: cart.print2LOption.quantity,
      });
    }
  }
  console.log("printDataAry", printDataAry);

  // TSVデータ準備
  const tsvRowAry: string[] = [];
  const orderPhotoAry: string[] = [];

  // S3署名付きURLを発行しつつ、サーバーへ送信する
  for (const printData of printDataAry) {
    const signedUrl = await S3.S3GetObjectSignedUrl(
      AppConfig.BUCKET_PHOTO_NAME,
      printData.s3Path,
      900,
    );
    console.log("signedUrl", signedUrl);

    const res = await axios.post(
      "https://dev-kids.uxbrew.jp/api/nanapocke/photo/image/",
      {
        url: signedUrl,
        path: `${shimaumaId}/${printData.fileName}`,
      },
      {
        headers: {"Content-Type": "application/json"},
        // redaxios は validateStatus が使えるので、PHP同様 200 だけ成功に寄せる
        validateStatus: (status) => status === 200,
      },
    );
    console.log("res", res);

    // TSVデータに追加
    tsvRowAry.push(
      `${shimaumaId}\t${yyyymmdd}\t${shimaumaId}/\t${printData.fileName}\tetc\t${printData.size}\t${printData.quantity}\t0\t0\t1\t1\t${userInfo.name}\t${userInfo.postalCode}\t${userInfo.line}\t${userInfo.phone}`,
    );
    // 注文写真ファイル一覧に追加
    orderPhotoAry.push(printData.fileName);
  }

  // TSV送信
  console.log("tsvRowAry", tsvRowAry);
  const res = await axios.post(
    "https://dev-kids.uxbrew.jp/api/nanapocke/photo/order/",
    {
      orderId: orderId,
      shimaumaId: shimaumaId,
      orderSheet: `${yyyymmdd}_${shimaumaId}.tsv`,
      orderData: tsvRowAry,
      orderPhotoAry: orderPhotoAry,
    },
    {
      headers: {"Content-Type": "application/json"},
      // redaxios は validateStatus が使えるので、PHP同様 200 だけ成功に寄せる
      validateStatus: (status) => status === 200,
    },
  );
  console.log("res", res);
}
