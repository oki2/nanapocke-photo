import axios from "redaxios";
import {GetParameter} from "../../ParameterStore";

import * as jwt from "jsonwebtoken";

const NANAPOCKE_API_TOPICS_SEND_URL =
  process.env.NANAPOCKE_API_TOPICS_SEND_URL || "";
const NANAPOCKE_API_TOPICS_DELETE_URL =
  process.env.NANAPOCKE_API_TOPICS_DELETE_URL || "";
const SSM_NANAPOCKE_TOPICS_API_TOKEN =
  process.env.SSM_NANAPOCKE_TOPICS_API_TOKEN || "";
const SSM_NANAPOCKE_TOPICS_JWT_SECRET =
  process.env.SSM_NANAPOCKE_TOPICS_JWT_SECRET || "";

type NanapockeTokenT = {
  nurseryCd: string;
  classReceivedList: string[];
  childrenList: string[];
  academicYear?: number;
  noticeTitle: string;
  noticeContent: string;
  noticeSendTime?: string;
  mailFlag: boolean;
};

type NanapockeApiTopicsMethodT = "POST" | "DELETE";
type NanapockeApiTopicsT = {
  method: NanapockeApiTopicsMethodT;
  topics?: NanapockeTokenT;
  noticeId?: string;
};

type SendBaseT = {
  nurseryCd: string;
  noticeTitle: string;
  noticeContent: string;
  noticeSendTime?: string;
};

type SendClassT = SendBaseT & {
  classReceivedList: string[];
  academicYear: number;
};

type SendUserT = SendBaseT & {
  childrenList: string[];
};

// 成功時の data
type CreateNoticeData = {
  noticeId: string;
};

// 共通レスポンス
type ApiResponse<T = unknown> = {
  success: boolean;
  code: number;
  message: string;
  data?: T;
  errors?: Record<string, string[] | string>;
};

let _token: string | null = null;
let _secret: string | null = null;

async function getToken(): Promise<string> {
  if (!_token) {
    _token = await GetParameter(SSM_NANAPOCKE_TOPICS_API_TOKEN);
  }
  return _token;
}

async function getSecret(): Promise<string> {
  if (!_secret) {
    _secret = await GetParameter(SSM_NANAPOCKE_TOPICS_JWT_SECRET);
  }
  return _secret;
}

export async function SendClass(p: SendClassT): Promise<string> {
  // 送信するオブジェクトを生成
  const request: NanapockeTokenT = {
    nurseryCd: p.nurseryCd,
    classReceivedList: p.classReceivedList,
    childrenList: [],
    academicYear: p.academicYear,
    noticeTitle: p.noticeTitle,
    noticeContent: p.noticeContent,
    mailFlag: true,
    ...(p.noticeSendTime ? {noticeSendTime: p.noticeSendTime} : {}),
  };

  const exToken = await getToken();
  const secret = await getSecret();

  const token = jwt.sign(
    {
      exToken: exToken,
    },
    secret,
    {
      expiresIn: "10m", // 10分
    },
  );

  try {
    const res = await axios.post(NANAPOCKE_API_TOPICS_SEND_URL, request, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("res : ", res);
    console.log(res);

    if (!res.data.success) {
      throw new Error(res.data);
    }
    console.log("noticeId", res.data.data.noticeId);
    return res.data?.data?.noticeId ?? "";
  } catch (err) {
    console.error("Topics.SendClass : ", err);
  }
  return "";
}

export async function SendUser(p: SendUserT): Promise<string> {
  // 送信するオブジェクトを生成
  const request: NanapockeTokenT = {
    nurseryCd: p.nurseryCd,
    classReceivedList: [],
    childrenList: p.childrenList,
    noticeTitle: p.noticeTitle,
    noticeContent: p.noticeContent,
    mailFlag: true,
    ...(p.noticeSendTime ? {noticeSendTime: p.noticeSendTime} : {}),
  };

  const exToken = await getToken();
  const secret = await getSecret();

  const token = jwt.sign(
    {
      exToken: exToken,
    },
    secret,
    {
      expiresIn: "10m", // 10分
    },
  );
  try {
    const res = await axios.post(NANAPOCKE_API_TOPICS_SEND_URL, request, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("res : ", res);
    console.log(res);

    if (!res.data.success) {
      throw new Error(res.data);
    }
    console.log("noticeId", res.data.data.noticeId);
    return res.data?.data?.noticeId ?? "";
  } catch (err) {
    console.error("Topics.SendUser : ", err);
  }
  return "";
}

export async function DeleteNotice(noticeId: string): Promise<any> {
  const exToken = await getToken();
  const secret = await getSecret();

  const token = jwt.sign(
    {
      exToken: exToken,
    },
    secret,
    {
      expiresIn: "10m", // 10分
    },
  );

  try {
    const res = await axios.delete(
      `${NANAPOCKE_API_TOPICS_DELETE_URL}${noticeId}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    console.log("res : ", res);
    console.log(res);

    if (!res.data.success) {
      throw new Error(res.data);
    }
    console.log("noticeId", res.data.data.noticeId);
    return res.data?.data?.noticeId ?? "";
  } catch (err) {
    console.error("Topics.DeleteNotice : ", err);
  }
  return "";
}

/**
 * ナナポケの送信日時形式に変換える
 * @param {Date|string} input - 入力日時（UTC）
 * @returns {string} - ナナポケの送信日時形式（YYYY-MM-DD HH:MM:SS）
 */
export function toNanapockeSendTimeFormat(input: Date | string): string {
  const date = typeof input === "string" ? new Date(input) : input;

  // 入力を UTC ミリ秒で取得
  const time = date.getTime();

  // JST = UTC +9h
  let JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const jstDate = new Date(time + JST_OFFSET_MS);

  // JST で年月日を取得
  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getMonth() + 1).padStart(2, "0");
  const day = String(jstDate.getDate()).padStart(2, "0");
  const hour = String(jstDate.getHours()).padStart(2, "0");

  // JST 翌日 02:00 を UTC に戻して Date を生成
  return `${year}-${month}-${day} ${hour}:00:00`;
}

/**
 * JST 上の指定された日時（YYYY-MM-DD HH:MM:SS）を UTC に戻す
 * @param {Date|string} input - 入力日時（UTC）
 * @param {number} hour - JST 上の時間（0-23）
 * @param {number} [offsetDay=0] - JST 上の日付のオフセット（日数）
 * @returns {Date} - JST 上の指定された日時を UTC に戻した Date
 * @throws {RangeError} - hour が 0-23 の範囲外の場合
 */
export function toJstDateAtHour(
  input: Date | string,
  hour: number,
  offsetDay: number = 0,
): Date {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError("hour must be an integer between 0 and 23");
  }
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const base = typeof input === "string" ? new Date(input) : input;
  const baseMs = base.getTime();

  // 1) 入力の「その瞬間」を JST に寄せた“見かけの日時”を作る（UTC APIで扱うため）
  const jstView = new Date(baseMs + JST_OFFSET_MS);

  // 2) JST 上の年月日を取り出す
  const y = jstView.getUTCFullYear();
  const m = jstView.getUTCMonth();
  const d = jstView.getUTCDate();

  // 3) JST の (y-m-d + offsetDay) の hour:00 を作る（これは「JSTの壁時計」をUTCで表現したもの）
  const jstWallClockAsUtcMs = Date.UTC(y, m, d + offsetDay, hour, 0, 0);

  // 4) 「JSTの壁時計」を実際の UTC インスタントに戻す
  return new Date(jstWallClockAsUtcMs - JST_OFFSET_MS);
}
