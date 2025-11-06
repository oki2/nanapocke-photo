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

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const params = {
      MainTable: {
        Name: `${props.Config.ProjectName}-${props.Config.Stage}-MainTable`,
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

    // 認証フローテーブル
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
  }
}
