import * as http from "../http";
import {
  AlbumPathParameters,
  AlbumSalesBody,
  AlbumEditResponse,
  AlbumEditResponseT,
} from "../schemas/public";
import {
  TRIGGER_ACTION,
  AlbumPublishedT,
} from "../schemas/trigger.s3.action.router";
import {parseOrThrow} from "../libs/validate";
import {AppConfig, AlbumConfig} from "../config";
import * as Album from "../utils/Dynamo/Album";

import {S3FilePut, S3PutObjectSignedUrl} from "../utils/S3";

import * as NanapockeTopics from "../utils/External/Nanapocke/Topics";

type ActionResultT = {
  ok: boolean;
  detail?: string;
};

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // パスパラメータのアルバムID
  const path = parseOrThrow(AlbumPathParameters, event.pathParameters ?? {});

  // Request Bodyデータの確認・バリデーション
  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(AlbumSalesBody, raw);
  console.log("data", data);

  const result: AlbumEditResponseT = {
    ok: true,
  };

  // 販売開始・終了で処理の分離
  let response: ActionResultT;
  switch (data.action) {
    case AlbumConfig.SALES_ACTION.START:
      // 販売開始日・終了日の計算
      data.snapshot.salesPeriod.start = Album.toJstToday0500(
        data.snapshot.salesPeriod.start,
      ).toISOString();
      data.snapshot.salesPeriod.end = Album.toJstTomorrow0200(
        data.snapshot.salesPeriod.end,
      ).toISOString();

      // 2. DynamoDB に Albumデータを更新
      await Album.update(
        authContext.facilityCode,
        path.albumId,
        authContext.userId,
        data.snapshot.title,
        data.snapshot.description ?? "",
        data.snapshot.priceTable,
        data.snapshot.salesPeriod,
        data.snapshot.removeCover
          ? AlbumConfig.IMAGE_STATUS.NONE
          : data.snapshot.coverImageFileName
            ? AlbumConfig.IMAGE_STATUS.PROCESSING
            : "",
      );

      // 3. アルバム画像が存在する場合は、署名付きURLの発行 アップロードはPUTのみに絞るため、S3署名付きURLでのアップロードを行う
      if (!data.snapshot.removeCover && data.snapshot.coverImageFileName) {
        result.url = await S3PutObjectSignedUrl(
          AppConfig.BUCKET_UPLOAD_NAME,
          `${AppConfig.S3.PREFIX.ALBUM_IMAGE_UPLOAD}/${authContext.facilityCode}/${path.albumId}/${authContext.userId}/${data.snapshot.coverImageFileName}`,
          60, // 即時アップされる想定なので、有効期限を短く1分とする
        );
      }

      // 販売開始処理へ移行
      response = await salesStart(
        authContext.facilityCode,
        path.albumId,
        authContext.userId,
        data,
      );
      break;
    case AlbumConfig.SALES_ACTION.END:
      // 販売終了処理へ移行
      response = await salesStop(
        authContext.facilityCode,
        path.albumId,
        authContext.userId,
      );
      break;
  }

  // 結果がエラーの場合はエラーを出力する
  if (!response.ok) {
    return http.badRequest({
      detail: response.detail ?? "不明なエラー",
    });
  }

  return http.ok(parseOrThrow(AlbumEditResponse, result));
});

