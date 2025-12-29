import * as http from "../http";
import {
  AlbumSalesBody,
  AlbumPathParameters,
  AlbumCreateResponse,
} from "../schemas/album";
import {
  TRIGGER_ACTION,
  AlbumPublishedT,
} from "../schemas/trigger.s3.action.router";
import {ResultOK} from "../schemas/common";
import {parseOrThrow} from "../libs/validate";
import {AppConfig, AlbumConfig} from "../config";
import * as Album from "../utils/Dynamo/Album";

import {S3FilePut} from "../utils/S3";

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

  // 販売開始・終了で処理の分離
  let result: ActionResultT;
  switch (data.action) {
    case AlbumConfig.SALES_ACTION.START:
      result = await salesStart(
        authContext.facilityCode,
        path.albumId,
        authContext.userId,
        data
      );
      break;
    case AlbumConfig.SALES_ACTION.STOP:
      result = await salesStop(
        authContext.facilityCode,
        path.albumId,
        authContext.userId
      );
      break;
    default:
      result = {
        ok: false,
        detail: `不明なアクション:${data.action}`,
      };
  }

  // 結果がエラーの場合はエラーを出力する
  if (!result.ok) {
    return http.badRequest({
      detail: result.detail ?? "不明なエラー",
    });
  }

  return http.ok(
    parseOrThrow(ResultOK, {
      ok: true,
    })
  );
});

// 販売開始 =========================================
async function salesStart(
  facilityCode: string,
  albumId: string,
  userId: string,
  data: any
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

  // 2. 対象のアルバムに含まれる写真の枚数を取得
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

  // 3. アルバムを販売開始処理ステータスに変更
  await Album.actionSalesPublishing(
    facilityCode,
    albumId,
    userId,
    data.topics.send,
    data.topics.send ? data.topics.academicYear : "",
    data.topics.send ? data.topics.classReceivedList : []
  );

  // 4. アルバムの販売データ作成処理（Eventトリガーで実行のためS3に保存）
  const triggerData: AlbumPublishedT = {
    facilityCode: facilityCode,
    albumId: albumId,
    userId: userId,
  };
  await S3FilePut(
    AppConfig.BUCKET_UPLOAD_NAME,
    `action/${TRIGGER_ACTION.ALBUM_PUBLISHED}/${facilityCode}/${albumId}.json`,
    JSON.stringify(triggerData)
  );

  return {
    ok: true,
  };
}

// 販売終了 =========================================
async function salesStop(
  facilityCode: string,
  albumId: string,
  userId: string
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
  await Album.actionSalesUnpublished(facilityCode, albumId, userId);

  return {
    ok: true,
  };
}
