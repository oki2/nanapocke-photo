import {Setting} from "./Setting";
// import * as AlbumModel from "./Model";

import {
  getSignedCookies,
  getSignedUrl,
  CloudfrontSignedCookiesOutput,
} from "@aws-sdk/cloudfront-signer";

type cfSignedCookieKeys = keyof CloudfrontSignedCookiesOutput;
const EXPIRES_SECONDS = 3600; // 1時間;

/**
 * 返却データのスキーマ
 */

export function GetSignedCookie(
  domain: string,
  publicKeyId: string,
  privateKey: string,
  targetPath: string,
  maxAge: number = EXPIRES_SECONDS
): string[] {
  // ワイルドカード指定の場合、カスタムポリシー対応が必要
  // 手っ取り早くカスタムポリシーにする為、アクセス許可開始日（dateGreaterThan）も設定する

  const now = new Date();
  const nowISO = now.toISOString();
  const expISO = new Date(now.getTime() + maxAge * 1000).toISOString();

  const cookies = getSignedCookies({
    url: `https://${domain}${targetPath}*`,
    keyPairId: publicKeyId,
    dateGreaterThan: nowISO,
    dateLessThan: expISO,
    privateKey: privateKey,
  });

  const keys = Object.keys(cookies) as cfSignedCookieKeys[];
  const cookieAry = keys.map((key) => {
    return `${key}=${cookies[key]}; Path=${targetPath}; Max-Age=${maxAge}; SameSite=strict; Secure; HttpOnly;`;
  });

  return cookieAry;
}

export function PutSignedUrl(
  domain: string,
  publicKeyId: string,
  privateKey: string,
  targetPath: string,
  maxAge: number = EXPIRES_SECONDS
): string[] {
  // ワイルドカード指定の場合、カスタムポリシー対応が必要
  // 手っ取り早くカスタムポリシーにする為、アクセス許可開始日（dateGreaterThan）も設定する

  const now = new Date();
  const nowISO = now.toISOString();
  const expISO = new Date(now.getTime() + maxAge * 1000).toISOString();

  const cookies = getSignedUrl({
    url: `https://${domain}${targetPath}*`,
    keyPairId: publicKeyId,
    dateGreaterThan: nowISO,
    dateLessThan: expISO,
    privateKey: privateKey,
  });

  const keys = Object.keys(cookies) as cfSignedCookieKeys[];
  const cookieAry = keys.map((key) => {
    return `${key}=${cookies[key]}; Path=${targetPath}; Max-Age=${maxAge}; SameSite=strict; Secure; HttpOnly;`;
  });

  return cookieAry;
}
