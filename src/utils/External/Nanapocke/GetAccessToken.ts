import axios from "redaxios";

export async function GetAccessToken(
  url: string,
  client_id: string,
  client_secret: string,
  grant_type: string,
  redirect_uri: string,
  code: string,
): Promise<string> {
  const params = new URLSearchParams();
  params.append("client_id", client_id);
  params.append("client_secret", client_secret);
  params.append("grant_type", grant_type);
  params.append("redirect_uri", redirect_uri);
  params.append("code", code);

  const response = await axios.post(url, params.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  return response.data;
}
