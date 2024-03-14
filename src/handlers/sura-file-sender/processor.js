module.exports = async deps => {
  const { M, config, helpers: { isPositiveInteger, sleep }, utilities: { suraFilesFn } } = deps
  const ReportLogs = M.models.model( 'ReportLogs' )
  const { name, suraFile: { apiCreateUrl, apiKey, retries } } = config.get( 'handler' )
  const processEvent = async payload => {
    const { secret, metadata, file } = payload
    const { container } = secret
    const suraFile = suraFilesFn( apiCreateUrl, apiKey, container )

    const { filename, idFolder, documentGroup } = metadata
    if ( !isPositiveInteger( idFolder )) throw new Error( `⚠️ IdFolder is not an Integer ❌` )

    const fileUpload = { data: file, name: filename }

    for ( let i = 1; i <= retries; i++ ) {
      try {
        await suraFile( fileUpload, idFolder, documentGroup )

        return {
          response: {
            statusCode: 200,
            body: metadata,
            message: `✅ ${filename} file uploaded successfully !`,
          },
        }
      } catch ( error ) {
        console.error( error )
        await sleep( 1000 )

        if ( i === retries ) {
          const reportLog = new ReportLogs({
            status: 'failure',
            metadata,
            error: error.message,
          })
          await reportLog.save()

          throw error
        }
      }
    }
  }

  return {
    process: processEvent,
    id: _payload => ' ',
    name: () => name,
  }
}
