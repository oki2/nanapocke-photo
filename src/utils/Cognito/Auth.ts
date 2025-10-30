/**
 * 認証系モジュール
 */
import {NotFoundError} from "../../errors/NotFoundError";
import {Setting} from "./Setting";
import {
  CognitoIdentityProviderClient,
  AuthFlowType,
  ChallengeNameType,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
} from "@aws-sdk/client-cognito-identity-provider";

interface SigninResponseSchema {
  result: string;
  idToken?: string;
  accessToken?: string;
  refreshToken?: string;
  challenge?: string;
  session?: string;
  message?: string;
}

export async function Signin(
  region: string,
  userPoolId: string,
  clientId: string,
  userName: string,
  password: string
): Promise<SigninResponseSchema> {
  // Cognitoへリクエスト
  const cognitoClient = new CognitoIdentityProviderClient({
    region: region,
  });

  // Cognito へ認証
  const result = await cognitoClient.send(
    new AdminInitiateAuthCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
      AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
      AuthParameters: {
        USERNAME: userName,
        PASSWORD: password,
      },
    })
  );

  // ID token が取得できたか判定
  if (
    result.AuthenticationResult == undefined ||
    result.AuthenticationResult.IdToken == undefined ||
    result.AuthenticationResult.RefreshToken == undefined
  ) {
    // 仮登録の場合はパスワード強制変更へ遷移させる為の情報を返却する
    if (result.ChallengeName == Setting.SigninResults.Challenge) {
      return {
        result: Setting.SigninResults.Challenge,
        challenge: result.ChallengeName,
        session: result.Session,
      };
    }
    // その他の場合はエラーを返す
    throw new NotFoundError();
  }

  return {
    result: Setting.SigninResults.Success,
    idToken: result.AuthenticationResult.IdToken,
    refreshToken: result.AuthenticationResult.RefreshToken,
    accessToken: result.AuthenticationResult.AccessToken,
  };
}

export async function Challenge(
  region: string,
  userPoolId: string,
  clientId: string,
  userName: string,
  password: string,
  session: string
): Promise<boolean> {
  // Cognitoへリクエスト
  const cognitoClient = new CognitoIdentityProviderClient({
    region: region,
  });

  const result = await cognitoClient.send(
    new AdminRespondToAuthChallengeCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
      ChallengeName: ChallengeNameType.NEW_PASSWORD_REQUIRED,
      Session: session,
      ChallengeResponses: {
        USERNAME: userName,
        NEW_PASSWORD: password,
      },
    })
  );

  // ID token が取得できたか判定 ※メール未認証の場合もエラーとなる
  if (
    result.AuthenticationResult == undefined ||
    result.AuthenticationResult.IdToken == undefined ||
    result.AuthenticationResult.RefreshToken == undefined
  ) {
    return false;
  }

  return true;
}

export async function Refresh(
  region: string,
  userPoolId: string,
  clientId: string,
  refreshToken: string
): Promise<SigninResponseSchema> {
  // Cognitoへリクエスト
  const cognitoClient = new CognitoIdentityProviderClient({
    region: region,
  });

  const result = await cognitoClient.send(
    new AdminInitiateAuthCommand({
      AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
      UserPoolId: userPoolId,
      ClientId: clientId,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    })
  );

  // AccessToken が取得できたか判定 ※メール未認証の場合もエラーとなる
  if (
    !result.AuthenticationResult ||
    !result.AuthenticationResult.AccessToken
  ) {
    throw new NotFoundError();
  }

  return {
    result: Setting.SigninResults.Success,
    idToken: result.AuthenticationResult.IdToken,
    accessToken: result.AuthenticationResult.AccessToken,
  };
}
