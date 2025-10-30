export const handler = async (event: any = {}): Promise<any> => {
  console.log("event", event);
  // const answer = event.request.challengeAnswer; // /auth/login から渡した externalAccessToken
  // const expectedUid = event.userName;

  // try {
  //   const {uid} = await verifyExternalToken(answer);
  //   const ok = uid === expectedUid;

  //   event.response.answerCorrect = true;
  //   event.response.issueTokens = true;
  //   event.response.failAuthentication = false;
  //   // event.response.answerCorrect = ok;
  //   // event.response.issueTokens = ok;
  //   // event.response.failAuthentication = !ok;
  // } catch {
  //   event.response.answerCorrect = false;
  //   event.response.issueTokens = false;
  //   event.response.failAuthentication = true;
  // }
  event.response.answerCorrect = true;
  return event;
};

async function verifyExternalToken(token: string): Promise<{uid: string}> {
  // ここに IdP 検証（iss/aud/exp など）やAPI照会を実装
  // 例: JWKS 検証 → claims.sub を uid に
  return {uid: "external-uid-example"};
}
