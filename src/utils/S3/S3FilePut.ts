import {S3Client, PutObjectCommand, StorageClass} from "@aws-sdk/client-s3";
const s3Client = new S3Client({});

/**
 * Uploads a file to an S3 bucket.
 *
 * @param {string} bucket - The name of the S3 bucket.
 * @param {string} key - The key under which to store the file in the S3 bucket.
 * @param {string | Buffer} body - The content of the file to upload.
 * @return {Promise<void>} A promise that resolves when the file is successfully uploaded.
 */
export async function S3FilePut(
  bucket: string,
  key: string,
  body: string | Buffer,
  contentType: string | undefined = undefined,
  storageClass: StorageClass = StorageClass.STANDARD
): Promise<void> {
  const response = await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      StorageClass: storageClass,
    })
  );
}
