import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as acm from "aws-cdk-lib/aws-certificatemanager";

export interface Props extends cdk.StackProps {
  readonly Config: any;
}

export class Step81CertificateStack extends cdk.Stack {
  public readonly publicCertificateArn: string;
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    // Route53のホストゾーンを取得する
    const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: props.Config.HostedZone.RootDomain,
    });

    // 証明書の発行
    const certPublic = new acm.Certificate(this, "SiteCert", {
      domainName: props.Config.HostedZone.PublicDomain,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    this.publicCertificateArn = certPublic.certificateArn;
  }
}
