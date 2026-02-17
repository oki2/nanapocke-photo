import {UserConfig} from "../config";

import crypto from "crypto";

/**
 * 文字列で取得したタグを、配列に分割する
 * @param {string} tagStr
 * @returns {string[]}
 */
export function tagSplitter(tagStr: string): string[] {
  return [
    ...new Set(
      tagStr
        .trim()
        .split(/[,#]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * 文字列で取得した PhotoId を、配列に分割する
 * @param {string} photoIdStr
 * @returns {string[]} PhotoId の配列
 */
export function photoIdSplitter(str: string): string[] {
  const s = str.trim();
  if (!s) return [];
  return [...new Set(s.split(/[ ,#　]+/).filter(Boolean))];
}

/**
 * 文字列で取得した AlbumId を、配列に分割する
 * @param {string} albumIdStr
 * @returns {string[]} AlbumId の配列
 */
export function albumIdSplitter(str: string): string[] {
  const s = str.trim();
  if (!s) return [];
  return [...new Set(s.split(/[ ,#　]+/).filter(Boolean))];
}

export function sequenceIdSplitter(str: string): number[] {
  const s = str.trim();
  if (!s) return [];
  return [
    ...new Set(
      s
        .split(/[ ,#\s]+/)
        .map(Number)
        .filter(Number.isFinite),
    ),
  ];
}

/**
 * 現在の日付から年度を取得する
 * @returns {number} 年度
 */
export function getAacademicYearJST(): number {
  const now = new Date(
    new Date().toLocaleString("ja-JP", {timeZone: "Asia/Tokyo"}),
  );

  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return month >= 4 ? year : year - 1;
}

/**
 * 指定された UTC 時刻から、次の 17:00 (UTC) を取得する
 * UTC 17:00 = JST 26:00
 * @param {Date} dateUtc - UTC 時刻
 * @returns {Date} 次の 17:00 (UTC)
 */
export function nextUtc17(dateUtc: Date): Date {
  // 当日の 17:00 (UTC)
  const today17 = new Date(
    Date.UTC(
      dateUtc.getUTCFullYear(),
      dateUtc.getUTCMonth(),
      dateUtc.getUTCDate(),
      17,
      0,
      0,
      0,
    ),
  );

  // 指定時刻が 17:00 より前 → 当日
  if (dateUtc.getTime() < today17.getTime()) {
    return today17;
  }

  // それ以外 → 翌日の 17:00
  return new Date(
    Date.UTC(
      dateUtc.getUTCFullYear(),
      dateUtc.getUTCMonth(),
      dateUtc.getUTCDate() + 1,
      17,
      0,
      0,
      0,
    ),
  );
}

/**
 * Split an array into chunks of a specified size.
 * @template T
 * @param {T[]} arr - The array to split.
 * @param {number} size - The size of each chunk.
 * @returns {T[][]} An array of chunks.
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function thumbnailAllowedPath(
  $facilityCode: string,
  $role: string,
  $userId: string,
): string {
  switch ($role) {
    case UserConfig.ROLE.PRINCIPAL:
    case UserConfig.ROLE.GUARDIAN:
      return `/thumbnail/${$facilityCode}/`;
    case UserConfig.ROLE.TEACHER:
    case UserConfig.ROLE.PHOTOGRAPHER:
      return `/thumbnail/${$facilityCode}/photo/${$userId}/`;
    default:
      return "/";
  }
}

function base64urlEncode(str: string): string {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64urlDecode(b64url: string): string {
  const pad =
    b64url.length % 4 === 0 ? "" : "=".repeat(4 - (b64url.length % 4));
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64").toString("utf8");
}

function stableJsonStringify(obj: unknown): string {
  // キー順を安定化（簡易版）
  const sort = (v: any): any => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      return Object.keys(v)
        .sort()
        .reduce((acc: any, k) => {
          acc[k] = sort(v[k]);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(sort(obj));
}

export function makeQueryHash(input: unknown): string {
  const s = stableJsonStringify(input);
  return crypto.createHash("sha256").update(s).digest("hex");
}

type CursorToken = {
  lek: Record<string, unknown>;
  qh: string;
};

export function encodeCursorToken(token: CursorToken): string {
  return base64urlEncode(JSON.stringify(token));
}

export function decodeCursorToken(cursor: string): CursorToken {
  const json = base64urlDecode(cursor);
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid cursor");
  if (!("lek" in parsed) || !("qh" in parsed))
    throw new Error("Invalid cursor");
  return parsed as CursorToken;
}
