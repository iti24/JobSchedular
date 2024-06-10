const express = require('express')
const app = express()
const port = 4000;

app.get('/test', (req, res) => {
    res.send('Hello World!')
})
const knex = require('knex')
const axios = require('axios');
const Oauth1Helper = require("./signature");
const dbConfig = {
    client: 'mssql',
    connection: {
        server: "43.205.186.2",
        port: 1433,
        user: "sa",
        password: "Sa@8811$",
        database: "BWC_Datamart",
    },
    acquireConnectionTimeout: 60000,
    pool: { min: 0, max: 10000 },
};
// const knex = require("knex")(dbConfig);
axios.defaults.timeout = 180000;
const moment = require('moment');
const cron = require('node-cron');

app.get("/improvised", async (req, res) => {
    const db = knex(dbConfig);
    console.log("Procedure execution starts");

    const paymentRows = await db.select("*").from("sales_table_to_erp").whereIn("status", ["Not_Updated", "Failure"]);
    console.log(paymentRows.length);

    const batches = chunkArray(paymentRows, 20); // Batch size can be adjusted
    for (const batch of batches) {
        await processBatch(batch, db);
    }

    await db.destroy();
    res.end();
});

async function processBatch(batch, db) {
    let apiPromises = [];
    let responsesMap = new Map();

    for (const dataObject of batch) {
        const systemdata = prepareSystemData(dataObject);
        const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://5749239-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=298&deploy=1',
        };

        const oauth = Oauth1Helper.getAuthHeaderForRequest(config);
        const headerSet = {
            'Authorization': oauth.Authorization,
            'Content-Type': 'application/json'
        };

        const apiUrl = 'https://5749239-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=298&deploy=1';

        apiPromises.push(apiCalling(apiUrl, headerSet, systemdata).then(response => {
            responsesMap.set(dataObject.sysid, response); // Store sysid-response pair in the map
        }).catch(error => {
            // Handle errors here if needed
            console.error("Error for sysid:", dataObject.sysid, error);
        }));
    }
    await Promise.all(apiPromises);
    // Now you can access the response for a particular sysid from the map
    for (const [sysid, response] of responsesMap.entries()) {
        console.log(`Response for sysid ${sysid}:`, response);
        if (response) {
            if (response.success == "Y") {
                await db('sales_table_to_erp').where('sysid', sysid).update({
                    status: 'Success',
                    Error_log: JSON.stringify(response)
                });
            } else if (response.success == "N") {
                await db('sales_table_to_erp').where('sysid', sysid).update({
                    status: 'Failure',
                    Error_log: JSON.stringify(response)
                });
            }
        }
    }
}

function prepareSystemData(dataObject) {
    return JSON.stringify({
        "sysId": dataObject.sysid,
        "cstmr": dataObject.cstmr,
        "storeCode": dataObject.storeCode,
        "dept": dataObject.dept,
        "lineOfBusiness": dataObject.lineOfBusiness,
        "businessVertical": dataObject.businessVertical,
        "paymentMethod": dataObject.payment_mode,
        "placeOfSupply": dataObject.placeOfSupply,
        "memo": dataObject.memo,
        "invDate": dataObject.date,
        "itemDtls": [
            {
                "itemCode": dataObject.itemCode,
                "itemDescription": dataObject.itemDescription,
                "quantity": dataObject.quantity,
                "hsnSac": dataObject.hsnSac,
                "unitPrice": dataObject.unitPrice,
                "taxableAmt": parseFloat(dataObject.taxableAmt).toFixed(2),
                "taxCode": dataObject.taxCode,
                "gstRate": parseFloat(dataObject.gstRate).toFixed(2),
                "cgstAmt": parseFloat(dataObject.cgstAmt).toFixed(2),
                "sgstAmt": parseFloat(dataObject.sgstAmt).toFixed(2),
                "igstAmt": parseFloat(dataObject.igstAmt).toFixed(2),
                "cessRate": parseFloat(dataObject.cessRate).toFixed(2),
                "cessAmt": 0,
                "stateCessRate": parseFloat(dataObject.stateCessRate).toFixed(2),
                "stateCessAmt": parseFloat(dataObject.stateCessAmt).toFixed(2),
                "tcsRate": parseFloat(dataObject.tcsRate).toFixed(2),
                "tcsAmt": parseFloat(dataObject.tcsAmt).toFixed(2),
                "isReverseCharge": "N"
            },
        ]
    });
}

