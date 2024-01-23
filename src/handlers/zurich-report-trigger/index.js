const processorBuilder = require( './processor' )
const { triggers } = require( 'aws-lambda-starter' )

module.exports = {
  initDeps: async() => {
    const msLib = require( 'ms-lib' )
    const msLibDeps = await msLib.setup({ passive: true })

    const deps = {
      config: require( 'config' ),
      msLibDeps,
      luxon: require( 'luxon' ),
    }

    return deps
  },
  init: async deps => ({
    processor: await processorBuilder( deps ),
    trigger: await triggers.eventBridge({}),
  }),
}
