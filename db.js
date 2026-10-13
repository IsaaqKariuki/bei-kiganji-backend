// this is the translator between Node.js and MYSQL
const mysql = require('mysql2');

// create a pool of database connections
// the pool keeps connections ready and lends them out as needed.
const pool = mysql.createPool({
    host:   process.env.DB_HOST,
    port:   process.env.DB_PORT,
    user:   process.env.DB_USER,
    password:   process.env.DB_PASSWORD,
    database:   process.env.DB_NAME,
    ssl:    { rejectUnauthorized: false},
    waitForConnections: true,
    connectionLimit: 10,
});

const fs = require('fs'); // reads files
const path = require('path');// builds file-paths

//Reads schema.sql and runs each statement  against the database.
async function initSchema (){
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    // split by semicolons to get individual statements
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
    for (const stmt of statements) {
        try{
        await pool.promise().query(stmt);
    }   catch (err) {
        // 1061 = "Duplicate key name" -index already
        if(err.errno !== 1061) throw err;
    }
  }
}
// Export both the pool and the init function
module.exports = { pool:pool.promise(), initSchema};
