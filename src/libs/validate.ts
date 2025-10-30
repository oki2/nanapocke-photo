import * as v from "valibot";
import {ValidationError} from "../errors/ValidationError";

/**
 * Valibot スキーマを検証し、失敗時に共通エラーメッセージを含む例外を投げる。
 *
 * @param schema - Valibot スキーマ
 * @param input - 検証対象データ
 * @param message - （任意）カスタムエラーメッセージ（デフォルト: "ValidationError"）
 *
 * @throws {Error & { issues: v.Issue[] }} Valibot の検証エラー情報を含む例外
 */
export function parseOrThrow<S extends v.GenericSchema<any, any, any>>(
  schema: S,
  input: unknown,
  message = "ValidationError"
): v.InferOutput<S> {
  const res = v.safeParse(schema, input);

  if (!res.success) {
    // カスタムメッセージを付与して例外化
    throw new ValidationError(message, [{issues: res.issues}]);
  }

  return res.output;
}
