import * as http from "../http";

import {UserConfig, PhotoConfig} from "../config";

import {MetaListResponse} from "../schemas/meta";
import {parseOrThrow} from "../libs/validate";

import * as Album from "../utils/Dynamo/Album";
import * as Tag from "../utils/Dynamo/Tag";
import * as User from "../utils/Dynamo/User";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // === Step.1 タグ履歴を取得 =========== //
  const tags = await Tag.historyList(authContext.facilityCode);
  console.log("tags", tags);

  // === Step.2 アルバム一覧を取得 =========== //
  const albums = await Album.list(authContext.facilityCode);
  console.log("albums", albums);

  // === Step.3 園長の場合はスタッフ一覧を取得 ========== //
  let staff: any[] | undefined = undefined;
  if (authContext.role === UserConfig.ROLE.PRINCIPAL) {
    staff = await User.staffList(authContext.facilityCode);
    console.log("staff", staff);
  }

  const tmp = parseOrThrow(MetaListResponse, {
    tags: tags.map((item: any) => item.tag),
    albums: albums,
    staff: staff,
  });
  console.log("tmp", tmp);
  return http.ok(tmp);
});
