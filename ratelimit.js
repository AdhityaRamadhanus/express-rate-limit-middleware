'use strict'

const levelup = require('levelup')
const memdown = require('memdown')
const db = levelup(memdown)
const moment = require('moment')
const extend = require('extend')

module.exports.setLimit = (options) => {
  var reset = options.reset || '1 hour'
  var limit = options.limit || 1000
  var resetTime = reset.split(' ')
  return (req, res, next) => {

    function setKey (opt) {
      console.log('add key', JSON.stringify(opt.objectKey))
      db.put(opt.requestKey, JSON.stringify(opt.objectKey), (err) => {
        if (err) console.log(err)
        next()
      })
    }

    function setHeaders (opt) {
      res.setHeader('X-RateLimit-Limit', opt.limit)
      res.setHeader('X-RateLimit-Remaining', opt.remaining)
      res.setHeader('X-RateLimit-Reset', opt.reset)
    }

    var ip = req.ip
    var url = req.originalUrl
    console.log('Requestor', ip, url)
    var requestKey = `${ip}:ratelimit:${url}`
    db.get(requestKey, (err, value) => {
      if (err) {
        var objectKey = {
          limit: limit,
          reset: moment().add(resetTime[0], resetTime[1]),
          remaining: limit-1
        }
        setKey({
          requestKey: requestKey,
          objectKey: objectKey
        })
        setHeaders(objectKey)
      }
      else {
        var limitObj = JSON.parse(value)
        var newLimit = extend({}, limitObj, {remaining: Math.max(0, limitObj.remaining - 1)})
        setHeaders(newLimit)
        if (moment(limitObj.reset) < moment()){
          setKey({
            requestKey: requestKey
          })
        } else if (limitObj.remaining === 0) {
          (options.limitCallback) 
            ? options.limitCallback(req, res, next, extend({}, newLimit, {ip: ip, url: url})) 
            : res.status(429).send('You shall not pass!')
        } else {
          setKey({
            requestKey: requestKey,
            objectKey: newLimit
          })
        }
      }
    })
  }
}
