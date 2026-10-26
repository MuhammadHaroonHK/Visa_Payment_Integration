import mongoose from 'mongoose'
import { env } from './env.js'

let memoryServer = null

export async function connectDatabase() {
  // Tests must never touch a developer or production database, even if a
  // MONGODB_URI is present in the shell or a loaded .env file.
  if (env.IS_TEST) {
    const { MongoMemoryServer } = await import('mongodb-memory-server')

    memoryServer = await MongoMemoryServer.create()
    await mongoose.connect(memoryServer.getUri())
    return
  }

  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required to start the API.')
  }

  await mongoose.connect(env.MONGODB_URI)
}

export async function disconnectDatabase() {
  await mongoose.disconnect()

  if (memoryServer) {
    await memoryServer.stop()
    memoryServer = null
  }
}

export async function clearDatabase() {
  const collections = Object.values(mongoose.connection.collections)

  await Promise.all(collections.map((collection) => collection.deleteMany({})))
}
