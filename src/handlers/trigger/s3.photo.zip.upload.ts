import {EventBridgeHandler} from "aws-lambda";

import {S3Client, GetObjectCommand} from "@aws-sdk/client-s3";
import {Upload} from "@aws-sdk/lib-storage";
import * as unzipper from "unzipper";
import * as path from "path";
import {PassThrough} from "stream";

import {AppConfig} from "../../config";

import {sendPhotoUnzipBeforeSave} from "../../utils/SQS";

interface Detail {
  bucketName: string;
  keyPath: string;
  size: string;
}

const s3 = new S3Client({});

const DEST_PREFIX = AppConfig.S3.PREFIX.PHOTO_UPLOAD; // 出力prefix

// 1000枚程度なら 3〜8 くらいで調整（上げすぎるとS3側/ネットワークで逆に遅くなることあり）
const CONCURRENCY = Number(process.env.CONCURRENCY ?? "3");

// 安全弁（ZIP Bomb / 想定外入力対策）
const MAX_ENTRIES = Number(process.env.MAX_ENTRIES ?? "5000"); // エントリ数上限
const MAX_TOTAL_BYTES = Number(
  process.env.MAX_TOTAL_BYTES ?? String(10 * 1024 * 1024 * 1024) // 展開後合計サイズ上限（例: 10GB）
);
const MAX_FILE_BYTES = Number(
  process.env.MAX_FILE_BYTES ?? String(50 * 1024 * 1024) // 1ファイル上限（例: 50MB）
);

function decodeS3Key(key: string) {
  return decodeURIComponent(key.replace(/\+/g, " "));
}

function isImageByExt(p: string): boolean {
  const ext = path.extname(p).toLowerCase();
  return [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".tif",
    ".tiff",
  ].includes(ext);
}

function contentTypeByExt(p: string): string | undefined {
  const ext = path.extname(p).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".bmp":
      return "image/bmp";
    case ".tif":
    case ".tiff":
      return "image/tiff";
    default:
      return undefined;
  }
}

/**
 * Zip Slip 対策:
 * - 絶対パス禁止
 * - ../ を含むなど prefix を抜けるパスは禁止
 * - Windowsの \ も / に寄せる
 */
