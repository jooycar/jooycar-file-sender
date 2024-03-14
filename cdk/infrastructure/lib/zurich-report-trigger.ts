/* eslint-disable camelcase */
import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as aws_lambda from 'aws-cdk-lib/aws-lambda'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import { Construct } from 'constructs'

import { CustomProps, LAYERS_VERSIONS, SHORT_ENVIRONMENTS } from './custom-props'

const path = require( 'path' )

export interface zurichReportTriggerProps extends CustomProps {
    region: string;
    account: string;
    vpc: ec2.IVpc;
    dataSecretsBucket: s3.IBucket;
    secrets: secretsmanager.ISecret[],
    securityGroup: ec2.ISecurityGroup
}

export class zurichReportTrigger extends Construct {

  constructor( scope: Construct, id: string, props: zurichReportTriggerProps ) {
    super( scope, id )
    const { vpc, applicationName, region, account, dataSecretsBucket, secrets } = props

    const lambdaStarterMsLib = aws_lambda.LayerVersion.fromLayerVersionArn( this, 'lambda-layers-ms-lib', `arn:aws:lambda:${region}:${account}:layer:lambda-layers-ms-lib:${LAYERS_VERSIONS.get( props.environment )?.msLib}` )
    const awsSdk3S3Layer = aws_lambda.LayerVersion.fromLayerVersionArn( this, 'lambda-layers-aws-sdk3-s3', `arn:aws:lambda:${region}:${account}:layer:lambda-layers-aws-sdk3-s3:${LAYERS_VERSIONS.get( props.environment )?.awsSdk3S3}` )
    const standardsLayer = aws_lambda.LayerVersion.fromLayerVersionArn( this, 'lambda-layers-standards', `arn:aws:lambda:${region}:${account}:layer:lambda-layers-standards:${LAYERS_VERSIONS.get( props.environment )?.standards}` )
    const sftpUpload = aws_lambda.LayerVersion.fromLayerVersionArn( this, 'lambda-layers-sftpUpload', `arn:aws:lambda:${region}:${account}:layer:lambda-layers-sftpUpload:${LAYERS_VERSIONS.get( props.environment )?.sftpUpload}` )
    const lambdaStarterLayer = aws_lambda.LayerVersion.fromLayerVersionArn(
      this,
      'lambda-layers-lambdaStarter',
      `arn:aws:lambda:${region}:${account}:layer:lambda-layers-lambdaStarter:${
        LAYERS_VERSIONS.get( props.environment )?.lambdaStarter
      }`,
    )
    const layers = [
      lambdaStarterMsLib,
      awsSdk3S3Layer,
      standardsLayer,
      sftpUpload,
      lambdaStarterLayer,
    ]

    const s3ReaderLambda = aws_lambda.Function.fromFunctionArn( this, 's3-reader', `arn:aws:lambda:${region}:${account}:function:${applicationName}-s3-reader-${SHORT_ENVIRONMENTS.get( props.environment )}` )
    const lambda = new aws_lambda.Function( this, `${applicationName}-zurich-report-trigger-${SHORT_ENVIRONMENTS.get( props.environment )}`, {
      functionName: `${applicationName}-zurich-report-trigger-${SHORT_ENVIRONMENTS.get( props.environment )}`,
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      code: aws_lambda.Code.fromDockerBuild( path.join( __dirname, '../../..' ), {
        buildArgs: {
          HANDLER: 'zurich-report-trigger',
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
    s3ReaderLambda.grantInvoke( lambda )
    // add event bridge rule to trigger lambda every day at 6am chilean time
    const rule = new cdk.aws_events.Rule( this, 'zurich-report-trigger-rule', {
      schedule: cdk.aws_events.Schedule.cron({ minute: '0', hour: '14' }),
    })
    rule.addTarget( new cdk.aws_events_targets.LambdaFunction( lambda ))
  }
}
