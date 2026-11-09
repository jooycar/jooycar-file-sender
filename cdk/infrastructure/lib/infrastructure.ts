/* eslint-disable camelcase */
import * as cdk from 'aws-cdk-lib'
import * as aws_ec2 from 'aws-cdk-lib/aws-ec2'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as sns from 'aws-cdk-lib/aws-sns'

import { ALARMS_TOPICS, CustomProps, SHORT_ENVIRONMENTS } from './custom-props'
import { LambdaErrorAlarm } from './lambda-error-alarm'
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

    const s3ReaderLambda = new s3Reader( this, `${applicationName}-s3-reader-lambda`, {
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

    const sftpSenderLambda = new sftpSender( this, `${applicationName}-sftp-sender-lambda`, {
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

    // DJ-1680: alarmas de errores (solo en entornos con topic configurado, hoy production)
    const alarmsTopicName = ALARMS_TOPICS.get( environment )
    if ( alarmsTopicName ) {
      const alarmsTopic = sns.Topic.fromTopicArn( this, `${applicationName}-alarms-topic`, `arn:aws:sns:${region}:${accountId}:${alarmsTopicName}` )

      new LambdaErrorAlarm( this, `${applicationName}-sftp-sender-errors-alarm`, {
        lambda: sftpSenderLambda.lambda,
        functionName: sftpSenderLambda.functionName,
        topic: alarmsTopic,
        description: 'Falló un envío por SFTP (reportes de altas SURA, Sura_leads, Chilena, etc.). Revisar logs de la lambda para ver el archivo y el error. Ver DJ-1679.',
      })

      new LambdaErrorAlarm( this, `${applicationName}-s3-reader-errors-alarm`, {
        lambda: s3ReaderLambda.lambda,
        functionName: s3ReaderLambda.functionName,
        topic: alarmsTopic,
        description: 'Falló s3-reader (lectura del archivo en S3 o invocación de la estrategia de envío). Revisar logs de la lambda.',
      })
    }

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
