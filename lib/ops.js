const crypto = require('crypto')
const db = require('./db')

module.exports = {
  /**
   * Creates a new single Op from the given BOB tx.
   **/
  async create(tx) {
    return this.fromBOB(tx)
      .then(tape => db('ops').insert(tape))
      .then(this.logDB)
  },

  /**
   * Inserts multiple Ops from the given array of BOB txs.
   * Executes an UPSERT query, replacing Ops with conflicting txid.
   **/
  async insert(txs) {
    return Promise.all(txs.map(tx => this.fromBOB(tx)))
      .then(tapes => {
        const exclusions = Object.keys(tapes[0])
          .filter(k => k !== 'txid')
          .map(k => db.raw('?? = EXCLUDED.??', [k, k]).toString())
          .join(', ')

        const insert = db('ops').insert(tapes),
              update = db.raw(`UPDATE SET ${ exclusions } RETURNING *`);

        return db.raw('? ON CONFLICT (??) DO ?', [insert, 'txid', update]);
      })
      .then(this.logDB)
  },

  /**
   * Deletes all Ops from the database.
   **/
  async deleteAll() {
    return db('ops')
      .del()
      .then(this.logDB)
  },

  /**
   * Deletes all Ops from the given index.
   **/
  async deleteFrom(i) {
    return db('ops')
      .where('blk_i', '>', i)
      .del()
      .then(this.logDB)
  },

  /**
   * Maps the given BOB tx into an object ready to be inserted into database.
   **/
  async fromBOB(tx) {
    const out = tx.out.find(o => o.tape[0].cell.some(c => c.op === 106)),
          tape = out.tape.find(t => t.cell[0].s === '1PcsNYNzonE39gdZkvXEdt7TKBT5bXQoz4'),
          [_p, fn, name] = tape.cell.map(c => c.s || c.ls),
          meta = this.parseMetaTags(fn),
          hash = this.getHash(fn),
          ref = await this.getRef(tx, hash);

    return {
      txid: tx.tx.h,
      hash,
      ref,
      fn,
      name,
      meta: JSON.stringify(meta),
      addr: tx.in[0].e.a,
      conf: !!tx.blk,
      blk_i: tx.blk && tx.blk.i,
      blk_t: tx.blk && tx.blk.t,
      tx_i: tx.i
    }
  },

  /**
   * Parses the Op function's comment section for meta tags and returns an object.
   **/
  parseMetaTags(str) {
    const comments = str.match(/^--\[\[(.+)\]\]--/s)
    const tags = comments ? comments[1].match(/^@(\w+)\s+(.+)$/gm) : false;
    if (tags && tags.length) {
      return tags.map(t => t.match(/^@(\w+)\s+(.+)$/))
        .reduce((obj, m) => {
          obj[m[1]] = m[2];
          return obj;
        }, {})
    }
  },

  /**
   * Hashes the Op function's code and returns a SHA-256 hash.
   **/
  getHash(str) {
    const hash = crypto.createHash('sha256')
    hash.update(str)
    return hash.digest('hex')
  },

  /**
   * Returns the shortest available reference from the given hash.
   **/
  async getRef(tx, hash) {
    let ref;
    for(let bytes = 4; !ref; bytes++) {
      let _ref = hash.substring(0, bytes*2)
      await db('ops')
        .where('ref', _ref)
        .whereNot('txid', tx.tx.h)
        .count()
        .first()
        .then(r => { if (Number(r.count) === 0) ref = _ref })
    }
    return ref;
  },

  /**
   * LogDB
   **/
  logDB(r) {
    console.log('Operate:', 'DB', r.command, r.rowCount)
  }

}

