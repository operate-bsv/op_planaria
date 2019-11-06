const { planaria }  = require('neonplanaria')
const db = require('./lib/db')
const ops = require('./lib/ops')

planaria.start({
  filter: {
    "name": "Operate",
    "host": { "bitbus": "https://bob.bitbus.network" },
    "from": 590000,
    "q": {
      "find": {
        "out.tape.cell": {
          "$elemMatch": {
            "i": 0,
            "s": "1PcsNYNzonE39gdZkvXEdt7TKBT5bXQoz4"
          }
        }
      }
    }
  },

  async onstart(e) {
    if (e.tape.self.start === null) {
      console.log(`OpPlanaria: Starting from ${ e.head }`)
      ops.deleteAll()
    } else {
      console.log(`OpPlanaria: Starting from ${ e.tape.self.end }`)
      ops.deleteFrom(e.tape.self.end)
    }
  },

  async onmempool(e) {
    ops.create(e.tx)
      .catch(err => {
        console.error(err)
        console.error('TX', e.tx)
      })
  },

  async onblock(e) {
    ops.insert(e.tx)
      .catch(err => {
        console.error(err)
        console.error('TX', e.tx)
      })
  }
})