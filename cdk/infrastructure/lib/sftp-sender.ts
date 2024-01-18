/* eslint-disable camelcase */
import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as aws_lambda from 'aws-cdk-lib/aws-lambda'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import { Construct } from 'constructs'

import { CustomProps, LAYERS_VERSIONS, SHORT_ENVIRONMENTS } from './custom-props'

const path = require( 'path' )

export interface sftpSenderProps extends CustomProps {
    region: string;
    account: string;
    vpc: ec2.IVpc;
    sftpSecrets: secretsmanager.ISecret[]
}

export class sftpSender extends Construct {

  constructor( scope: Construct, id: string, props: sftpSenderProps ) {
    super( scope, id )
    const { vpc, applicationName, region, account, sftpSecrets: secrets } = props

    const lambdaStarterMsLib = aws_lambda.LayerVersion.fromLayerVersionArn( this, 'lambda-layers-lambdaStarterMsLib', `arn:aws:lambda:${region}:${account}:layer:lambda-layers-lambdaStarterMsLib:${LAYERS_VERSIONS.get( props.environment )?.msLib}` )
    const awsSdk3S3Layer = aws_lambda.LayerVersion.fromLayerVersionArn( this, 'lambda-layers-aws-sdk3-s3', `arn:aws:lambda:${region}:${account}:layer:lambda-layers-aws-sdk3-s3:${LAYERS_VERSIONS.get( props.environment )?.awsSdk3S3}` )
    const standardsLayer = aws_lambda.LayerVersion.fromLayerVersionArn( this, 'lambda-layers-standards', `arn:aws:lambda:${region}:${account}:layer:lambda-layers-standards:${LAYERS_VERSIONS.get( props.environment )?.standards}` )
    const sftpUpload = aws_lambda.LayerVersion.fromLayerVersionArn( this, 'lambda-layers-sftpUpload', `arn:aws:lambda:${region}:${account}:layer:lambda-layers-sftpUpload:${LAYERS_VERSIONS.get( props.environment )?.sftpUpload}` )
    const layers = [
      lambdaStarterMsLib,
      awsSdk3S3Layer,
      standardsLayer,
      sftpUpload,
    ]

    const lambda = new aws_lambda.Function( this, `${applicationName}-sftp-sender-${SHORT_ENVIRONMENTS.get( props.environment )}`, {
      functionName: `${applicationName}-sftp-sender-${SHORT_ENVIRONMENTS.get( props.environment )}`,
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      code: aws_lambda.Code.fromDockerBuild( path.join( __dirname, '../../..' ), {
        buildArgs: {
          HANDLER: 'sftp-sender',
        },
      }),
      handler: 'index.handler',
      timeout: cdk.Duration.minutes( 5 ),
      memorySize: 2048,
      vpc,
      layers: layers,
      allowPublicSubnet: false,
      vpcSubnets: { onePerAz: true },
    })
    for ( const secret of secrets )
      secret.grantRead( lambda )
  }
}
