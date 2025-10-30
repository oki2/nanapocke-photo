import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient} from "@aws-sdk/lib-dynamodb";
import {Setting} from "./setting";

let _doc: DynamoDBDocumentClient | null = null;

export function docClient(): DynamoDBDocumentClient {
  if (!_doc) {
    const client = new DynamoDBClient({region: Setting.MAIN_REGION});
    _doc = DynamoDBDocumentClient.from(client);
  }
  return _doc;
}
