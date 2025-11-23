import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const DEFAULT_EXPIRES_IN = 60;

const s3Client = new S3Client({});

/**
 * Generates a pre-signed URL for downloading a file from an S3 bucket.
 *
 * @param {string} bucket - The name of the S3 bucket.
 * @param {string} key - The key of the file to download.
 * @param {number} [expiresIn=DEFAULT_EXPIRES_IN] - The expiration time in seconds for the pre-signed URL.
 * @return {Promise<string>} A promise that resolves to the pre-signed URL.
 */

export async function S3GetObjectSignedUrl(bucket: string, key: string, expiresIn: number = DEFAULT_EXPIRES_IN): Promise<string> {
  return await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    {
      expiresIn: expiresIn,
    }
  );
}
