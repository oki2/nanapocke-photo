import {AppConfig} from "../config";
import * as http from "../http";
import {PhotoEditBody, PhotoPathParameters, ResultOK} from "../schemas/public";
import {parseOrThrow} from "../libs/validate";

import * as Photo from "../utils/Dynamo/Photo";
import * as Album from "../utils/Dynamo/Album";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // パスパラメータの施設コード、写真ID取得
  const path = parseOrThrow(PhotoPathParameters, event.pathParameters ?? {});

  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(PhotoEditBody, raw);
  console.log("data", data);

  // 1. アルバムのステータスチェック
  const mutableList = await Album.mutableStatusList(authContext.facilityCode);
  console.log("mutableList", mutableList);
  // const diff = data.album.albums.filter((a) => !mutableList.adds.includes(a));
  // console.log("diff", diff);
  if (
    data.album.albums.filter((a) => !mutableList.adds.includes(a)).length > 0
  ) {
    return http.badRequest({detail: "アルバムの編集は許可されていません"});
  }

  // 2. 対象の写真に設定されているアルバム情報を取得
  const photo = await Photo.get(authContext.facilityCode, path.photoId);
  console.log("photo", photo);
  const nowAlbums: string[] = photo?.albums ?? [];

  // 3. 追加するものを取得
  const addAlbums = data.album.albums.filter((a) => !nowAlbums.includes(a));
  console.log("addAlbums", addAlbums);

  // 4. 削除するものを取得
  const delAlbums = nowAlbums.filter((a) => !data.album.albums.includes(a));
  console.log("delAlbums", delAlbums);

  // 5. 削除するものが存在する場合、アルバムステータスをチェック
  if (delAlbums.length > 0) {
    if (
      data.album.albums.filter((a) => !mutableList.dels.includes(a)).length > 0
    ) {
      return http.badRequest({
        detail: "販売中アルバムの編集は許可されていません",
      });
    }
  }

  // 6. DynamoDB に写真とアルバムの紐付け情報を登録
  await Photo.setAlbums(
    authContext.facilityCode,
    path.photoId,
    addAlbums,
    delAlbums,
    data.album.albums,
    authContext.userId
  );

  // 3. レスポンス
  return http.ok(parseOrThrow(ResultOK, {ok: true}));
});
