const SftpUpload = require( 'sftp-upload' )
const os = require( 'os' )
const path = require( 'path' )

const tmpPath = file => path.join( os.tmpdir(), file )

const sendToSFtpFn = async( filename, credentials, remotePath, attempts = 2 ) => {
  console.log( `Sending ${filename}` )
  const opt = {
    host: credentials.host,
    username: credentials.username,
    password: credentials.password,
    path: tmpPath( filename ),
    remoteDir: remotePath,
    dryRun: false,
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

module.exports = sendToSFtpFn
