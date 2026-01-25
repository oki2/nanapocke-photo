import * as RelationModel from "./Model";
import * as Photo from "../Photo";
export async function setRelationPhotoAlbums(
  p: RelationModel.SetAlbumsOneParamsT,
) {
  // アルバムの紐付け情報を更新
  await RelationModel.update(p);

  // 紐付けされたアルバムの最新情報を取得
  const albumIds = await RelationModel.getAlbumIds(p.facilityCode, p.photoId);
  console.log("albumIds", albumIds);

  // 写真META の albums を更新
  await Photo.setAlbumsOnePhotoSafe(p.facilityCode, p.photoId, albumIds);
}
