import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";
import {AttributeType, Table, BillingMode} from "aws-cdk-lib/aws-dynamodb";

export interface Props extends cdk.StackProps {
  readonly Config: any;
}

export class Step15DynamodbStack extends cdk.Stack {
  public MainTable: Table;
  public AuthFlowTable: Table;
  public NanapockeUserTable: Table;
  public PhotoCatalogTable: Table;
  public AlbumCatalogTable: Table;
  public RelationTable: Table;
  public CommerceTable: Table;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const params = {
      MainTable: {
        Name: `${props.Config.ProjectName}-${props.Config.Stage}-MainTable`,
      },
      PhotoCatalogTable: {
        Name: `${props.Config.ProjectName}-${props.Config.Stage}-PhotoCatalogTable`,
      },
      AlbumCatalogTable: {
        Name: `${props.Config.ProjectName}-${props.Config.Stage}-AlbumCatalogTable`,
      },
      RelationTable: {
        Name: `${props.Config.ProjectName}-${props.Config.Stage}-RelationTable`,
      },
      CommerceTable: {
        Name: `${props.Config.ProjectName}-${props.Config.Stage}-CommerceTable`,
      },
      AuthFlowTable: {
        Name: `${props.Config.ProjectName}-${props.Config.Stage}-AuthFlowTable`,
      },
      NanapockeUserTable: {
        Name: `${props.Config.ProjectName}-${props.Config.Stage}-NanapockeUserTable`,
      },
    };

