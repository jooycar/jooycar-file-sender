const helpers = require( '../../utilities/helpers' )
const { LambdaClient, InvokeCommand } = require( '@aws-sdk/client-lambda' )

module.exports = async deps => {
  const { config, msLibDeps } = deps
  const { M } = msLibDeps
  const { name, strategies } = config.get( 'handler' )
  const { get } = await helpers.s3Handler.init( deps )
  const lambda = new LambdaClient({ })
  const ReportLogs = M.models.model( 'ReportLogs' )
  const processEvent = async payload => {
    const { s3: { bucket, key }, strategy, metadata, secret } = payload
    //get file from s3
    const { data, error } = await get( bucket, key )
    if ( error ) {
      console.log( error )

      return {
        response: {
          statusCode: 500,
        },
      }
    }
    //create file

    //get file content as csv
    const file = await data.Body.transformToString()
    //invoke lambda
    const lambdaPayload = {
      file,
      metadata,
      secret,
    }
    const command = new InvokeCommand({
      FunctionName: strategies[ 0 ][ strategy ],
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify( lambdaPayload ),
    })
    try {
      const response = await lambda.send( command )
      const resultStart = JSON.parse(
        new TextDecoder( 'utf-8' ).decode( response.Payload ),
      )
      const { body } = resultStart

      const reportLog = new ReportLogs({
        status: 'success',
        metadata,
      })
      await reportLog.save()

      return {
        response: {
          statusCode: 200,
          body,
        },
      }
    } catch ( e ) {
      console.error( e )
      const reportLog = new ReportLogs({
        status: 'failure',
        metadata })
      await reportLog.save()

      return {

        response: {
          statusCode: 500,
          error: e,
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
