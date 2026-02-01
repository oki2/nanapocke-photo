import crypto from "crypto";

/**
 * 決済サイトに送るときに使う「固定パスワード」(例: 加盟店パスワード等)
 * - 実運用では Secrets Manager / SSM Parameter Store 等で管理してください
 */
const PAYMENT_SITE_PASSWORD = "REPLACE_ME_PAYMENT_SITE_PASSWORD";

/**
 * HMAC 秘密鍵（固定パスワードを絡める）
 * - 別途アプリ用のシークレットを用意し、そこに PAYMENT_SITE_PASSWORD を混ぜるのが安全
 */
const APP_TOKEN_SECRET = "REPLACE_ME_APP_SECRET";
const HMAC_SECRET = `${APP_TOKEN_SECRET}:${PAYMENT_SITE_PASSWORD}`;

/**
 * トークン有効期限（例: 10分）
 */
const TOKEN_TTL_SECONDS = 10 * 60;

/**
 * “簡易ワンタイム” 用の使用済み管理（インメモリ）
 * - Lambda ではコンテナが変わると消えます
 * - 本番は DynamoDB 等で jti を保存して二重利用を防いでください
 */
const usedJti = new Map<string, number>(); // jti -> usedAtEpochSec

function base64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
function base64urlDecodeToBuffer(s: string): Buffer {
  const padLen = (4 - (s.length % 4)) % 4;
  const padded = s + "=".repeat(padLen);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

function hmacSha256(data: string): string {
  const sig = crypto.createHmac("sha256", HMAC_SECRET).update(data).digest();
  return base64urlEncode(sig);
}

function nowEpochSec(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 戻りURL用ワンタイムトークンを発行
 * - orderId など、紐付けたい識別子を payload に入れる
 * - URLには state=... 等で載せる想定
 */
export function issueReturnToken(orderId: string): string {
  const iat = nowEpochSec();
  const exp = iat + TOKEN_TTL_SECONDS;
  const jti = crypto.randomUUID();

  const payload = {
    v: 1,
    typ: "payment_return_state",
    orderId: orderId,
    jti,
    iat,
    exp,
  };

  const payloadStr = JSON.stringify(payload);
  const payloadB64 = base64urlEncode(Buffer.from(payloadStr, "utf8"));
  const sig = hmacSha256(payloadB64);

  // token = payloadB64.sig
  return `${payloadB64}.${sig}`;
}

/**
 * トークン判定（署名・期限・ワンタイム）
 * - expectedOrderId を渡すと「この注文の戻りであること」まで確認できる
 */
export function verifyReturnToken(
  token: string,
  options?: {expectedOrderId?: string; consume?: boolean},
):
  | {
      ok: true;
      payload: {orderId: string; jti: string; iat: number; exp: number};
    }
  | {ok: false; reason: string} {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return {ok: false, reason: "INVALID_FORMAT"};

    const [payloadB64, sig] = parts;

    // 署名検証（タイミング攻撃対策で timingSafeEqual）
    const expectedSig = hmacSha256(payloadB64);
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return {ok: false, reason: "INVALID_SIGNATURE"};
    }

    // payload 復号
    const payloadBuf = base64urlDecodeToBuffer(payloadB64);
    const payload = JSON.parse(payloadBuf.toString("utf8")) as {
      v: number;
      typ: string;
      orderId: string;
      jti: string;
      iat: number;
      exp: number;
    };

    if (payload?.typ !== "payment_return_state") {
      return {ok: false, reason: "INVALID_TYPE"};
    }

    // 注文ID一致チェック（任意）
    if (
      options?.expectedOrderId &&
      payload.orderId !== options.expectedOrderId
    ) {
      return {ok: false, reason: "ORDER_MISMATCH"};
    }

    const now = nowEpochSec();
    if (typeof payload.exp !== "number" || now > payload.exp) {
      return {ok: false, reason: "EXPIRED"};
    }
    if (typeof payload.iat !== "number" || payload.iat > now + 60) {
      // 時刻が未来すぎるなど
      return {ok: false, reason: "INVALID_IAT"};
    }

    // ワンタイム判定（簡易）
    if (usedJti.has(payload.jti)) {
      return {ok: false, reason: "ALREADY_USED"};
    }

    // consume=true の場合は使用済みにする（デフォルト true 推奨）
    const consume = options?.consume ?? true;
    if (consume) {
      usedJti.set(payload.jti, now);
      // Map肥大化防止の簡易掃除（期限切れっぽいものを削除）
      for (const [k, usedAt] of usedJti.entries()) {
        if (now - usedAt > TOKEN_TTL_SECONDS * 2) usedJti.delete(k);
      }
    }

    return {
      ok: true,
      payload: {
        orderId: payload.orderId,
        jti: payload.jti,
        iat: payload.iat,
        exp: payload.exp,
      },
    };
  } catch {
    return {ok: false, reason: "INVALID_TOKEN"};
  }
}
