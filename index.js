const Redis = require('ioredis')
const { convertMapToArray, convertObjectToArray, packObject } = require('ioredis/built/utils')
const isPlainObject = require('lodash.isplainobject')

const redis = new Redis()

/**
 * Use the built-in argument transformer to convert the second argument in the HMSET command:
 * 
 *   hmset('key', { k1: 'v1', k2: 'v2' })
 * 
 * or:
 * 
 *    hmset('key', new Map([['k1', 'v1'], ['k2', 'v2']]))
 * 
 * into:
 * 
 *   hmset('key', 'k1', 'v1', 'k2', 'v2')
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

    if (value && typeof value === "object") {
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
 * Use the built-in reply transformer to convert the HGETALL reply:
 *
 *   ['k1', 'v1', 'k2', 'v2']
 * 
 * into:
 * 
 *   { k1: 'v1', 'k2': 'v2' }
 */
Redis.Command.setReplyTransformer("hgetall", result => {
  if (Array.isArray(result)) {
    // Attempt to parse each item as JSON or, on failure, return it as-is
    const parsedResult = result.map(item => {
      try {
        return JSON.parse(item)
      } catch (error) {
        return item
      }
    })

    // Use the internal ioredis util to return the result as an object literal
    return packObject(parsedResult)
  }

  return result
})

/**
 * 
 * @param {array} arr - The array of objects
 * @param {string} key - The key under which each child object will be stored in the resulting 
 *   object. If said key is not defined on the child it will default to its 
 *   numerical index in the array
 * @returns {object} 
 */
function convertArrayToObjectByKey(arr, key) {
  return arr.reduce((acc, item) => {
    acc[(isPlainObject(item) && item[key]) || index] = item
    return acc
  }, {})
}

/**
 * Sets an array of object literals as a hash of fields identified by the supplied key
 * 
 * @param {string} key - The key under which the hash will be stored
 * @param {array} arr - The array of objects
 */
async function setArrayAsHash(key, arr) {
  const hash = convertArrayToObjectByKey(arr, 'id')

  console.log('\n******* setArrayAsHash *******')
  console.log(hash)
  console.log('***********************\n')

  await redis.hmset(key, hash)
}

/**
 * Returns a Redis hash as an array
 * 
 * @param {string} key - The key of the hash to retrieve
 * @returns {Array} The transformed hash
 */
async function getHashAsArray(key) {
  const hash = await redis.hgetall(key)
  const result = Object.values(hash)

  console.log('\n******* getHashAsArray *******')
  console.log(result)
  console.log('***********************\n')

  return result
}

/**
 * An array of object literals
 */
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

async function main() {
  // Clear the cache on each run
  await redis.flushall()

  // Save the data array under the testHash key
  await setArrayAsHash('testHash', data)

  // Get the contents of the testHash as an array
  await getHashAsArray('testHash')
}

main()