function safeJoin(prefix: string, entryPath: string): string | null {
  const normalized = entryPath.replace(/\\/g, "/");
  if (normalized.startsWith("/") || normalized.includes("\0")) return null;

  const cleaned = path.posix.normalize(normalized).replace(/^\.\//, "");
  if (cleaned.startsWith("..") || cleaned.includes("/../")) return null;

  const pfx = prefix.replace(/\\/g, "/").replace(/^\/+/, "");
  return path.posix.join(pfx, cleaned);
}

// 簡易セマフォ（p-limitなしで並列数制御）
class Semaphore {
  private running = 0;
  private queue: Array<() => void> = [];
  constructor(private readonly limit: number) {}
  async acquire(): Promise<() => void> {
    if (this.running < this.limit) {
      this.running++;
      return () => this.release();
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.running++;
    return () => this.release();
  }
  private release() {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }
}

export const handler: EventBridgeHandler<string, Detail, any> = async (
  event,
  context
) => {
  const {bucketName, keyPath} = event.detail;
  const [prefix, facilityCode, userId, zipId, fileName] = keyPath.split("/");

  const destBucket = bucketName;

  // 出力先は `unzipped/{zipキー}/...` にする（同名zipでも衝突しにくい）
  const outBasePrefix = path.posix.join(
    DEST_PREFIX,
    keyPath.replace(/\/+$/, "") + "/"
  );

  // ZIPをストリーミングで取得
  const res = await s3.send(
    new GetObjectCommand({Bucket: bucketName, Key: keyPath})
  );
  if (!res.Body) throw new Error("S3 GetObject returned empty body");
  const zipStream = res.Body as NodeJS.ReadableStream;

  const sem = new Semaphore(CONCURRENCY);
  const uploads: Promise<void>[] = [];

  let entryCount = 0;
  let uploadedCount = 0;
  let skippedCount = 0;
  let totalUncompressedBytes = 0;

  const keyPathList: string[] = [];

  const parser = zipStream.pipe(unzipper.Parse({forceStream: true}));

  try {
    for await (const entry of parser as AsyncIterable<unzipper.Entry>) {
      entryCount++;
      if (entryCount > MAX_ENTRIES) {
        entry.autodrain();
        throw new Error(`Too many entries in zip (>${MAX_ENTRIES}).`);
      }

      if (entry.type === "Directory") {
        entry.autodrain();
        continue;
      }

      // 画像以外はスキップ（必要なければこのifは外してください）
      if (!isImageByExt(entry.path)) {
        skippedCount++;
        entry.autodrain();
        continue;
      }

      const outKey = safeJoin(outBasePrefix, entry.path);
      if (!outKey) {
        // 危険なパスは捨てる
        skippedCount++;
        entry.autodrain();
        continue;
      }

      const fileName = safeFileNameFromEntryPath(entry.path);
      if (!fileName) {
        // 危険なファイル名の場合は捨てる
        skippedCount++;
        entry.autodrain();
        continue;
      }

      const release = await sem.acquire();

      const p = (async () => {
        try {
          let fileBytes = 0;

          // entry（解凍ストリーム）を PassThrough に流し、バイト数を実測でカウント
          const counter = new PassThrough();

          counter.on("data", (chunk: Buffer) => {
            fileBytes += chunk.length;
            totalUncompressedBytes += chunk.length;

            // 1ファイルサイズ上限
            if (fileBytes > MAX_FILE_BYTES) {
              counter.destroy(
                new Error(
                  `File too large: ${fileName} (>${MAX_FILE_BYTES} bytes).`
                )
              );
              return;
            }

            // 合計サイズ上限
            if (totalUncompressedBytes > MAX_TOTAL_BYTES) {
              counter.destroy(
                new Error(
                  `Total uncompressed size exceeded limit (>${MAX_TOTAL_BYTES} bytes).`
                )
              );
              return;
            }
          });

          // entry から counter へ pipe（counterが壊れたらentry側も止まる）
          entry.pipe(counter);
          // const contentType = contentTypeByExt(outKey);

          // streamのままS3へアップロード（Uploadは内部で必要に応じてmultipart化）
          const tmpKeyPath = `${AppConfig.S3.PREFIX.PHOTO_UNZIP}/${facilityCode}/${userId}/${zipId}/${fileName}`;
          keyPathList.push(tmpKeyPath); // SQS に送るため

          const uploader = new Upload({
            client: s3,
            params: {
              Bucket: destBucket,
              Key: tmpKeyPath,
              Body: counter,
              // ...(contentType ? {ContentType: contentType} : {}),
            },
            queueSize: 2,
            partSize: 8 * 1024 * 1024,
            leavePartsOnError: false,
          });

          await uploader.done();
          uploadedCount++;
        } finally {
          release();
        }
      })();

      uploads.push(p);
    }

    await Promise.all(uploads);
  } catch (err) {
    // parser/entry の読み取り中に落ちた場合でも、進行中アップロードがあれば待つ/失敗させる
    // ただし counter.destroy した場合 uploader.done() は例外になる
    await Promise.allSettled(uploads);
    throw err;
  }

  // SQS へ送信
  await sendPhotoUnzipBeforeSave(destBucket, keyPathList);

  console.log(
    JSON.stringify(
      {
        bucketName,
        keyPath,
        destBucket,
        outBasePrefix,
        entryCount,
        uploadedCount,
        skippedCount,
        concurrency: CONCURRENCY,
        limits: {
          MAX_ENTRIES,
          MAX_TOTAL_BYTES,
          MAX_FILE_BYTES,
        },
      },
      null,
      2
    )
  );

  return {
    bucketName,
    keyPath,
    destBucket,
    outBasePrefix,
    entryCount,
    uploadedCount,
    skippedCount,
  };
};

/**
 * ZIP内の entry.path から安全なファイル名のみを抽出する
 *
 * - 絶対パス禁止
 * - ../ を含むパスは禁止
 * - NULL文字禁止
 * - 最終要素（basename）のみ返す
 *
 * 危険 / 不正な場合は null を返す
 */
export function safeFileNameFromEntryPath(entryPath: string): string | null {
  // Windows区切りを統一
  const normalized = entryPath.replace(/\\/g, "/");

  // 明らかに危険なもの
  if (normalized.startsWith("/") || normalized.includes("\0")) {
    return null;
  }

  // 正規化（../ を潰す）
  const cleaned = path.posix.normalize(normalized);

  // ../ が残るものは拒否
  if (cleaned.startsWith("..") || cleaned.includes("/../")) {
    return null;
  }

  // ディレクトリ指定のみ（例: "foo/bar/"）
  if (cleaned.endsWith("/")) {
    return null;
  }

  // basename だけ取り出す
  const base = path.posix.basename(cleaned);

  // 念のため空や "." ".." を除外
  if (!base || base === "." || base === "..") {
    return null;
  }

  return base;
}
