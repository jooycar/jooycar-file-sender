'use strict'

const testServices = require( '@jooycar/test-services' )
const { buildDeps: main } = require( '../src' )

exports.mochaHooks = testServices.mochaHooks( params => main( params, {}, {}))
