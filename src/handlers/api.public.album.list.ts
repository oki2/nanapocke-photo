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
  const data = await Album.list(authContext.facilityCode);
  console.log("data", data);

  const result: AlbumListResponseT = [];
  const userRole: Role = authContext.role;
  const viewStatus: string[] = AlbumConfig.VIEW_STATUS[userRole];

  for (const item of data) {
    // 権限別の表示制限
    if (!viewStatus.includes(item.salesStatus)) {
      continue;
    }

    result.push({
      albumId: item.albumId,
      sequenceId: item.sequenceId,
      title: item.title,
      description: item.description,
      salesStatus: item.salesStatus,
      priceTable: item.priceTable,
      nbf: item.nbf ?? "",
      exp: item.exp ?? "",
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }

  const tmp = parseOrThrow(AlbumListResponse, result);
  console.log("tmp", tmp);
  return http.ok(tmp);
});
