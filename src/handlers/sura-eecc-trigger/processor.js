const { LambdaClient, InvokeCommand } = require( '@aws-sdk/client-lambda' )

const s3readerFn = ({ bucket, documentGroup, strategy, secret, handler, results, lambda, lambdaClient, NOW, log }) => async( policy, i ) => {
  const { info: { rut, proposalId } } = policy
  const PERIOD = NOW.minus({ months: 1 })
  const filename = `EECC_N_${proposalId}_${PERIOD.toFormat( 'yyyy-MM' )}.pdf`

  const payload = {
    s3: {
      bucket,
      key: `${rut}/${filename}`,
    },
    strategy,
    encoding: 'base64',
    metadata: {
      invoker: handler,
      filename,
      idFolder: +NOW.toFormat( 'yyyyMM' ),
      documentGroup,
    },
    secret,
  }

  try {
    const command = new InvokeCommand({
      FunctionName: lambda,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify( payload ),
    })

    await lambdaClient.send( command )

    log.info( `${filename} uploaded successfully` )

    ++results[ 'succes' ]
  } catch ( e ) {
    log.error( e )

    ++results[ 'errors' ]
  }
}

module.exports = async deps => {
  const { M, log, config, helpers: { DateTime, R, sleep } } = deps
  const ObjectId = M.models.base.Types.ObjectId
  const Balance = M.models.model( 'Balance' )
  const InsurancePolicy = M.models.model( 'InsurancePolicy' )
  const NOW = DateTime.now().setZone( 'America/Santiago' )
  const PERIOD = NOW.minus({ months: 1 }).toFormat( 'yyyy-MM' )
  const { name, bucket, lambda, strategy, secret, documentGroup, BATCH_SIZE } = config.get( 'handler' )
  const lambdaClient = new LambdaClient({ })
  const results = { errors: 0, succes: 0 }
  const s3reader = s3readerFn({ bucket, documentGroup, strategy, secret, handler: name, results, lambda, lambdaClient, NOW, log })

  const processEvent = async _payload => {
    const query = {
      status: { $in: [ 'closed', 'paid' ] },
      'subType': 'premium',
      type: { $in: [ 'sura:seguroxkm2', 'sura:seguroxkm2:corredores' ] },
      'metadata.periodToEval': PERIOD,
    }

    try {
      const balances = await Balance.find( query ).select([ 'amount', 'refId' ]).sort({ _id: 1 }).limit( 5 ).lean()
      if ( !balances || balances.length === 0 ) return { response: { jsonFile: null } }

      const ids = balances.map( b => ObjectId( b.refId ))
      const policies = await InsurancePolicy.find({ _id: { $in: ids } }).select([ 'info' ]).lean()

      const batches = R.splitEvery( BATCH_SIZE, policies )

      for ( const [ idx, batch ] of batches.entries()) {
        console.log( `Batch ${idx + 1} of ${batches.length}` )

        await Promise.all( batch.map( s3reader ))
        await sleep( 500 )
      }

      return {
        response: {
          statusCode: 200,
          message: `EECC period ${PERIOD} files uploaded. Results: ${JSON.stringify( results )}`,
        },
      }
    } catch ( e ) {
      console.error( e )

      return {
        response: {
          statusCode: 500,
        },
      }
    }
  }

  return {
    process: processEvent,
    id: _payload => ' ',
    name: () => name,
  }
}
