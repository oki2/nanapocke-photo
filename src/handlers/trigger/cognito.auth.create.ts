export const handler = async (event: any = {}): Promise<any> => {
  // クライアントに「外部トークンを出してね」という意味合いのメタを付ける（任意）
  event.response.publicChallengeParameters = {type: "external_token"};
  // event.response.privateChallengeParameters = {nonce: Date.now().toString()};
  event.response.challengeMetadata = "requires-external-token";
  return event;
};
