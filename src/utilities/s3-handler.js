module.exports = {
  init: async deps => {
    const { s3Client } = deps
    const { GetObjectCommand, S3Client } = s3Client

    const client = new S3Client({})

    return {

      get: async( bucket, key ) => {
        const command = new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        })
        try {
          const data = await client.send( command )

          return { data, error: null }
        } catch ( error ) {
          return { error, data: null }
        }
      },

    }
  },
}
