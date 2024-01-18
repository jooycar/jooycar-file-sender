exports.mochaHooks = {
  beforeAll: function() {
    this.ctx.beforeEach.collectionsToClean.push(
      'Device',
    )

    this.ctx.innerSinon.spy( this.ctx.deps.log, 'error' )
    this.ctx.innerSinon.spy( this.ctx.deps.log, 'warn' )
  },
}
