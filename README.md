# NANAPOCKE-PHOTO

LIKE の運営する「ナナポケ」向け写真販売サービス用プロジェクト

# SecretKey ParameterStore SecretsManager の設定

## キーペアの作成

以下を VSCode のターミナル等で実行

1. キーペアを生成 `openssl genrsa -out private_key.pem 2048`

2. 生成したキーペアからパブリックキーを抽出 `openssl rsa -pubout -in private_key.pem -out public_key.pem`

## キーペアの登録

1. SSM パラメータストアに登録 `bin/shopreel.ts` の `config.CloudFront` 配下の情報を参考にパラメータストアへ登録

| 名前 | Type | 説明 |
| :-- | :-: | :-- |
| /NanaPhoto/sandbox/cfd/thumbnail-access-cookie-pem/private | Secure | CloudFront 写真、アルバムのサムネイル画像アクセス用 URL の秘密鍵 |
| /NanaPhoto/sandbox/cfd/thumbnail-access-cookie-pem/public |  | CloudFront アルバムのサムネイル画像アクセス用 URL の公開鍵 |
