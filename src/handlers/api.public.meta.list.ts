import * as http from "../http";

import {UserConfig, PhotoConfig} from "../config";

import {MetaListResponse} from "../schemas/public";
import {parseOrThrow} from "../libs/validate";

import * as Album from "../utils/Dynamo/Album";
import * as Tag from "../utils/Dynamo/Tag";
import * as User from "../utils/Dynamo/User";
import * as Facility from "../utils/Dynamo/Facility";

import {getAacademicYearJST} from "../libs/tool";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  const authContext = (event.requestContext as any)?.authorizer?.lambda ?? {};
  console.log("authContext", authContext);

  // === Step.1 タグ履歴を取得 =========== //
  const tags = await Tag.historyList(authContext.facilityCode);
  console.log("tags", tags);

  // === Step.2 アルバム一覧を取得 =========== //
  const albums = await Album.list(authContext.facilityCode);
  console.log("albums", albums);

  // === Step.3 クラス一覧を取得 =========== //
  const classList = await Facility.classList(authContext.facilityCode);
  console.log("classList", classList);

  // === Step.4 園長の場合はスタッフ一覧と年度を取得 ========== //
  let staff: any[] | undefined = undefined;
  let academicYear: any[] | undefined = undefined;

  if (authContext.userRole === UserConfig.ROLE.PRINCIPAL) {
    staff = await User.staffList(authContext.facilityCode);
    console.log("staff", staff);

    const noeYear = getAacademicYearJST();
    academicYear = [String(noeYear), String(noeYear - 1)];
    console.log("academicYear", academicYear);
  }

  return http.ok(
    parseOrThrow(MetaListResponse, {
      tags: [
        ...classList.map((item: any) => item.className),
        ...tags.map((item: any) => item.tag),
      ],
      albums: albums,
      staff: staff,
      classList: classList,
      academicYear: academicYear,
    }),
  );
});
