export const handler = async (event: any = {}): Promise<any> => {
  console.log("event", event);
  const session = event.request.session || [];
  console.log("session", session);
  const last = session[session.length - 1];
  console.log("last", last);

  // まだ一度もチャレンジを出していない
  if (session.length === 0) {
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
    event.response.challengeName = "CUSTOM_CHALLENGE";
    return event;
  }

  // 直近のカスタムチャレンジが成功したらトークン発行
  if (
    last.challengeName === "CUSTOM_CHALLENGE" &&
    last.challengeResult === true
  ) {
    event.response.issueTokens = true; // ここで発行
    event.response.failAuthentication = false;
    // challengeName を設定しない＝フロー終了
    return event;
  }

  // リトライさせる／失敗にする等の分岐
  if (session.length >= 3) {
    event.response.issueTokens = false;
    event.response.failAuthentication = true; // 失敗終了
  } else {
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
    event.response.challengeName = "CUSTOM_CHALLENGE"; // もう一度チャレンジ
  }
  return event;
};
