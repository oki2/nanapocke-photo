import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
const s3Client = new S3Client({});

/**
 * Asynchronously deletes a file from an S3 bucket.
 *
 * @param {string} bucket - The name of the S3 bucket
 * @param {string} key - The key of the file to be deleted
 * @return {Promise<void>} A promise that resolves after the file is deleted
 */
export async function S3FileDelete(bucket: string, key: string): Promise<void> {
  try {
    const response = await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return;
  } catch (e: any) {
    throw e;
  }
}
