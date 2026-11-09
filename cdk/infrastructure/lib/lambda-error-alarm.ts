import * as cdk from 'aws-cdk-lib'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as aws_lambda from 'aws-cdk-lib/aws-lambda'
import * as sns from 'aws-cdk-lib/aws-sns'
import { Construct } from 'constructs'

export interface LambdaErrorAlarmProps {
  lambda: aws_lambda.IFunction;
  topic: sns.ITopic;
  description: string;
}

/**
 * Alarma sobre AWS/Lambda Errors: salta con 1 o más errores en 5 minutos.
 * Los periodos sin invocaciones no cuentan como falla (notBreaching).
 */
export class LambdaErrorAlarm extends Construct {
  constructor( scope: Construct, id: string, props: LambdaErrorAlarmProps ) {
    super( scope, id )
    const { lambda, topic, description } = props

    const alarm = new cloudwatch.Alarm( this, 'errors-alarm', {
      alarmName: `${lambda.functionName} (Errors)`,
      alarmDescription: description,
      metric: lambda.metricErrors({
        period: cdk.Duration.minutes( 5 ),
        statistic: cloudwatch.Stats.SUM,
      }),
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    })

    alarm.addAlarmAction( new cloudwatchActions.SnsAction( topic ))
  }
}
