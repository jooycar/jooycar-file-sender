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

const safeFetchEnvVar = ( key: string ): string => {
  const value = process.env[ key ]
  if ( !value ) throw new Error( `${key} is required` )

  return value
}

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

    const dataConfigSecrets = safeFetchEnvVar( 'DATA_CONFIG_SECRETS' ).split( ',' )
    const secrets = dataConfigSecrets.map( s => secretsmanager.Secret.fromSecretNameV2( this, `${applicationName}-Secret-${s}`, s ))

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

    const sftpConfigSecrets = safeFetchEnvVar( 'SFTP_CONFIG_SECRETS' ).split( ',' )
    const sftpSecrets = sftpConfigSecrets.map( s => secretsmanager.Secret.fromSecretNameV2( this, `${applicationName}-Secret-${s}`, s ))

    new sftpSender( this, `${applicationName}-sftp-sender-lambda`, {
      environment: props.environment,
      vpcId,
      securityGroupId,
      applicationName,
      account: accountId,
      region,
      vpc: privateVpc,
      securityGroup,
      secrets: sftpSecrets,
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
