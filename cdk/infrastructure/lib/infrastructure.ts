/* eslint-disable camelcase */
import * as cdk from 'aws-cdk-lib'
import * as aws_ec2 from 'aws-cdk-lib/aws-ec2'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'

import { CustomProps, SHORT_ENVIRONMENTS } from './custom-props'
import { s3Reader } from './s3-reader'
import { sftpSender } from './sftp-sender'

export class InfrastructureStack extends cdk.Stack {
  constructor( scope: cdk.App, id: string, props: CustomProps ) {
    super( scope, id, props )
    const region = this.region
    const accountId = this.account

    const { vpcId, applicationName, environment } = props

    const privateVpc = aws_ec2.Vpc.fromLookup( this, 'jooycar-vpc', {
      vpcId: vpcId,
    })

    const dataSecretsBucket = s3.Bucket.fromBucketName( this, `${applicationName}-documents-bucket`, 'jooycar-data-secrets-prod' )

    const secrets = [
      secretsmanager.Secret.fromSecretNameV2( this, `${applicationName}-secret-mongo`, `${SHORT_ENVIRONMENTS.get( environment )}__mongodb_url__rw` ),
      secretsmanager.Secret.fromSecretNameV2( this, `${applicationName}-secret-redis`, `${SHORT_ENVIRONMENTS.get( environment )}__redis_url` ),
    ]

    new s3Reader( this, `${applicationName}-s3-reader-lambda`, {
      environment: props.environment,
      vpcId,
      applicationName,
      account: accountId,
      region,
      vpc: privateVpc,
      dataSecretsBucket,
      secrets,

    })
    const sftpSecrets = [
      secretsmanager.Secret.fromSecretNameV2( this, `${applicationName}-zurich-sftp`, `zurich__sftp__${SHORT_ENVIRONMENTS.get( environment )}` ),
    ]
    new sftpSender( this, `${applicationName}-sftp-sender-lambda`, {
      environment: props.environment,
      vpcId,
      applicationName,
      account: accountId,
      region,
      vpc: privateVpc,
      sftpSecrets,
    })
  }
}
