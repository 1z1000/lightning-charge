import { join } from 'path'

(async () => {
  process.on('unhandledRejection', err => { throw err })

  const db = require('knex')(require('../knexfile'))
      , ln = require('lightning-client')(process.env.LN_PATH || require('path').join(process.env.HOME, '.lightning'))

  await db.migrate.latest({ directory: join(__dirname, '../migrations') })

  const model = require('./model')(db, ln)
      , auth  = require('./lib/auth')('api-token', process.env.API_TOKEN)
      , payListen = require('./lib/payment-listener')(ln.rpcPath, model)

  const app = require('express')()

  app.set('port', process.env.PORT || 9112)
  app.set('host', process.env.HOST || 'localhost')
  app.set('trust proxy', !!process.env.PROXIED)

  app.use(require('morgan')('dev'))
  app.use(require('body-parser').json())
  app.use(require('body-parser').urlencoded({ extended: true }))

  require('./invoicing')(app, payListen, model, auth)
  require('./webhook')(app, payListen, model, auth)
  require('./websocket')(app, payListen)
  require('./checkout')(app, payListen)

  const server = app.listen(app.settings.port, app.settings.host, _ => {
    console.log(`HTTP server running on ${ app.settings.host }:${ app.settings.port }`)
    app.emit('listening', server)
  })
})()
