import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
const s3Client = new S3Client({});

/**
 * Asynchronously deletes a file from an S3 bucket.
 *
 * @param {string} bucket - The name of the S3 bucket
 * @param {string} key - The key of the file to be deleted
 * @return {Promise<void>} A promise that resolves after the file is deleted
 */
export async function S3FileReadToString(bucket: string, key: string): Promise<string> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
  if (response.Body == undefined) {
    throw new Error(`file undefinde : [ Bucket : ${bucket}, Key: ${key} ]`);
  }
  return response.Body.transformToString();
}
