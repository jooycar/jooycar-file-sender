const { expect } = require( 'chai' )
const sinon = require( 'sinon' )
const fs = require( 'fs' )
const os = require( 'os' )
const path = require( 'path' )
const SftpClient = require( 'ssh2-sftp-client' )
const { SecretsManagerClient, GetSecretValueCommand } = require( '@aws-sdk/client-secrets-manager' )
const { mockClient } = require( 'aws-sdk-client-mock' )
const processorBuilder = require( '../../../src/handlers/sftp-sender/processor' )

describe( 'handlers/sftp-sender/processor', () => {
  let sandbox
  let connect
  let put
  let end
  const secretsMock = mockClient( SecretsManagerClient )
  const config = { get: () => ({ name: 'sftp-sender' }) }
  const filename = 'A_785_test_2026-11-08.csv'
  const remotePath = `Jooycar/ALTAS/${filename}`
  const localPath = path.join( os.tmpdir(), filename )
  const payload = { secret: 'sftp_secret', metadata: { filename, remotePath }, file: 'col1;col2\nA;B' }

  const mockSecret = ( secret = {}) => secretsMock.on( GetSecretValueCommand ).resolves({
    SecretString: JSON.stringify({ serverUrl: 'sftp.example.com', user: 'user', pass: 'pass', ...secret }),
  })
  const buildProcessor = () => processorBuilder({ config, retryDelayMs: 0 })

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    connect = sandbox.stub( SftpClient.prototype, 'connect' ).resolves()
    put = sandbox.stub( SftpClient.prototype, 'put' ).resolves()
    end = sandbox.stub( SftpClient.prototype, 'end' ).resolves()
    sandbox.stub( console, 'log' )
    sandbox.stub( console, 'error' )
    mockSecret({ port: 22 })
  })

  afterEach(() => {
    sandbox.restore()
    secretsMock.reset()
    fs.rmSync( localPath, { force: true })
  })

  it( 'uploads the file to metadata.remotePath (full remote path) and closes the connection', async() => {
    const processor = await buildProcessor()
    const result = await processor.process( payload )

    expect( result ).to.eql({
      response: { statusCode: 200, body: `Report ${filename} file uploaded successfully` },
    })
    expect( put.calledOnceWithExactly( localPath, remotePath )).to.equal( true )
    expect( connect.calledOnce ).to.equal( true )
    expect( connect.firstCall.args[ 0 ]).to.include({ host: 'sftp.example.com', port: 22, username: 'user', password: 'pass' })
    expect( end.calledOnce ).to.equal( true )
  })

  it( 'normalizes the secret port: string to number, missing or invalid to 22', async() => {
    const processor = await buildProcessor()

    mockSecret({ port: '2222' })
    await processor.process( payload )
    expect( connect.lastCall.args[ 0 ].port ).to.equal( 2222 )

    mockSecret({})
    await processor.process( payload )
    expect( connect.lastCall.args[ 0 ].port ).to.equal( 22 )

    mockSecret({ port: 'abc' })
    await processor.process( payload )
    expect( connect.lastCall.args[ 0 ].port ).to.equal( 22 )
  })

  it( 'retries and succeeds when connect fails twice, closing every attempt', async() => {
    connect.onFirstCall().rejects( new Error( 'handshake failed' ))
    connect.onSecondCall().rejects( new Error( 'handshake failed' ))
    const processor = await buildProcessor()

    const result = await processor.process( payload )

    expect( result.response.statusCode ).to.equal( 200 )
    expect( connect.callCount ).to.equal( 3 )
    expect( put.calledOnce ).to.equal( true )
    expect( end.callCount ).to.equal( 3 )
  })

  it( 'throws after 3 failed attempts and calls end() on each one', async() => {
    put.rejects( new Error( 'permission denied' ))
    const processor = await buildProcessor()

    let error
    try {
      await processor.process( payload )
    } catch ( e ) {
      error = e
    }

    expect( error ).to.be.instanceOf( Error )
    expect( error.message ).to.equal( 'permission denied' )
    expect( connect.callCount ).to.equal( 3 )
    expect( put.callCount ).to.equal( 3 )
    expect( end.callCount ).to.equal( 3 )
  })

  it( 'does not retry on authentication errors (ssh2-sftp-client message format)', async() => {
    connect.rejects( new Error( 'getConnection: All configured authentication methods failed' ))
    const processor = await buildProcessor()

    const error = await processor.process( payload ).catch( e => e )

    expect( error.message ).to.equal( 'getConnection: All configured authentication methods failed' )
    expect( connect.callCount ).to.equal( 1 )
    expect( put.called ).to.equal( false )
    expect( end.callCount ).to.equal( 1 )
    expect( fs.existsSync( localPath )).to.equal( false )
  })

  it( 'does not retry on authentication errors flagged by ssh2 level', async() => {
    const authError = Object.assign( new Error( 'auth rejected' ), { level: 'client-authentication' })
    connect.rejects( authError )
    const processor = await buildProcessor()

    const error = await processor.process( payload ).catch( e => e )

    expect( error ).to.equal( authError )
    expect( connect.callCount ).to.equal( 1 )
  })

  it( 'still retries non-authentication connection errors', async() => {
    connect.onFirstCall().rejects( new Error( 'connect: Timed out while waiting for handshake' ))
    const processor = await buildProcessor()

    const result = await processor.process( payload )

    expect( result.response.statusCode ).to.equal( 200 )
    expect( connect.callCount ).to.equal( 2 )
  })

  it( 'removes the temporary file on success', async() => {
    let existedDuringUpload = false
    put.callsFake( async local => {
      existedDuringUpload = fs.existsSync( local )
    })
    const processor = await buildProcessor()

    await processor.process( payload )

    expect( existedDuringUpload ).to.equal( true )
    expect( fs.existsSync( localPath )).to.equal( false )
  })

  it( 'removes the temporary file on failure', async() => {
    put.rejects( new Error( 'permission denied' ))
    const processor = await buildProcessor()

    await processor.process( payload ).catch(() => {})

    expect( fs.existsSync( localPath )).to.equal( false )
  })
})
