/* eslint-disable camelcase */
import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as aws_lambda from 'aws-cdk-lib/aws-lambda'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import { Construct } from 'constructs'

import { CustomProps, LAYERS_VERSIONS, SHORT_ENVIRONMENTS } from './custom-props'

const path = require( 'path' )

export interface suraFileSenderProps extends CustomProps {
    region: string;
    account: string;
    vpc: ec2.IVpc;
    secrets: secretsmanager.ISecret[],
    securityGroup: ec2.ISecurityGroup
}

export class suraFileSender extends Construct {

  constructor( scope: Construct, id: string, props: suraFileSenderProps ) {
    super( scope, id )
    const { vpc, applicationName, region, account, secrets } = props

    const lambdaStarterMsLib = aws_lambda.LayerVersion.fromLayerVersionArn( this, 'lambda-layers-ms-lib', `arn:aws:lambda:${region}:${account}:layer:lambda-layers-ms-lib:${LAYERS_VERSIONS.get( props.environment )?.msLib}` )
    const standardsLayer = aws_lambda.LayerVersion.fromLayerVersionArn( this, 'lambda-layers-standards', `arn:aws:lambda:${region}:${account}:layer:lambda-layers-standards:${LAYERS_VERSIONS.get( props.environment )?.standards}` )

    const lambdaStarterLayer = aws_lambda.LayerVersion.fromLayerVersionArn(
      this,
      'lambda-layers-lambdaStarter',
      `arn:aws:lambda:${region}:${account}:layer:lambda-layers-lambdaStarter:${
        LAYERS_VERSIONS.get( props.environment )?.lambdaStarter
      }`,
    )
    const layers = [
      lambdaStarterMsLib,
      standardsLayer,
      lambdaStarterLayer,
    ]

    const LogGroup = new cdk.aws_logs.LogGroup( this, `${applicationName}-sura-file-sender-${SHORT_ENVIRONMENTS.get( props.environment )}-log-group`, {
      logGroupName: `/aws/lambda/${applicationName}-sura-file-sender-${SHORT_ENVIRONMENTS.get( props.environment )}`,
      retention: cdk.aws_logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    const lambda = new aws_lambda.Function( this, `${applicationName}-sura-file-sender-${SHORT_ENVIRONMENTS.get( props.environment )}`, {
      functionName: `${applicationName}-sura-file-sender-${SHORT_ENVIRONMENTS.get( props.environment )}`,
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      code: aws_lambda.Code.fromDockerBuild( path.join( __dirname, '../../..' ), {
        buildArgs: {
          HANDLER: 'sura-file-sender',
          HANDLER_ENVIRONMENT: `${SHORT_ENVIRONMENTS.get( props.environment )}`,
        },
      }),
      handler: 'index.handler',
      timeout: cdk.Duration.minutes( 5 ),
      memorySize: 2048,
      vpc,
      securityGroups: [ props.securityGroup ],
      layers: layers,
      allowPublicSubnet: false,
      vpcSubnets: { onePerAz: true },
    })

    LogGroup.grantWrite( lambda )

    for ( const secret of secrets )
      secret.grantRead( lambda )
  }
}
