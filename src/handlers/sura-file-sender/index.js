const processorBuilder = require( './processor' )
const { triggers } = require( 'aws-lambda-starter' )

module.exports = {
  initDeps: async() => {
    const msLib = require( 'ms-lib' )
    const deps = await msLib.setup({ passive: true })
    const suraFilesFn = require( '../../utilities/suraFiles' )
    const helpers = require( '../../utilities/helpers' )

    return Object.assign({}, deps, { helpers, utilities: { suraFilesFn } })
  },
  init: async deps => ({
    processor: await processorBuilder( deps ),
    trigger: await triggers.eventBridge({}),
  }),
}
