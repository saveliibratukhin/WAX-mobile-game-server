const express = require('express')
const router = require('./api/router')
const app = express()
require('dotenv').config()


app.use(express.json())
app.use('/', router)


const start = async () => {
    try{
        app.listen(process.env.PORT, () => console.log('server started on port ' + process.env.PORT))
    }
    catch(e) {
        console.log(e)
    }
}

start()