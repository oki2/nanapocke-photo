import {ROLE} from "./Model/User";

export const APPLICATION_PATH: Record<string, string> = {
  [ROLE.PRINCIPAL]: "/admin/",
  [ROLE.TEACHER]: "/studio/",
  [ROLE.GUARDIAN]: "/member/",
  [ROLE.PHOTOGRAPHER]: "/studio/",
};
