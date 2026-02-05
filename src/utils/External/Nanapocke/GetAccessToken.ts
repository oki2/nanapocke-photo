import axios from "redaxios";
import {GetParameter} from "../../ParameterStore";

const SSM_NANAPOCKE_AUTH_SETTING_PATH =
  process.env.SSM_NANAPOCKE_AUTH_SETTING_PATH || "";

type NanapockeAuthSettingT = {
  client_id: string;
  client_secret: string;
  grant_type: string;
};
let _authSetting: NanapockeAuthSettingT | null = null;

async function getAuthSetting(): Promise<any> {
  if (!_authSetting) {
    const tmp = await GetParameter(SSM_NANAPOCKE_AUTH_SETTING_PATH);
    _authSetting = JSON.parse(tmp);
  }
  return _authSetting;
}

export async function GetAccessToken(
  url: string,
  redirect_uri: string,
  code: string,
): Promise<string> {
  const authSetting = await getAuthSetting();

  const params = new URLSearchParams();
  params.append("client_id", authSetting.client_id);
  params.append("client_secret", authSetting.client_secret);
  params.append("grant_type", authSetting.grant_type);
  params.append("redirect_uri", redirect_uri);
  params.append("code", code);

  console.log("params", params.toString());

  const response = await axios.post(url, params.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  return response.data;
}
