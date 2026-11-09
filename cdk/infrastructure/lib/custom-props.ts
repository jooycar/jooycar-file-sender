import * as cdk from 'aws-cdk-lib'

export const LAYERS_VERSIONS = new Map([
  [ 'production', {
    awsSdk3S3: 10,
    msLib: 15,
    standards: 12,
    sftpUpload: 9,
    lambdaStarter: 5
  } ],
  [ 'qa', {
    awsSdk3S3: 10,
    msLib: 15,
    standards: 12,
    sftpUpload: 9,
    lambdaStarter: 5
  } ],
])
// Topic SNS para alarmas (delta-monitor -> AWS Chatbot -> Slack). Sin entrada = sin alarmas (QA).
export const ALARMS_TOPICS = new Map([
  [ 'production', 'delta-monitor' ],
])
export const SHORT_ENVIRONMENTS = new Map([
  [ 'production', 'prod' ],
  [ 'qa', 'qa' ],
])
export interface CustomProps extends cdk.StackProps {
    environment: string;
    vpcId: string;
    applicationName: string;
    securityGroupId: string;
}
