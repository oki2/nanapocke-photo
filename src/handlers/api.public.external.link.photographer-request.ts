import {AppConfig} from "../config";
import * as http from "../http";
import {GetParameter} from "../utils/ParameterStore";

export const handler = http.withHttp(async (event: any = {}): Promise<any> => {
  // フォトグラファー依頼ページのURLをパラメータストアから取得
  const photographerRequestUrl = await GetParameter(
    AppConfig.SSM_PHOTOGRAPHY_REQUEST_URL_KEY,
  );

  return http.seeOther(photographerRequestUrl);
});