// 販売開始 =========================================
async function salesStart(
  facilityCode: string,
  albumId: string,
  userId: string,
  data: any,
): Promise<ActionResultT> {
  // 1. 対象のアルバム情報を取得
  const album = await Album.get(facilityCode, albumId);
  console.log("album", album);
  // 販売開始へ変更する場合は、アルバムの販売ステータスが DRAFT 以外の場合は不可
  if (album.salesStatus !== AlbumConfig.SALES_STATUS.DRAFT) {
    return {
      ok: false,
      detail: `このアルバムを販売開始することはできません`,
    };
  }

  // 2. アルバム販売期間を確認、未設定、又は終了日が過去日の場合はエラー
  if (
    !album.salesPeriod ||
    !album.salesPeriod.start ||
    !album.salesPeriod.end ||
    album.salesPeriod.end < new Date().toISOString()
  ) {
    return {
      ok: false,
      detail: `販売期間を設定してください`,
    };
  }

  // 3. 対象のアルバムに含まれる写真の枚数を取得
  const photoCount = await Album.photoCount(facilityCode, albumId);
  console.log("photoCount", photoCount);

  // アルバムの枚数が0枚の場合は不可
  if (photoCount === 0) {
    return {
      ok: false,
      detail: `アルバムに写真が設定されていません`,
    };
  }

  // アルバムに保管できる最大枚数を超えている場合はエラーを返す
  if (photoCount >= AlbumConfig.MAX_PHOTO_COUNT) {
    return {
      ok: false,
      detail: `アルバムで販売可能な枚数（${AlbumConfig.MAX_PHOTO_COUNT}枚）を超えています`,
    };
  }

  // 4. アルバムを販売開始処理ステータスに変更
  await Album.actionSalesPublishing(
    facilityCode,
    albumId,
    userId,
    data.topics.send,
    data.topics.send ? data.topics.academicYear : "",
    data.topics.send ? data.topics.classReceivedList : [],
  );

  // 5. アルバムの販売データ作成処理（Eventトリガーで実行のためS3に保存）
  const triggerData: AlbumPublishedT = {
    facilityCode: facilityCode,
    albumId: albumId,
    userId: userId,
  };
  await S3FilePut(
    AppConfig.BUCKET_UPLOAD_NAME,
    `action/${TRIGGER_ACTION.ALBUM_PUBLISHED}/${facilityCode}/${albumId}.json`,
    JSON.stringify(triggerData),
  );

  return {
    ok: true,
  };
}

// 販売終了 =========================================
async function salesStop(
  facilityCode: string,
  albumId: string,
  userId: string,
): Promise<ActionResultT> {
  // 1. 対象のアルバム情報を取得
  const album = await Album.get(facilityCode, albumId);
  console.log("album", album);

  // 販売終了へ変更する場合は、アルバムの販売ステータスが PUBLISHED 以外の場合は不可
  if (album.salesStatus !== AlbumConfig.SALES_STATUS.PUBLISHED) {
    return {
      ok: false,
      detail: `このアルバムを販売終了することはできません`,
    };
  }

  // 3. アルバムを販売開始処理ステータスに変更
  const res = await Album.actionSalesUnpublished(facilityCode, albumId, userId);

  // 4. 販売終了したアルバムに、通知設定、及び未送信の通知があるかチェック
  if (res.topicsSend) {
    const nowIso = new Date().toISOString();

    console.log("res", res);

    // 販売開始の通知未送信の時刻の場合
    if (res.topicsSendStart?.noticeId && res.topicsSendStart.sendAt > nowIso) {
      console.log("res.topicsSendStart.noticeId", res.topicsSendStart.noticeId);
      await NanapockeTopics.DeleteNotice(res.topicsSendStart.noticeId);
    }

    // 販売終了3日前
    if (res.topicsSendEnd3?.noticeId && res.topicsSendEnd3.sendAt > nowIso) {
      console.log("res.topicsSendEnd3.noticeId", res.topicsSendEnd3.noticeId);
      await NanapockeTopics.DeleteNotice(res.topicsSendEnd3.noticeId);
    }

    // 販売終了当日
    if (res.topicsSendEnd?.noticeId && res.topicsSendEnd.sendAt > nowIso) {
      console.log("res.topicsSendEnd.noticeId", res.topicsSendEnd.noticeId);
      await NanapockeTopics.DeleteNotice(res.topicsSendEnd.noticeId);
    }
  }

  return {
    ok: true,
  };
}
