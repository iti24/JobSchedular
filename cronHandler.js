const cron = require('node-cron');
const axios = require('axios');

const startCronJob = () => {
    cron.schedule('0 15 * * *', () => {
        console.log('Running a task every day at 3 PM');
        axios.get('http://localhost:4000/improvisedConsumption')
            .then(response => {
                console.log('Cron job executed successfully');
            })
            .catch(error => {
                console.error('Error executing cron job:', error);
            });
    });
};

module.exports = { startCronJob };
