const express = require('express');
const { processAllStores } = require('./dbOperations');
const { startCronJob } = require('./cronHandler');

const app = express();
const port = 4000;

app.get('/test', (req, res) => {
    res.send('Hello World!');
});

app.get('/improvisedConsumption', async (req, res) => {
    try {
        await processAllStores();
        console.log('API CALLS COMPLETE');
        res.end();
    } catch (error) {
        console.log(error);
        res.status(500).send('An error occurred');
    }
});

app.listen(port, () => {
    console.log(`The  app listening at http://localhost:${port}`);
    startCronJob(); // Start the cron job when the server starts
});
