import {AlbumConfig} from "../../../config";
import * as AlbumModel from "./Model";

export async function mutableStatusList(
  facilityCode: string
): Promise<{adds: string[]; dels: string[]}> {
  const addList = [];
  const delList = [];

  const result = await AlbumModel.list(facilityCode);
  for (const item of result) {
    switch (item.salesStatus) {
      case AlbumConfig.SALES_STATUS.UNPUBLISHED:
        delList.push(item.albumId);
      case AlbumConfig.SALES_STATUS.DRAFT:
        addList.push(item.albumId);
        break;
    }
    if (item.salesStatus === AlbumConfig.SALES_STATUS.DRAFT) {
      addList.push(item.albumId);
    } else {
      delList.push(item.albumId);
    }
  }

  return {adds: addList, dels: delList};
}

/**
 * JST の当日 05:00 を UTC に戻して Date を生成する
 * @param {Date|string} input - 入力日時（UTC）
 * @returns {Date} - JST の当日 05:00 を UTC に戻した Date
 */
export function toJstToday0500(input: Date | string): Date {
  const date = typeof input === "string" ? new Date(input) : input;

  // 入力を UTC ミリ秒で取得
  const time = date.getTime();

  // JST = UTC +9h
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const jstDate = new Date(time + JST_OFFSET_MS);

  // JST で年月日を取得
  const year = jstDate.getUTCFullYear();
  const month = jstDate.getUTCMonth();
  const day = jstDate.getUTCDate();

  // JST 当日 05:00 を UTC に戻して Date を生成
  const jst0500Utc = Date.UTC(year, month, day, 5, 0, 0) - JST_OFFSET_MS;

  return new Date(jst0500Utc);
}

/**
 * JST の当日 00:00 を UTC に戻して Date を生成する
 * @param {Date|string} input - 入力日時（UTC）
 * @returns {Date} - JST の当日 00:00 を UTC に戻した Date
 */
export function toJstToday0000(input: Date | string): Date {
  const date = typeof input === "string" ? new Date(input) : input;

  // 入力を UTC ミリ秒で取得
  const time = date.getTime();

  // JST = UTC +9h
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const jstDate = new Date(time + JST_OFFSET_MS);

  // JST で年月日を取得
  const year = jstDate.getUTCFullYear();
  const month = jstDate.getUTCMonth();
  const day = jstDate.getUTCDate();

  // JST 当日 00:00 を UTC に戻して Date を生成
  const jst0000Utc = Date.UTC(year, month, day, 0, 0, 0) - JST_OFFSET_MS;

  return new Date(jst0000Utc);
}

/**
 * JST の翌日 02:00 を UTC に戻して Date を生成する
 * @param {Date|string} input - 入力日時（UTC）
 * @returns {Date} - JST の翌日 02:00 を UTC に戻した Date
 */
export function toJstTomorrow0200(input: Date | string): Date {
  const date = typeof input === "string" ? new Date(input) : input;

  // 入力を UTC ミリ秒で取得
  const time = date.getTime();

  // JST = UTC +9h
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const jstDate = new Date(time + JST_OFFSET_MS);

  // JST で年月日を取得
  const year = jstDate.getUTCFullYear();
  const month = jstDate.getUTCMonth();
  const day = jstDate.getUTCDate();

  // JST 翌日 02:00 を UTC に戻して Date を生成
  const jst0200Utc = Date.UTC(year, month, day + 1, 2, 0, 0) - JST_OFFSET_MS;

  return new Date(jst0200Utc);
}

/**
 * JST の昨日 23:59 を UTC に戻して Date を生成する
 * @param {Date|string} input - 入力日時（UTC）
 * @returns {Date} - JST の昨日 23:59 を UTC に戻した Date
 */
export function toJstYesterday2359(input: Date | string): Date {
  const date = typeof input === "string" ? new Date(input) : input;

  // 入力を UTC ミリ秒で取得
  const time = date.getTime();

  // JST = UTC +9h
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const jstDate = new Date(time + JST_OFFSET_MS);

  // JST で年月日を取得
  const year = jstDate.getUTCFullYear();
  const month = jstDate.getUTCMonth();
  const day = jstDate.getUTCDate();

  // JST 翌日 02:00 を UTC に戻して Date を生成
  const jst0200Utc = Date.UTC(year, month, day - 1, 23, 59, 59) - JST_OFFSET_MS;

  return new Date(jst0200Utc);
}
