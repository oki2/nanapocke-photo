import { S3Client, SelectObjectContentCommand, ExpressionType, CompressionType } from '@aws-sdk/client-s3';
const s3Client = new S3Client({});

/**
 * Retrieves selected data from an S3 bucket using SQL expression.
 *
 * @param {string} bucketName - the name of the S3 bucket
 * @param {string} keyPath - the path to the object in the S3 bucket
 * @param {string} expressionSql - the SQL expression for data selection
 * @return {Promise<any>} a Promise that resolves with the selected data in JSON format
 */
export async function S3FileSelect(bucketName: string, keyPath: string, expressionSql: string): Promise<any> {
  try {
    const selectResponse = await s3Client.send(
      new SelectObjectContentCommand({
        Bucket: bucketName,
        Key: keyPath,
        ExpressionType: ExpressionType.SQL,
        Expression: expressionSql,
        InputSerialization: {
          CSV: {
            FieldDelimiter: '\t',
          },
          CompressionType: CompressionType.GZIP,
        },
        OutputSerialization: {
          JSON: {
            RecordDelimiter: ',',
          },
        },
      })
    );
    const jsonString = await streamToString(selectResponse.Payload);

    // JSON Object に変換　(配列化が必要な為、[] で囲う)
    const jsonObj = JSON.parse(`[${jsonString.replace(/.$/, '')}]`);
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
  return Buffer.concat(chunks).toString('utf8');
}
