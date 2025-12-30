import {AlbumConfig, UserConfig} from "../config";
import * as http from "../http";

import {AlbumListResponse, AlbumListResponseT} from "../schemas/album";
import {parseOrThrow} from "../libs/validate";

import * as Album from "../utils/Dynamo/Album";

type Role = keyof typeof AlbumConfig.VIEW_STATUS;

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);
  // データの取得
  const albums = await Album.list(authContext.facilityCode);
  console.log("albums", albums);

  const result: AlbumListResponseT = [];
  const userRole: Role = authContext.role;
  const viewStatus: string[] = AlbumConfig.VIEW_STATUS[userRole];

  for (const album of albums) {
    // 権限別の表示制限
    if (!viewStatus.includes(album.salesStatus)) {
      continue;
    }

    result.push({
      albumId: album.albumId,
      sequenceId: album.sequenceId,
      title: album.title,
      description: album.description,
      salesStatus: album.salesStatus,
      priceTable: album.priceTable,
      salesPeriod: album.salesPeriod,
      coverImageUrl: album.coverImage
        ? `/thumbnail/${authContext.facilityCode}/album/${album.albumId}/${album.coverImage}`
        : "",
      ...(album.photoCount ? {photoCount: album.photoCount} : {}),
    });
  }

  const tmp = parseOrThrow(AlbumListResponse, result);
  console.log("tmp", tmp);
  return http.ok(tmp);
});
