/* eslint-disable camelcase */
import * as cdk from 'aws-cdk-lib'
import * as aws_ec2 from 'aws-cdk-lib/aws-ec2'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'

import { CustomProps, SHORT_ENVIRONMENTS } from './custom-props'
import { s3Reader } from './s3-reader'
import { sftpSender } from './sftp-sender'
import { suraEeccTrigger } from './sura-eecc-trigger'
import { suraFileSender } from './sura-file-sender'
import { zurichReportTrigger } from './zurich-report-trigger'

export class InfrastructureStack extends cdk.Stack {
  constructor( scope: cdk.App, id: string, props: CustomProps ) {
    super( scope, id, props )
    const region = this.region
    const accountId = this.account

    const { vpcId, applicationName, environment, securityGroupId } = props

    const privateVpc = aws_ec2.Vpc.fromLookup( this, 'jooycar-vpc', {
      vpcId: vpcId,
    })

    const dataSecretsBucket = s3.Bucket.fromBucketName( this, `${applicationName}-documents-bucket`, `jooycar-data-secrets-${SHORT_ENVIRONMENTS.get( environment )}` )
    const pdfBuilderBucket = s3.Bucket.fromBucketName( this, `${applicationName}-pdf-builder-bucket`, `pdf-builder-${SHORT_ENVIRONMENTS.get( environment )}-documents` )

    const secrets = [
      secretsmanager.Secret.fromSecretNameV2( this, `${applicationName}-secret-mongo`, `${SHORT_ENVIRONMENTS.get( environment )}__mongodb_url__rw` ),
      secretsmanager.Secret.fromSecretNameV2( this, `${applicationName}-secret-mongo-ro`, `${SHORT_ENVIRONMENTS.get( environment )}__mongodb_url__ro` ),
      secretsmanager.Secret.fromSecretNameV2( this, `${applicationName}-secret-redis`, `${SHORT_ENVIRONMENTS.get( environment )}__redis_url` ),
    ]

    const securityGroup = aws_ec2.SecurityGroup.fromSecurityGroupId( this, 'ppm-sg', securityGroupId )

    new s3Reader( this, `${applicationName}-s3-reader-lambda`, {
      environment: props.environment,
      vpcId,
      applicationName,
      securityGroupId,
      account: accountId,
      region,
      vpc: privateVpc,
      dataSecretsBucket,
      pdfBuilderBucket,
      secrets,
      securityGroup,

    })
    const sftpSecrets = [
      secretsmanager.Secret.fromSecretNameV2( this, `${applicationName}-zurich-sftp`, `zurich__sftp__${SHORT_ENVIRONMENTS.get( environment )}` ),
    ]
    new sftpSender( this, `${applicationName}-sftp-sender-lambda`, {
      environment: props.environment,
      vpcId,
      securityGroupId,
      applicationName,
      account: accountId,
      region,
      vpc: privateVpc,
      sftpSecrets,
      securityGroup,
    })
    new suraFileSender( this, `${applicationName}-sura-file-sender-lambda`, {
      environment: props.environment,
      vpcId,
      securityGroupId,
      applicationName,
      account: accountId,
      region,
      vpc: privateVpc,
      secrets,
      securityGroup,
    })
    new zurichReportTrigger( this, `${applicationName}-zurich-report-trigger-lambda`, {
      environment: props.environment,
      vpcId,
      securityGroupId,
      applicationName,
      account: accountId,
      region,
      vpc: privateVpc,
      dataSecretsBucket,
      secrets,
      securityGroup,
    })
    new suraEeccTrigger( this, `${applicationName}-sura-eecc-trigger-lambda`, {
      environment: props.environment,
      vpcId,
      securityGroupId,
      applicationName,
      account: accountId,
      region,
      vpc: privateVpc,
      dataSecretsBucket,
      secrets,
      securityGroup,
      paramsEventRule: { minute: '00', hour: '09', day: '07', month: '*', year: '*' },
    })
  }
}
