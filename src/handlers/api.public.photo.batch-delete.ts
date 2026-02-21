import {AppConfig, PhotoConfig} from "../config";
import * as http from "../http";
import {
  FacilityCodePathParameters,
  PhotoBatchDelete,
  ResultOK,
} from "../schemas/public";
import {parseOrThrow} from "../libs/validate";

import * as Photo from "../utils/Dynamo/Photo";
import * as Album from "../utils/Dynamo/Album";
import * as Relation from "../utils/Dynamo/Relation";

import {tagSplitter, sequenceIdSplitter} from "../libs/tool";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // パスパラメータの施設コード、写真ID取得
  const path = parseOrThrow(
    FacilityCodePathParameters,
    event.pathParameters ?? {},
  );

  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(PhotoBatchDelete, raw);
  console.log("data", data);

  // 1. アルバム紐付けされているものは一括削除不可
  const photos = await Photo.batchGet(
    authContext.facilityCode,
    data.selectedIds,
  );

  if (photos.length != data.selectedIds.length) {
    return http.badRequest({detail: "不正な写真が含まれています"});
  }

  const checkList = photos.filter((p) => p.GsiUnsetUploadPK);
  if (checkList.length != data.selectedIds.length) {
    return http.badRequest({
      detail: "アルバム紐付けされている写真は一括削除できません",
    });
  }

  // 2. 写真の一括削除 SQS 経由で実行
  data.selectedIds.forEach(async (photoId) => {
    await Photo.photoManualDelete(
      authContext.facilityCode,
      photoId,
      authContext.userId,
    );
  });

  // 3. レスポンス
  return http.ok(parseOrThrow(ResultOK, {ok: true}));
});
