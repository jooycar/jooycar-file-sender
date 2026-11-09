import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import * as aws_lambda from 'aws-cdk-lib/aws-lambda'
import * as sns from 'aws-cdk-lib/aws-sns'

import { ALARMS_TOPICS } from '../lib/custom-props'
import { LambdaErrorAlarm } from '../lib/lambda-error-alarm'

const buildStack = () => {
  const app = new cdk.App()
  const stack = new cdk.Stack( app, 'TestStack', { env: { account: '111111111111', region: 'us-east-1' } })
  const lambda = new aws_lambda.Function( stack, 'fn', {
    functionName: 'jooycar-file-sender-sftp-sender-prod',
    runtime: aws_lambda.Runtime.NODEJS_18_X,
    handler: 'index.handler',
    code: aws_lambda.Code.fromInline( 'exports.handler = async () => {}' ),
  })
  const topic = sns.Topic.fromTopicArn( stack, 'topic', 'arn:aws:sns:us-east-1:111111111111:delta-monitor' )

  new LambdaErrorAlarm( stack, 'alarm', {
    lambda,
    functionName: 'jooycar-file-sender-sftp-sender-prod',
    topic,
    description: 'test',
  })

  return Template.fromStack( stack )
}

test( 'crea alarma de Errors (>= 1 en 5 min) que notifica al topic', () => {
  const template = buildStack()

  template.resourceCountIs( 'AWS::CloudWatch::Alarm', 1 )
  template.hasResourceProperties( 'AWS::CloudWatch::Alarm', {
    AlarmName: 'jooycar-file-sender-sftp-sender-prod (Errors)',
    Namespace: 'AWS/Lambda',
    MetricName: 'Errors',
    Statistic: 'Sum',
    Period: 300,
    Threshold: 1,
    EvaluationPeriods: 1,
    DatapointsToAlarm: 1,
    ComparisonOperator: 'GreaterThanOrEqualToThreshold',
    TreatMissingData: 'notBreaching',
    AlarmActions: [ 'arn:aws:sns:us-east-1:111111111111:delta-monitor' ],
  })
})

test( 'solo production tiene topic de alarmas (QA sin alarmas)', () => {
  expect( ALARMS_TOPICS.get( 'production' )).toBe( 'delta-monitor' )
  expect( ALARMS_TOPICS.get( 'qa' )).toBeUndefined()
})
