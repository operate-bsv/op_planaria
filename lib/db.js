const knex = require('knex')

const environment = process.env.NODE_ENV || 'development';

const connection = {
  development: {
    database : 'op_api_dev'
  },
  production: process.env.DATABASE_URL
}[environment]

console.log('OpPlanaria: Init DB')

module.exports = knex({
  client: 'pg',
  connection
})