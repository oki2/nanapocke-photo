import { S3Client, CopyObjectCommand } from '@aws-sdk/client-s3';
const s3Client = new S3Client({});

/**
 * Copies a file from one S3 bucket to another.
 *
 * @param {string} fromBucket - The source S3 bucket
 * @param {string} fromKey - The source file key
 * @param {string} toBucket - The destination S3 bucket
 * @param {string} toKey - The destination file key
 * @return {Promise<void>} Promise that resolves when the file is successfully copied
 */
export async function S3FileCopy(fromBucket: string, fromKey: string, toBucket: string, toKey: string): Promise<void> {
  const response = await s3Client.send(
    new CopyObjectCommand({
      CopySource: `${fromBucket}/${fromKey}`,
      Bucket: toBucket,
      Key: toKey,
    })
  );
  if (response.$metadata.httpStatusCode != 200) {
    throw new Error(`Copy Error s3://${fromBucket}/${fromKey} to s3://${toBucket}/${toKey}`);
  }
}
