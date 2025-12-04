import * as http from "../http";

import {AlbumCreateBody, AlbumCreateResponse} from "../schemas/album";
import {parseOrThrow} from "../libs/validate";

import * as Album from "../utils/Dynamo/Album";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  const raw = event.body ? JSON.parse(event.body) : {};
  const data = parseOrThrow(AlbumCreateBody, raw);
  console.log("data", data);

  // 2. DynamoDB に Album を作成
  const album = await Album.create(
    authContext.facilityCode,
    authContext.userSub,
    data.title,
    data.description ?? "",
    data.priceTable,
    data.nbf,
    data.exp
  );

  return http.ok(
    parseOrThrow(AlbumCreateResponse, {
      albumId: album.albumId,
      title: album.title,
    })
  );
});
