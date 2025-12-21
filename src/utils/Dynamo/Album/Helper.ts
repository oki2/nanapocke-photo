import {AlbumConfig} from "../../../config";
import * as AlbumModel from "./Model";

export async function mutableStatusList(
  facilityCode: string
): Promise<{adds: string[]; dels: string[]}> {
  const addList = [];
  const delList = [];

  const result = await AlbumModel.list(facilityCode);
  for (const item of result) {
    switch (item.salesStatus) {
      case AlbumConfig.SALES_STATUS.UNPUBLISHED:
        delList.push(item.albumId);
      case AlbumConfig.SALES_STATUS.DRAFT:
        addList.push(item.albumId);
        break;
    }
    if (item.salesStatus === AlbumConfig.SALES_STATUS.DRAFT) {
      addList.push(item.albumId);
    } else {
      delList.push(item.albumId);
    }
  }

  return {adds: addList, dels: delList};
}
