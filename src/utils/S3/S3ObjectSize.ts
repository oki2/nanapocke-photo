import {S3Client, GetObjectAttributesCommand} from "@aws-sdk/client-s3";

const s3Client = new S3Client({});

/**
 * Calculates the total size of all objects in an S3 bucket that match a given path.
 *
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} path - The path to match objects against.
 * @return {Promise<number>} The total size of all matched objects in bytes.
 */
export async function S3ObjectSize(
  bucketName: string,
  path: string
): Promise<number> {
  const reelInfo = await s3Client.send(
    new GetObjectAttributesCommand({
      Bucket: bucketName,
      Key: path,
      ObjectAttributes: ["ObjectSize"],
    })
  );
  return reelInfo.ObjectSize ?? 0;
}