    // =====================================================
    // DynamoDB
    // =====================================================
    // メインテーブル
    this.MainTable = new Table(this, params.MainTable.Name, {
      tableName: params.MainTable.Name,
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
      },
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
      billingMode: BillingMode.PAY_PER_REQUEST, // PAY_PER_REQUEST 従量課金
    });
    // メインテーブル：ローカルセカンダリインデックス-1
    this.MainTable.addLocalSecondaryIndex({
      indexName: "lsi1_index",
      sortKey: {
        name: "lsi1",
        type: AttributeType.STRING,
      },
    });
    // メインテーブル：ローカルセカンダリインデックス-2
    this.MainTable.addLocalSecondaryIndex({
      indexName: "lsi2_index",
      sortKey: {
        name: "lsi2",
        type: AttributeType.STRING,
      },
    });
    // メインテーブル：ローカルセカンダリインデックス-3
    this.MainTable.addLocalSecondaryIndex({
      indexName: "lsi3_index",
      sortKey: {
        name: "lsi3",
        type: AttributeType.STRING,
      },
    });
    // メインテーブル：ローカルセカンダリインデックス-4
    this.MainTable.addLocalSecondaryIndex({
      indexName: "lsi4_index",
      sortKey: {
        name: "lsi4",
        type: AttributeType.STRING,
      },
    });
    // メインテーブル：ローカルセカンダリインデックス-5
    this.MainTable.addLocalSecondaryIndex({
      indexName: "lsi5_index",
      sortKey: {
        name: "lsi5",
        type: AttributeType.STRING,
      },
    });

    // // メインテーブル：グローバルセカンダリインデックス-1
    // this.MainTable.addGlobalSecondaryIndex({
    //   indexName: "Gsi1_index",
    //   partitionKey: {
    //     name: "GSI_UPLOAD_PK",
    //     type: AttributeType.STRING,
    //   },
    //   sortKey: {
    //     name: "GSI_UPLOAD_SK",
    //     type: AttributeType.STRING,
    //   },
    // });

    // =====================================================
    // 写真管理テーブル
    this.PhotoCatalogTable = new Table(this, params.PhotoCatalogTable.Name, {
      tableName: params.PhotoCatalogTable.Name,
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
      },
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
      billingMode: BillingMode.PAY_PER_REQUEST, // PAY_PER_REQUEST 従量課金
    });
    // GSI Delete - スパースGSI - 削除する写真抽出用
    this.PhotoCatalogTable.addGlobalSecondaryIndex({
      indexName: "GsiDelete_Index",
      partitionKey: {
        name: "GsiDeletePK",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "GsiDeleteSK",
        type: AttributeType.STRING,
      },
    });
    // GSI Seq - スパースGSI - シーケンス番号管理用
    this.PhotoCatalogTable.addGlobalSecondaryIndex({
      indexName: "GsiSeq_Index",
      partitionKey: {
        name: "GsiSeqPK",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "GsiSeqSK",
        type: AttributeType.STRING,
      },
    });

    // GSI - スパースGSI - 園長向け：全件：アップロード日ソート
    this.PhotoCatalogTable.addGlobalSecondaryIndex({
      indexName: "GsiUpload_Index",
      partitionKey: {
        name: "GsiUploadPK",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "GsiUploadSK",
        type: AttributeType.STRING,
      },
    });
    // GSI - スパースGSI - 園長向け：全件：撮影日ソート
    this.PhotoCatalogTable.addGlobalSecondaryIndex({
      indexName: "GsiShooting_Index",
      partitionKey: {
        name: "GsiShootingPK",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "GsiShootingSK",
        type: AttributeType.STRING,
      },
    });
    // GSI - スパースGSI - 園長向け：アルバム未設定：アップロード日ソート
    this.PhotoCatalogTable.addGlobalSecondaryIndex({
      indexName: "GsiUnsetUpload_Index",
      partitionKey: {
        name: "GsiUnsetUploadPK",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "GsiUnsetUploadSK",
        type: AttributeType.STRING,
      },
    });
    // GSI - スパースGSI - 園長向け：アルバム未設定：撮影日ソート
    this.PhotoCatalogTable.addGlobalSecondaryIndex({
      indexName: "GsiUnsetShooting_Index",
      partitionKey: {
        name: "GsiUnsetShootingPK",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "GsiUnsetShootingSK",
        type: AttributeType.STRING,
      },
    });
    // GSI - スパースGSI - 保育士、フォトグラファー向け：自身がアップした写真：アップロード日ソート
    this.PhotoCatalogTable.addGlobalSecondaryIndex({
      indexName: "GsiMy_Index",
      partitionKey: {
        name: "GsiMyPK",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "GsiMySK",
        type: AttributeType.STRING,
      },
    });

    // =====================================================
    // アルバム管理テーブル
    this.AlbumCatalogTable = new Table(this, params.AlbumCatalogTable.Name, {
      tableName: params.AlbumCatalogTable.Name,
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
      },
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
      billingMode: BillingMode.PAY_PER_REQUEST, // PAY_PER_REQUEST 従量課金
    });
    // LSI1 - アルバムの並び順、アップロード日降順ソート
    this.AlbumCatalogTable.addLocalSecondaryIndex({
      indexName: "lsi1_index",
      sortKey: {
        name: "lsi1",
        type: AttributeType.STRING,
      },
    });

    // =====================================================
    // アルバム-写真紐付け管理テーブル
    this.RelationTable = new Table(this, params.RelationTable.Name, {
      tableName: params.RelationTable.Name,
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
      },
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
      billingMode: BillingMode.PAY_PER_REQUEST, // PAY_PER_REQUEST 従量課金
    });
    // アルバム-写真紐付け管理テーブル：ローカルセカンダリインデックス-1
    this.RelationTable.addLocalSecondaryIndex({
      indexName: "lsi1_index",
      sortKey: {
        name: "lsi1",
        type: AttributeType.STRING,
      },
    });

    // =====================================================
    // 決済関連管理テーブル
    this.CommerceTable = new Table(this, params.CommerceTable.Name, {
      tableName: params.CommerceTable.Name,
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
      },
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
      billingMode: BillingMode.PAY_PER_REQUEST, // PAY_PER_REQUEST 従量課金
    });
    // LSI1 - アルバムの並び順、アップロード日降順ソート
    this.CommerceTable.addLocalSecondaryIndex({
      indexName: "lsi1_index",
      sortKey: {
        name: "lsi1",
        type: AttributeType.STRING,
      },
    });
    // GSI - スパースGSI - 保護者決済完了時に自身のデータ取得用
    this.CommerceTable.addGlobalSecondaryIndex({
      indexName: "GsiPaidUser_Index",
      partitionKey: {
        name: "GsiPaidUserPK",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "GsiPaidUserSK",
        type: AttributeType.STRING,
      },
    });

    // =====================================================
    // 認証フローテーブル
    this.AuthFlowTable = new Table(this, params.AuthFlowTable.Name, {
      tableName: params.AuthFlowTable.Name,
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
      },
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
      billingMode: BillingMode.PAY_PER_REQUEST, // アクセス数の絶対数が少ないので PAY_PER_REQUEST
    });

    // =====================================================
    // Nanapockeユーザーテーブル
    this.NanapockeUserTable = new Table(this, params.NanapockeUserTable.Name, {
      tableName: params.NanapockeUserTable.Name,
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
      },
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
      billingMode: BillingMode.PAY_PER_REQUEST, // アクセス数の絶対数が少ないので PAY_PER_REQUEST
    });
    // Nanapockeユーザーテーブル：ローカルセカンダリインデックス-1
    this.NanapockeUserTable.addLocalSecondaryIndex({
      indexName: "lsi1_index",
      sortKey: {
        name: "lsi1",
        type: AttributeType.STRING,
      },
    });
  }
}
