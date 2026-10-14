// We load the .env files first making them available to the rest of the code 
require('dotenv').config();

// Load the express - it helps us build a webserver
// require () -> is how you load a package in node.js
const express = require('express');
// We then create the app . Ni  kama ku turn on the app
 const app =  express();

 // We then tell Express to read JSON that arrives in requests. It helps us read the JSON dta that is sent to us
 app.use(express.json());
 const cors = require('cors');
app.use(cors({
  origin: 'https://isaaqkariuki.github.io'
}));

 const routes = require('./routes');
 app.use('/api', routes); // all routes in routes.js get /api prepended 

 // load the database pool we just created
 const { pool: db, initSchema }= require('./db');

 //test Route for the database
 app.get('/test-db',async (req, res)=>{
    try {
        //We will run a simple query to test the connection works without touching any real data
        const [rows] = await db.query('SELECT 1+1 AS result');
        res.json({ connected: true, result: rows[0].result});
    } catch (err) {
        // If an error occurs send back the error message
        res.status(500).json({ connected: false, error: err.message});
    }
 })

 // the first Route. We will use the app.get() which means that when a GET request is done you
 // run this function first
 // '/' means the home path
 // req-> request, res-> the response
 app.get('/',(req, res)=>{
    res.json({ message:'Bei Kiganji API is Live . Hallo hallo'});
});

// we then read the port number from .env file
const PORT =process.env.PORT || 3000;

// we then start the server and tell it to listen to the port 3000
// the function inside runs once when the server successfully starts
initSchema()
    .then(() =>{
        app.listen(PORT, () => console.log(`The server is running on port ${PORT}- tables  ready`));
    })
    .catch(err => {
        console.error('Could not create tables:', err.message);
        process.exit(1); // we stop the server as something is wrong
    })