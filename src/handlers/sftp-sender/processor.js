const SftpClient = require( 'ssh2-sftp-client' )
const os = require( 'os' )
const path = require( 'path' )
const fs = require( 'fs' )
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require( '@aws-sdk/client-secrets-manager' )

// Modern algorithms (incl. HMAC SHA-2, required by SURA since 2026-10-20) are
// negotiated first; legacy ones are appended as fallback for older servers
// (e.g. Chilena) that only accepted them with the previous sftp-upload client.
const ALGORITHMS = {
  kex: { append: [ 'diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1' ] },
  cipher: { append: [ 'aes256-cbc', 'aes192-cbc', 'aes128-cbc', '3des-cbc' ] },
  serverHostKey: { append: [ 'ssh-rsa', 'ssh-dss' ] },
}

const sendToSFtpFn = async( { filename, localPath, credentials, remotePath }, attempts = 3 ) => {
  const remoteFile = path.posix.join( remotePath, filename )
  const sftp = new SftpClient()

  try {
    console.log( `Sending ${filename} to ${remoteFile}` )
    await sftp.connect({
      host: credentials.host,
      port: credentials.port || 22,
      username: credentials.username,
      password: credentials.password,
      readyTimeout: 20000,
      algorithms: ALGORITHMS,
    })
    await sftp.put( localPath, remoteFile )
  } catch ( error ) {
    if ( attempts <= 1 ) throw error
    console.log( `Error sending ${filename}, retrying (${attempts - 1} left):`, error.message )

    return sendToSFtpFn({ filename, localPath, credentials, remotePath }, attempts - 1 )
  } finally {
    await sftp.end().catch(() => {})
  }
}

const handleFileWrite = ( file, filename ) => {
  const extension = path.extname( filename ).toLowerCase()
  const localPath = path.join( os.tmpdir(), filename )
  let fileBuffer

  console.log({ extension })

  if ( extension === '.xlsx' || extension === '.xls' )
    fileBuffer = Buffer.isBuffer( file ) ? file : Buffer.from( file, 'base64' )
  else
    fileBuffer = Buffer.from( file )

  fs.writeFileSync( localPath, fileBuffer )

  return localPath
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

    let localPath
    try {
      localPath = handleFileWrite( file, filename )

      const credentials = {
        host: serverUrl,
        port,
        username: user,
        password: pass,
      }

      await sendToSFtpFn({ filename, localPath, credentials, remotePath })

      return {
        response: {
          statusCode: 200,
          body: `Report ${filename} file uploaded successfully`,
        },
      }
    } catch ( error ) {
      console.error( error )
      throw error
    } finally {
      if ( localPath ) fs.rmSync( localPath, { force: true })
    }
  }

  return {
    process: processEvent,
    id: _payload => ' ',
    name: () => name,
  }
}
