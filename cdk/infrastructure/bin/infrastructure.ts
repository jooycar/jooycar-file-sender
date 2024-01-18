#!/usr/bin/env node
import 'source-map-support/register'

import * as cdk from 'aws-cdk-lib'

import { InfrastructureStack } from '../lib/infrastructure'

const app = new cdk.App()
new InfrastructureStack( app, 'JooycarFileSenderQA', {
  environment: 'qa',
  vpcId: process.env.VPC_ID || 'vpc-1837817d',
  applicationName: process.env.APPLICATION_NAME || 'jooycar-file-sender',
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION || 'us-east-1' },
})

new InfrastructureStack( app, 'jooycarFileSenderProd', {
  environment: 'production',
  vpcId: process.env.VPC_ID || 'vpc-1837817d',
  applicationName: process.env.APPLICATION_NAME || 'jooycar-file-sender',
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION || 'us-east-1' },
})
