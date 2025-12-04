import * as http from "../http";

import {
  AlbumSetPhotoPath,
  AlbumSetPhotoBody,
  AlbumListResponseT,
} from "../schemas/album";
import {parseOrThrow} from "../libs/validate";

import * as Album from "../utils/Dynamo/Album";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // Request Pathパラメータの確認・バリデーション
  const path = parseOrThrow(AlbumSetPhotoPath, event.pathParameters ?? {});
  console.log("path", path);

  // Request Bodyデータの確認・バリデーション
  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(AlbumSetPhotoBody, raw);
  console.log("data", data);

  const result: AlbumListResponseT = [];

  // 1. アルバムに写真を登録
  await Album.setPhoto(
    authContext.facilityCode,
    authContext.userSub,
    path.albumId,
    data.photoId
  );

  // const tmp = parseOrThrow(AlbumListResponse, result);
  // console.log("tmp", tmp);
  return http.ok({ok: true});
});
