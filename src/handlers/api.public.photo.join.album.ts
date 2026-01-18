import {AppConfig, PhotoConfig} from "../config";
import * as http from "../http";
import {
  FacilityCodePathParameters,
  PhotoJoinAlbumBody,
  ResultOK,
} from "../schemas/public";
import {parseOrThrow} from "../libs/validate";

import * as Photo from "../utils/Dynamo/Photo";
import * as Album from "../utils/Dynamo/Album";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // パスパラメータの施設コード、写真ID取得
  const path = parseOrThrow(
    FacilityCodePathParameters,
    event.pathParameters ?? {},
  );

  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(PhotoJoinAlbumBody, raw);
  console.log("data", data);

  // 1. 編集可能アルバム一覧を取得
  const draftList = await Album.draftList(authContext.facilityCode);
  console.log("draftList", draftList);
  const draftIds = draftList.map((a: any) => a.albumId);
  console.log("draftIds", draftIds);

  // 2. アルバムIDを取得
  const addAlbums: string[] = [];
  const delAlbums: string[] = [];
  switch (data.album.mode) {
    case PhotoConfig.PHOTO_JOIN_ALBUM.ADD:
      addAlbums.push(...data.album.albums);
      break;
    case PhotoConfig.PHOTO_JOIN_ALBUM.REPLACE:
      addAlbums.push(data.album.to);
      delAlbums.push(data.album.from);
      break;
    case PhotoConfig.PHOTO_JOIN_ALBUM.REMOVE:
      delAlbums.push(...data.album.albums);
      break;
  }

  // 3. 写真IDを取得
  let photoIds: string[] = [];
  if (data.scope.mode === PhotoConfig.PHOTO_JOIN_SCOPE.CHECKED) {
    // ID指定の場合
    photoIds = data.scope.selectedIds;
  } else if (data.scope.mode === PhotoConfig.PHOTO_JOIN_SCOPE.FILTER) {
    // 検索条件を指定する場合
    // photoIds = await getPhotoIdsByFilter();
  }

  // 6. DynamoDB に写真とアルバムの紐付け情報を登録
  for (const photoId of photoIds) {
    await Photo.setAlbumsOnePhotoSafe({
      facilityCode: authContext.facilityCode,
      photoId: photoId,
      addAlbums: addAlbums,
      delAlbums: delAlbums,
      userId: authContext.userId,
    });
  }

  // 3. レスポンス
  return http.ok(parseOrThrow(ResultOK, {ok: true}));
});

function hasOnlyInArrayCheck<T>(a: T[], b: T[]): boolean {
  const setB = new Set(b);
  return a.some((item) => !setB.has(item));
}
