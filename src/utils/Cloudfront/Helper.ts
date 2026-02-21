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
  maxAge: number = EXPIRES_SECONDS,
): string[] {
  // ワイルドカード指定の場合、カスタムポリシー対応が必要
  // 手っ取り早くカスタムポリシーにする為、アクセス許可開始日（dateGreaterThan）も設定する
  // インスタンス間の時差がある可能性を考慮し、現在時刻の300秒前 ～ maxAge＋300秒後 にする
  const CLOCK_SKEW_SECONDS = 300;

  const now = new Date();
  const notBefore = new Date(now.getTime() - CLOCK_SKEW_SECONDS * 1000);
  const expires = new Date(
    now.getTime() + (maxAge + CLOCK_SKEW_SECONDS) * 1000,
  );

  const cookies = getSignedCookies({
    url: `https://${domain}${targetPath}*`,
    keyPairId: publicKeyId,
    dateGreaterThan: notBefore.toISOString(),
    dateLessThan: expires.toISOString(),
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
  maxAge: number = EXPIRES_SECONDS,
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
  const cookieAry = keys.map((key: any) => {
    return `${key}=${cookies[key]}; Path=${targetPath}; Max-Age=${maxAge}; SameSite=strict; Secure; HttpOnly;`;
  });

  return cookieAry;
}
