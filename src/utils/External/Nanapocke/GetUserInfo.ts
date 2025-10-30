import axios from "redaxios";

export async function GetUserInfo(url: string, token: string): Promise<any> {
  const response = await axios.get(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
}
