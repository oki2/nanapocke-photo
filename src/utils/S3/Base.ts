import {
  S3Client,
  PutObjectCommand,
  CopyObjectCommand,
  GetObjectCommand,
  GetObjectAttributesCommand,
  SelectObjectContentCommand,
  DeleteObjectsCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  StorageClass,
  ExpressionType,
  CompressionType,
} from "@aws-sdk/client-s3";
const s3Client = new S3Client({});
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";

const SIGNED_URL_DEFAULT_EXPIRES_IN = 60;

/**
 * Asynchronously deletes a file from an S3 bucket.
 *
 * @param {string} bucket - The name of the S3 bucket
 * @param {string} key - The key of the file to be deleted
 * @return {Promise<void>} A promise that resolves after the file is deleted
 */
export async function S3DirectoryDelete(
  bucket: string,
  path: string
): Promise<void> {
  //Bucket内のオブジェクトリスト取得
  const objects = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: path,
    })
  );

  if (objects.Contents) {
    // オブジェクト一覧取得
    const keys = objects.Contents.map((d) => ({
      Key: d.Key as string,
    }));

    // オブジェクト一括削除
    await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {Objects: keys},
      })
    );
  }
}

/**
 * Copies a file from one S3 bucket to another.
 *
 * @param {string} fromBucket - The source S3 bucket
 * @param {string} fromKey - The source file key
 * @param {string} toBucket - The destination S3 bucket
 * @param {string} toKey - The destination file key
 * @return {Promise<void>} Promise that resolves when the file is successfully copied
 */
export async function S3FileCopy(
  fromBucket: string,
  fromKey: string,
  toBucket: string,
  toKey: string,
  storageClass: StorageClass = StorageClass.STANDARD
): Promise<void> {
  const response = await s3Client.send(
    new CopyObjectCommand({
      CopySource: `${fromBucket}/${fromKey}`,
      Bucket: toBucket,
      Key: toKey,
      StorageClass: storageClass,
    })
  );
  if (response.$metadata.httpStatusCode != 200) {
    throw new Error(
      `Copy Error s3://${fromBucket}/${fromKey} to s3://${toBucket}/${toKey}`
    );
  }
}

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

/**
 * Asynchronously deletes a file from an S3 bucket.
 *
 * @param {string} bucket - The name of the S3 bucket
 * @param {string} key - The key of the file to be deleted
 * @return {Promise<void>} A promise that resolves after the file is deleted
 */
export async function S3FileReadToByteArray(
  bucket: string,
  key: string
): Promise<Uint8Array> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
  if (response.Body == undefined) {
    throw new Error(`file undefinde : [ Bucket : ${bucket}, Key: ${key} ]`);
  }
  return response.Body.transformToByteArray();
}

/**
 * Asynchronously deletes a file from an S3 bucket.
 *
 * @param {string} bucket - The name of the S3 bucket
 * @param {string} key - The key of the file to be deleted
 * @return {Promise<void>} A promise that resolves after the file is deleted
 */
export async function S3FileReadToString(
  bucket: string,
  key: string
): Promise<string> {
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

/**
 * Retrieves selected data from an S3 bucket using SQL expression.
 *
 * @param {string} bucketName - the name of the S3 bucket
 * @param {string} keyPath - the path to the object in the S3 bucket
 * @param {string} expressionSql - the SQL expression for data selection
 * @return {Promise<any>} a Promise that resolves with the selected data in JSON format
 */
export async function S3FileSelect(
  bucketName: string,
  keyPath: string,
  expressionSql: string
): Promise<any> {
  try {
    const selectResponse = await s3Client.send(
      new SelectObjectContentCommand({
        Bucket: bucketName,
        Key: keyPath,
        ExpressionType: ExpressionType.SQL,
        Expression: expressionSql,
        InputSerialization: {
          CSV: {
            FieldDelimiter: "\t",
          },
          CompressionType: CompressionType.GZIP,
        },
        OutputSerialization: {
          JSON: {
            RecordDelimiter: ",",
          },
        },
      })
    );
    const jsonString = await streamToString(selectResponse.Payload);

    // JSON Object に変換　(配列化が必要な為、[] で囲う)
    const jsonObj = JSON.parse(`[${jsonString.replace(/.$/, "")}]`);
    return jsonObj;
  } catch (e: any) {
    throw e;
  }
}

/**
 * Converts a stream of data to a string.
 *
 * @param {any} generator - the stream generator
 * @return {string} the concatenated string from the stream
 */
async function streamToString(generator: any): Promise<string> {
  const chunks = [];
  for await (const value of generator) {
    if (value.Records) {
      chunks.push(value.Records.Payload);
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Generates a pre-signed URL for downloading a file from an S3 bucket.
 *
 * @param {string} bucket - The name of the S3 bucket.
 * @param {string} key - The key of the file to download.
 * @param {number} [expiresIn=SIGNED_URL_DEFAULT_EXPIRES_IN] - The expiration time in seconds for the pre-signed URL.
 * @return {Promise<string>} A promise that resolves to the pre-signed URL.
 */

export async function S3GetObjectSignedUrl(
  bucket: string,
  key: string,
  expiresIn: number = SIGNED_URL_DEFAULT_EXPIRES_IN
): Promise<string> {
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

/**
 * Generates a pre-signed URL for uploading a file to an S3 bucket.
 *
 * @param {string} bucket - The name of the S3 bucket.
 * @param {string} key - The key of the file to upload.
 * @param {number} [expiresIn=SIGNED_URL_DEFAULT_EXPIRES_IN] - The expiration time in seconds for the pre-signed URL.
 * @return {Promise<string>} A promise that resolves to the pre-signed URL.
 */
export async function S3PutObjectSignedUrl(
  bucket: string,
  key: string,
  expiresIn: number = SIGNED_URL_DEFAULT_EXPIRES_IN
): Promise<string> {
  return await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    {
      expiresIn: expiresIn,
    }
  );
}

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
