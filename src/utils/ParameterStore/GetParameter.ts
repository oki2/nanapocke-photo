import {SSMClient, GetParameterCommand} from "@aws-sdk/client-ssm";

const MAIN_REGION = process.env.MAIN_REGION || "";

const ssmClient = new SSMClient({region: MAIN_REGION});

/**
 * Retrieves the value of a parameter from the AWS Systems Manager Parameter Store.
 *
 * @param {string} parameterName - The name of the parameter to retrieve.
 * @return {Promise<string>} - A promise that resolves to the value of the parameter.
 * @throws {Error} - If the parameter is not found.
 */
export async function GetParameter(parameterName: string): Promise<string> {
  console.log("parameterName", parameterName);
  const response = await ssmClient.send(
    new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true,
    })
  );
  if (!response.Parameter?.Value) {
    throw new Error(`Parameter undefinde : [ Name : ${parameterName} ]`);
  }
  return response.Parameter.Value;
}
