const { LambdaClient, InvokeCommand } = require( '@aws-sdk/client-lambda' )

module.exports = async deps => {
  const { config, luxon } = deps
  const { name, bucket, path, filename, lambda, remotePath, strategy, secret } = config.get( 'handler' )

  const lambdaClient = new LambdaClient({ })

  const processEvent = async _payload => {
    //get actual date in format YYYY_MM_DD
    const date = luxon.DateTime.local().setZone( 'America/Santiago' ).minus({ days: 1 }).toFormat( 'yyyy_MM_dd' )
    const file = `${date}_${filename}`
    const payload = {
      s3: {
        bucket,
        key: `${path}/${file}`,
      },
      strategy,
      metadata: {
        filename: file,
        remotePath: `${remotePath}/${file}`,
      },
      secret,
    }
    try {
      const command = new InvokeCommand({
        FunctionName: lambda,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify( payload ),
      })
      const response = await lambdaClient.send( command )
      const resultStart = JSON.parse(
        new TextDecoder( 'utf-8' ).decode( response.Payload ),
      )
      const { body } = resultStart

      return {
        response: {
          statusCode: 200,
          body,
        },
      }
    } catch ( e ) {
      console.error( e )

      return {
        response: {
          statusCode: 500,
        },
      }
    }
  }

  return {
    process: processEvent,
    id: _payload => ' ',
    name: () => name,
  }
}