function chunkArray(arr, size) {
    const chunkedArr = [];
    for (let i = 0; i < arr.length; i += size) {
        chunkedArr.push(arr.slice(i, i + size));
    }
    return chunkedArr;
}

/**
 * This endpoint will process the consumption data in a more optimized way
 */

app.post("/consumption", async (req, res) => {
    try {
        const db = knex(dbConfig);
        const thisDate = moment().format('DD-MM-YYYY');
        console.log(`CONSUMPTION PROCESS STARTED : ${thisDate}`);
        const responses = await db.distinct().from('consumption_table_to_erp').pluck('sysid');
        for (const singleStore of responses) {
            const inventory_table = await db.select("*").from("consumption_table_to_erp").andWhere('sysid', singleStore).whereIn("status", ["Not_Updated"]);
            if (!inventory_table.length) {
                continue;
            } else {
                console.log(`Sysid :${singleStore}  || Transactions :${inventory_table.length}`);
            }
            const response = await processBatchConsumption2(inventory_table, db);

            let insertData = {
                sysid: singleStore,
                store_code: '',
                error_log: JSON.stringify(response),
                status: response.success == "Y" ? 'Success' : "Failure",
                report_date: thisDate
            }
            await db('consumption_batch_response').insert(insertData);
        }
        await db.destroy();
        await updateConsumption(thisDate);
        console.log(`CONSUMPTION PROCESS COMPLETED : ${thisDate}`);
        res.end();
    } catch (error) {
        console.log(error)
        res.end();
    }
});

async function processBatchConsumption2(batch, db) {
    try {
        let queryObject = {
            "sysId": batch[0].sysid,
            "storeCode": batch[0].store_code,
            "lineOfBusiness": batch[0].lineOfBusiness,
            "dept": batch[0].dept,
            "businessVertical": batch[0].businessVertical,
            "itemDtls": [],
            "txnDate": batch[0].date,

        }
        for (const dataObject of batch) {
            queryObject.itemDtls.push({
                "itemCode": dataObject.itemCode,
                "quantity": dataObject.quantity,
                "consumptionType": "Consumption"
            })
        }
        const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://5749239-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=299&deploy=1',
        };

        const oauth = Oauth1Helper.getAuthHeaderForRequest(config);
        const headerSet = {
            'Authorization': oauth.Authorization,
            'Content-Type': 'application/json'
        };

        const apiUrl = 'https://5749239-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=299&deploy=1';
        const response = await apiCalling(apiUrl, headerSet, queryObject)
        console.log(response)
        return response;
    } catch (error) {
        console.log(error.data)
        return error;
    }
}

const apiCalling = async (url, headerSet, erpItemsDetails) => {
    return new Promise(async (resolve, reject) => {
        try {
            let response = await axios.request({
                method: 'post',
                maxBodyLength: Infinity,
                url: url,
                headers: headerSet,
                data: erpItemsDetails
            });
            resolve(response.data)
        } catch (error) {
            console.log(error)
            resolve(error)
        }
    })
}

const updateConsumption = async (reportDate) => {
    const db = knex(dbConfig);
    const responses = await db.select("*").from("consumption_batch_response").andWhere('report_date', reportDate);
    for (const singleItem of responses) {
        await db('consumption_table_to_erp').where('sysid', singleItem.sysid).update({
            status: singleItem.status,
            Error_log: singleItem.error_log
        });
    }
    await db.destroy();
    res.end();
}

// Schedule cron job to run at 3:45 PM every day
cron.schedule('45 15 * * *', async () => {
    try {
        const response = await axios.post('http://localhost:4000/consumption');
        console.log('Cron job executed successfully');
    } catch (error) {
        console.error('Error executing cron job:', error);
    }
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})