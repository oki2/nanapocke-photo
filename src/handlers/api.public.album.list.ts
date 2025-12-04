import {Setting} from "../config";
import * as http from "../http";

import {AlbumListResponse, AlbumListResponseT} from "../schemas/album";
import {parseOrThrow} from "../libs/validate";

import * as Album from "../utils/Dynamo/Album";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);
  // データの取得
  const data = await Album.list(authContext.facilityCode);
  console.log("data", data);

  const result: AlbumListResponseT = [];

  for (const item of data) {
    if (
      item.salesStatus !== Album.Setting.SALES_STATUS.AVAILABLE &&
      authContext.role === Setting.ROLE.GUARDIAN
    ) {
      continue;
    }
    result.push({
      albumId: item.albumId,
      seq: item.seq,
      title: item.title,
      description: item.description,
      salesStatus: item.salesStatus,
      priceTable: item.priceTable,
      nbf: item.nbf,
      exp: item.exp,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }

  const tmp = parseOrThrow(AlbumListResponse, result);
  console.log("tmp", tmp);
  return http.ok(tmp);
});
