/* eslint-disable camelcase */
import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as aws_lambda from 'aws-cdk-lib/aws-lambda'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import { Construct } from 'constructs'

import { CustomProps, LAYERS_VERSIONS, SHORT_ENVIRONMENTS } from './custom-props'

const path = require( 'path' )

export interface s3ReaderProps extends CustomProps {
    region: string;
    account: string;
    vpc: ec2.IVpc;
    dataSecretsBucket: s3.IBucket;
    secrets: secretsmanager.ISecret[],
    securityGroup: ec2.ISecurityGroup
}

export class s3Reader extends Construct {

  constructor( scope: Construct, id: string, props: s3ReaderProps ) {
    super( scope, id )
    const { vpc, applicationName, region, account, dataSecretsBucket, secrets } = props

    const lambdaStarterMsLib = aws_lambda.LayerVersion.fromLayerVersionArn( this, 'lambda-layers-ms-lib', `arn:aws:lambda:${region}:${account}:layer:lambda-layers-ms-lib:${LAYERS_VERSIONS.get( props.environment )?.msLib}` )
    const awsSdk3S3Layer = aws_lambda.LayerVersion.fromLayerVersionArn( this, 'lambda-layers-aws-sdk3-s3', `arn:aws:lambda:${region}:${account}:layer:lambda-layers-aws-sdk3-s3:${LAYERS_VERSIONS.get( props.environment )?.awsSdk3S3}` )
    const standardsLayer = aws_lambda.LayerVersion.fromLayerVersionArn( this, 'lambda-layers-standards', `arn:aws:lambda:${region}:${account}:layer:lambda-layers-standards:${LAYERS_VERSIONS.get( props.environment )?.standards}` )
    const sftpUpload = aws_lambda.LayerVersion.fromLayerVersionArn( this, 'lambda-layers-sftpUpload', `arn:aws:lambda:${region}:${account}:layer:lambda-layers-sftpUpload:${LAYERS_VERSIONS.get( props.environment )?.sftpUpload}` )
    const lambdaStarterLayer = aws_lambda.LayerVersion.fromLayerVersionArn(
      this,
      "lambda-layers-lambdaStarter",
      `arn:aws:lambda:${region}:${account}:layer:lambda-layers-lambdaStarter:${
          LAYERS_VERSIONS.get(props.environment)?.lambdaStarter
      }`
      );
    const layers = [
      lambdaStarterMsLib,
      awsSdk3S3Layer,
      standardsLayer,
      sftpUpload,
      lambdaStarterLayer
    ]

    const sftpLambda = aws_lambda.Function.fromFunctionArn( this, 'sftp-sender', `arn:aws:lambda:${region}:${account}:function:${applicationName}-sftp-sender-${SHORT_ENVIRONMENTS.get( props.environment )}` )
    const lambda = new aws_lambda.Function( this, `${applicationName}-s3-reader-${SHORT_ENVIRONMENTS.get( props.environment )}`, {
      functionName: `${applicationName}-s3-reader-${SHORT_ENVIRONMENTS.get( props.environment )}`,
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      code: aws_lambda.Code.fromDockerBuild( path.join( __dirname, '../../..' ), {
        buildArgs: {
          HANDLER: 's3-reader',
        },
      }),
      handler: 'index.handler',
      timeout: cdk.Duration.minutes( 5 ),
      memorySize: 2048,
      vpc,
      securityGroups: [props.securityGroup,],
      layers: layers,
      allowPublicSubnet: false,
      vpcSubnets: { onePerAz: true },
    })
    sftpLambda.grantInvoke( lambda )
    dataSecretsBucket.grantReadWrite( lambda )
    for ( const secret of secrets )
      secret.grantRead( lambda )
  }
}
