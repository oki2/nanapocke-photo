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
 * JST の当日 20:00 を UTC に戻して Date を生成する
 * @param {Date|string} input - 入力日時（UTC）
 * @returns {Date} - JST の翌日 02:00 を UTC に戻した Date
 */
export function toJstTargetDay2000(
  input: Date | string,
  offsetDay: number = 0,
): Date {
  const date = typeof input === "string" ? new Date(input) : input;

  // 入力を UTC ミリ秒で取得
  const time = date.getTime();

  // JST = UTC +9h
  let JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  if (offsetDay != 0) {
    JST_OFFSET_MS += offsetDay * 24 * 60 * 60 * 1000;
  }
  const jstDate = new Date(time + JST_OFFSET_MS);

  // JST で年月日を取得
  const year = jstDate.getUTCFullYear();
  const month = jstDate.getUTCMonth();
  const day = jstDate.getUTCDate();

  // JST 翌日 20:00 を UTC に戻して Date を生成
  const jst2000Utc = Date.UTC(year, month, day, 20, 0, 0) - JST_OFFSET_MS;

  return new Date(jst2000Utc);
}

/**
 * JST の当日 yyyy-mm-dd 20:00:00 フォーマットの文字列を返す
 */
export function toJstTargetDay2000Str(
  input: Date | string,
  offsetDay: number = 0,
): string {
  const date = typeof input === "string" ? new Date(input) : input;

  // 入力を UTC ミリ秒で取得
  const time = date.getTime();

  // JST = UTC +9h
  let JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  if (offsetDay != 0) {
    JST_OFFSET_MS += offsetDay * 24 * 60 * 60 * 1000;
  }
  const jstDate = new Date(time + JST_OFFSET_MS);

  // JST で年月日を取得
  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getMonth() + 1).padStart(2, "0");
  const day = String(jstDate.getDate()).padStart(2, "0");

  // JST 翌日 02:00 を UTC に戻して Date を生成
  return `${year}-${month}-${day} 20:00:00`;
}
