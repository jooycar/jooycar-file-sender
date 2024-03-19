const processorBuilder = require( './processor' )
const { triggers } = require( 'aws-lambda-starter' )

module.exports = {
  initDeps: async() => {
    const msLib = require( 'ms-lib' )
    const deps = await msLib.setup({ passive: true })
    const helpers = require( '../../utilities/helpers' )
    const { DateTime } = require( 'luxon' )
    const R = require( 'ramda' )

    return Object.assign({}, deps, { helpers: { ...helpers, DateTime, R } })
  },
  init: async deps => ({
    processor: await processorBuilder( deps ),
    trigger: await triggers.eventBridge({}),
  }),
}
