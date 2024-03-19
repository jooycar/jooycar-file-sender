module.exports = {
  s3Handler: require( './s3-handler' ),
  isPositiveInteger: number => Number.isInteger( number ) && number >= 0,
  sleep: milliseconds => {
    return new Promise( resolve => setTimeout( resolve, milliseconds ))
  },
}
