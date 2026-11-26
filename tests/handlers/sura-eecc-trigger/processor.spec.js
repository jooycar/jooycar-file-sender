const { expect } = require( 'chai' )
const sinon = require( 'sinon' )
const axios = require( 'axios' )
const R = require( 'ramda' )
const { DateTime } = require( 'luxon' )
const { LambdaClient, InvokeCommand } = require( '@aws-sdk/client-lambda' )
const { mockClient } = require( 'aws-sdk-client-mock' )
const suraFilesFn = require( '../../../src/utilities/suraFiles' )
const processorBuilder = require( '../../../src/handlers/sura-eecc-trigger/processor' )

describe( 'utilities/suraFiles', () => {
  let sandbox

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    sandbox.stub( console, 'error' )
  })

  afterEach(() => {
    sandbox.restore()
  })

  it( 'preserves network error message when axios fails without an HTTP response', async() => {
    sandbox.stub( axios, 'request' ).rejects( new Error( 'connect ETIMEDOUT' ))
    const upload = suraFilesFn( 'https://api.example.com', 'key', 'segurosxkm' )

    const err = await upload({ data: 'base64', name: 'doc.pdf' }, 202611, 'EECC' ).catch( e => e )

    expect( err ).to.be.instanceOf( Error )
    expect( err.message ).to.equal( 'connect ETIMEDOUT' )
  })

  it( 'serializes response error payload when HTTP response is present', async() => {
    const httpErr = Object.assign( new Error( 'Bad Request' ), {
      response: { data: { code: 'INVALID_FOLDER' } },
    })
    sandbox.stub( axios, 'request' ).rejects( httpErr )
    const upload = suraFilesFn( 'https://api.example.com', 'key', 'segurosxkm' )

    const err = await upload({ data: 'base64', name: 'doc.pdf' }, 202611, 'EECC' ).catch( e => e )

    expect( err.message ).to.equal( JSON.stringify({ code: 'INVALID_FOLDER' }))
  })
})

describe( 'handlers/sura-eecc-trigger/processor', () => {
  let lambdaMock
  let sandbox

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    lambdaMock = mockClient( LambdaClient )
    sandbox.stub( console, 'log' )
    sandbox.stub( console, 'error' )
  })

  afterEach(() => {
    sandbox.restore()
    lambdaMock.restore()
  })

  const buildDeps = policies => {
    const Balance = {
      find: () => ({
        select: () => ({
          sort: () => ({
            lean: async() => policies.map(( p, idx ) => ({ amount: 1000, refId: `id-${idx}` })),
          }),
        }),
      }),
    }
    const InsurancePolicy = {
      find: () => ({
        select: () => ({
          lean: async() => policies,
        }),
      }),
    }
    return {
      M: {
        models: {
          base: { Types: { ObjectId: id => id } },
          model: name => ( name === 'Balance' ? Balance : InsurancePolicy ),
        },
      },
      log: { info: sinon.spy(), error: sinon.spy() },
      config: {
        get: () => ({
          name: 'sura-eecc-trigger',
          bucket: 'eecc-bucket',
          lambda: 's3-reader',
          strategy: 'sura',
          secret: { container: 'segurosxkm' },
          documentGroup: 'EECC',
          BATCH_SIZE: 10,
        }),
      },
      helpers: { DateTime, R, sleep: async() => {} },
    }
  }

  it( 'counts downstream FunctionError and 500 Payload responses in results.errors and resets results per invocation', async() => {
    const encoder = new TextEncoder()
    const policies = [
      { info: { rut: '11111111-1', proposalId: 'P1' } },
      { info: { rut: '22222222-2', proposalId: 'P2' } },
      { info: { rut: '33333333-3', proposalId: 'P3' } },
    ]
    const deps = buildDeps( policies )
    const processor = await processorBuilder( deps )

    lambdaMock
      .on( InvokeCommand )
      .resolvesOnce({ Payload: encoder.encode( JSON.stringify({ response: { statusCode: 200 } })) })
      .resolvesOnce({ Payload: encoder.encode( JSON.stringify({ response: { statusCode: 500 } })) })
      .resolvesOnce({ FunctionError: 'Unhandled', Payload: encoder.encode( '{"errorMessage":"boom"}' ) })

    const firstRun = await processor.process({})
    expect( firstRun.response.message ).to.include( JSON.stringify({ errors: 2, succes: 1 }))

    // Warm container second invocation must start from fresh counters (0, 0)
    lambdaMock.reset()
    lambdaMock.on( InvokeCommand ).resolves({
      Payload: encoder.encode( JSON.stringify({ response: { statusCode: 200 } })),
    })

    const secondRun = await processor.process({})
    expect( secondRun.response.message ).to.include( JSON.stringify({ errors: 0, succes: 3 }))
  })
})
