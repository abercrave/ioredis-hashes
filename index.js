const Redis = require('ioredis')
const { convertMapToArray, convertObjectToArray, packObject } = require('ioredis/built/utils')
const isPlainObject = require('lodash.isplainobject')

const redis = new Redis()

/**
 * Here's the built-in argument transformer converting:
 * 
 * hmset('key', { k1: 'v1', k2: 'v2' })
 * or:
 * hmset('key', new Map([['k1', 'v1'], ['k2', 'v2']]))
 * 
 * into:
 * 
 * hmset('key', 'k1', 'v1', 'k2', 'v2')
 */
Redis.Command.setArgumentTransformer("hmset", args => {
  if (args.length === 2) {
    const key = args[0]
    const value = args[1]

    if (typeof Map !== "undefined" && value instanceof Map) {
      return [
        key,
        ...convertMapToArray(value)
      ]
    }

    if (typeof value === "object" && value !== null) {
      const convertedObj = convertObjectToArray(value).map(item => {
        if (isPlainObject(item)) {
          return JSON.stringify(item)
        }

        return item
      })

      return [
        key,
        ...convertedObj
      ]
    }
  }

  return args
})

/**
 * Here's the built-in reply transformer converting the HGETALL reply:
 *
 * ['k1', 'v1', 'k2', 'v2']
 * 
 * into:
 * 
 * { k1: 'v1', 'k2': 'v2' }
 */
Redis.Command.setReplyTransformer("hgetall", result => {
  if (Array.isArray(result)) {
    const parsedResult = result.map(item => {
      try {
        return JSON.parse(item)
      } catch (error) {
        return item
      }
    })

    return packObject(parsedResult)
  }

  return result
})

const data = [
  {
    id: 1234,
    metadata: {
      state: 'UT'
    },
    status: 'RECEIVED'
  },
  {
    id: 5678,
    metadata: {
      specialty: 'Cardiology'
    },
    status: 'REQUESTED'
  }
]

function convertArrayToObjectByKey(arr, key) {
  return arr.reduce((acc, item) => {
    acc[item[key] || index] = item
    return acc
  }, {})
}

async function saveArrayAsHash(key, arr) {
  const hash = convertArrayToObjectByKey(arr, 'id')

  console.log('\n******* saveArrayAsHash: *******')
  console.log(hash)
  console.log('***********************\n')

  await redis.hmset(key, hash)
}

async function getHash(key) {
  const result = await redis.hgetall(key)
  return Object.values(result)
}

async function main() {
  await redis.flushall()

  await saveArrayAsHash('testHash', data)

  const result = await getHash('testHash')
  console.log('\n******* getHash Result: *******')
  console.log(result)
  console.log('***********************\n')
}

main()