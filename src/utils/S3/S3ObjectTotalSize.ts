import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { config } from '../../config/env';

const s3Client = new S3Client({});

/**
 * Calculates the total size of all objects in an S3 bucket that match a given path.
 *
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} path - The path to match objects against.
 * @return {Promise<number>} The total size of all matched objects in bytes.
 */
export async function S3ObjectTotalSize(bucketName: string, path: string): Promise<number> {
  try {
    const reelInfo = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: path,
      })
    );

    const reelTotalSize = reelInfo.Contents?.reduce((accumulator, currentObject) => accumulator + (currentObject.Size || 0), 0) ?? 1;
    const reelSize = reelTotalSize > 1 ? reelTotalSize : config.reelSize1Mb; // 計算結果が0の場合は1MBを設定

    return reelSize;
  } catch (e: any) {
    throw e;
  }
}
