const { expect } = require( 'chai' )
const sinon = require( 'sinon' )
const processorBuilder = require( '../../../src/handlers/s3-reader/processor' )
const { LambdaClient, InvokeCommand } = require( '@aws-sdk/client-lambda' )
const { mockClient } = require( 'aws-sdk-client-mock' )
const { s3Handler } = require( '../../../src/utilities/helpers' )

describe( 'handlers/s3-reader/processor', () => {
  let deps
  let sandbox
  const lambdaInvokeMock = mockClient( LambdaClient )
  const config = {
    get: () => ({
      name: 's3-reader',
      strategies: {
        'sftp': 'lambdaSftp',
      },
    }),

  }
  //model function must return a class
  const M = {
    models: {
      model: () => {
        return class {
          constructor( data ) {
            this.data = data
          }

          save() {
            return Promise.resolve( this.data )
          }
        }
      },
    },
  }

  beforeEach(() => {
    deps = {
      config,
      msLibDeps: {
        M,
      },
      s3Client: require( '@aws-sdk/client-s3' ),
    }
    sandbox = sinon.createSandbox()
  })
  afterEach(() => {
    sandbox.restore(),
    lambdaInvokeMock.reset()
  })
  it( 'should invoke the lambda function', async() => {
    const encoder = new TextEncoder()
    const text = JSON.stringify({
      statusCode: 200,
      body: 'test',
    })
    const encoded = encoder.encode( text )
    lambdaInvokeMock.on( InvokeCommand ).resolves({
      Payload: encoded,
    })
    sandbox.stub( s3Handler, 'init' ).callsFake(() => {
      return {
        get: () =>
          Promise.resolve({
            data: {
              Body: {
                transformToString: () => 'test',
              },
            },
          },
          ),
      }
    })
    const processor = await processorBuilder( deps )
    const payload = {
      s3: {
        bucket: 'test',
        key: 'test',
      },
      strategy: 'sftp',
      metadata: {
        test: 'test',
      },
      secret: 'test',
    }

    const result = await processor.process( payload )
    expect( result ).to.eql({
      response: {
        body: 'test',
        statusCode: 200,

      },
    })
  })
})
