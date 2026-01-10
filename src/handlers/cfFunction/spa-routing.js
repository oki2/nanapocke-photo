function handler(event) {
  var req = event.request;
  var uri = req.uri;

  // どのSPA配下か判定
  var bases = ["/admin", "/studio", "/member"];
  var base = null;
  for (var i = 0; i < bases.length; i++) {
    if (uri === bases[i] || uri.startsWith(bases[i] + "/")) {
      base = bases[i];
      break;
    }
  }
  if (!base) return req;

  // "/admin" -> "/admin/"
  if (uri === base) {
    req.uri = base + "/";
    uri = req.uri;
  }

  // 拡張子が無い（= ルートっぽい）場合は index.html へ
  // 例: /admin/users/1 -> /admin/index.html
  var last = uri.split("/").pop(); // "1" や "app.js" など
  var hasExt = last.includes(".");
  if (!hasExt) {
    req.uri = base + "/index.html";
  }

  return req;
}
