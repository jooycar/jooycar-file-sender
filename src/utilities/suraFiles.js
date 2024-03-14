const axios = require( 'axios' )

/**
 * @param {string} apiUrl
 * @param {string} apiKey
 * @param {string} container Allowed: `segurosxkm | conductor-pro`
 * @return {CreateFile}
 */
module.exports = ( apiUrl, apiKey, container ) => {
  const config = {
    url: apiUrl,
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      Container: container,
      'Content-Type': 'application/json',
    },
  }

  return async( file, idFolder, documentGroup ) => {
    const data = {
      newFileData: file.data,
      idFolder,
      fileName: file.name,
      documentGroup,
    }

    try {
      const response = await axios.request({ ...config, data })

      return /^20\d/.test( response.status )
    } catch ( e ) {
      console.error( e.response.data )
      throw new Error( JSON.stringify( e.response.data ))
    }
  }
}

/**
 * @callback CreateFile
 * @param {File} file
 * @param {string} policy Example `7654321`
 * @param {string} type Example: `unset`, `renewal`
 * @returns {Promise<boolean>}
 */

/**
 * @typedef {object} File
 * @property {string} data File data in Base64
 * @property {string} name File name including extension
 */
