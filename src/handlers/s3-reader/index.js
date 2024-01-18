const processorBuilder = require( './processor' )
const { triggers } = require( 'aws-lambda-starter' )

module.exports = {
  initDeps: async() => {
    const msLib = require( 'models' )
    const msLibDeps = await msLib.setup({ passive: true })

    const deps = {
      config: require( 'config' ),
      s3Client: require( '@aws-sdk/client-s3' ),
      msLibDeps,
    }

    return deps
  },
  init: async deps => ({
    processor: await processorBuilder( deps ),
    trigger: await triggers.eventBridge({}),
  }),
}
