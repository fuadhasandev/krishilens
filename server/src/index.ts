import express from 'express'
import { app } from './app.js'
import { initializeServer } from './bootstrap.js'
import { errorHandler } from './middleware/error-handler.js'

const serverlessApp = express()

serverlessApp.use(async (_request, _response, next) => {
  try {
    await initializeServer()
    next()
  } catch (error) {
    next(error)
  }
})
serverlessApp.use(app)
serverlessApp.use(errorHandler)

export { app }
export default serverlessApp
