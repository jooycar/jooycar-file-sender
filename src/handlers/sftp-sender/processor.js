const SftpUpload = require( 'sftp-upload' )
const os = require( 'os' )
const path = require( 'path' )
const fs = require( 'fs' )
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require( '@aws-sdk/client-secrets-manager' )

const tmpPath = file => path.join( os.tmpdir(), file )
const sendToSFtpFn = async( filename, credentials, remotePath, attempts = 2, port ) => {
  console.log( `Sending ${filename}` )
  const opt = {
    host: credentials.host,
    username: credentials.username,
    password: credentials.password,
    path: tmpPath( filename ),
    remoteDir: remotePath,
    dryRun: false,
    port,
    algorithms: {
      serverHostKey: [ 'ssh-dss' ],
    },
  }
  const sftp = new SftpUpload( opt )

  return new Promise(( resolve, reject ) => {
    sftp
      .on( 'error', function( err ) {
        if ( err && attempts > 0 )
          sendToSFtpFn( filename, credentials, remotePath, attempts - 1 )

        reject( err )
      })
      .on( 'uploading', resolve )
      .on( 'completed', resolve )
      .upload()
  })
}

const handleFileWrite = ( file, filename ) => {
  let fileBuffer
  const extension = path.extname( filename ).toLowerCase()
  const localPath = path.join( os.tmpdir(), filename )

  if ( extension === '.xlsx' || extension === '.xls' )
    fileBuffer = Buffer.isBuffer( file ) ? file : Buffer.from( file, 'base64' )
  else
    fileBuffer = Buffer.from( file )

  fs.writeFileSync( localPath, fileBuffer )
}

module.exports = async deps => {
  const { config } = deps
  const { name } = config.get( 'handler' )
  const client = new SecretsManagerClient({})
  const processEvent = async payload => {
    const { secret, metadata, file } = payload

    const command = new GetSecretValueCommand({
      SecretId: secret,
    })
    const { SecretString } = await client.send( command )
    const sftpConfig = JSON.parse( SecretString )
    const { serverUrl, port, user, pass } = sftpConfig
    const { filename, remotePath } = metadata

    try {
      handleFileWrite( file, filename )

      const credentials = {
        host: serverUrl,
        username: user,
        password: pass,
      }

      const { percent, error = '' } = await sendToSFtpFn( filename, credentials, remotePath, port )

      const response = ( percent === 0 ) ? error : `Report ${filename} file uploaded successfully`

      return {
        response: {
          statusCode: 200,
          body: response,
        },
      }
    } catch ( error ) {
      console.error( error )
      throw error
    }
  }

  return {
    process: processEvent,
    id: _payload => ' ',
    name: () => name,
  }
}
