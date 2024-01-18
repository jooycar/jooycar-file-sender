if ( process.env.LAMBDA_TASK_ROOT ) process.env.NODE_CONFIG_DIR = `${process.env.LAMBDA_TASK_ROOT}/config`

const config = require( 'config' )
const { handlerStarter, processorBuilder } = require( 'aws-lambda-starter' )

const handlerName = config.get( 'handler.name' )
const handler = handlerStarter( require( `./src/handlers/${handlerName}` ))
let processor

exports.handler = async( event ) => {
  processor = processor || processorBuilder( await handler )

  return processor.execute( event )
}
