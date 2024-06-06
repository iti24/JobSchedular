const express = require('express');
const cron = require('node-cron');
const knex = require('knex');
const axios = require('axios');
const Oauth1Helper = require("./signature");

const app = express();
const port = 4000;

const dbConfig = {
    client: 'mssql',
    connection: {
        server: "",
        port: 1433,
        user: "",
        password: "",
        database: "BWC_Datamart",
    },
    acquireConnectionTimeout: 60000,
    pool: { min: 0, max: 10000 },
};

axios.defaults.timeout = 180000;

app.get('/test', (req, res) => {
    res.send('Hello World!');
});

app.get("/", async (req, res) => {
    console.log("Procedure execution starts");
    let dataToInsert = [];
    const knex = require("knex")(dbConfig);
    try {
        const inventory_table = await knex.select("*")
            .from("consumption_table_to_erp")
            .andWhere('store_code', 'C/001')
            .andWhere('date', '01-03-2024')
            .whereIn("status", ["Not_Updated", "Failure"]);
        console.log(inventory_table.length);

        for (const dataObject of inventory_table) {
            let erpItemsDetails = JSON.stringify({
                "sysId": dataObject.sysid,
                "storeCode": dataObject.store_code,
                "lineOfBusiness": dataObject.lineOfBusiness,
                "dept": dataObject.dept,
                "businessVertical": dataObject.businessVertical,
                "itemDtls": [{
                    "itemCode": dataObject.itemCode,
                    "quantity": dataObject.quantity
                }],
                "txnDate": dataObject.date,
            });

            let config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: 'https://5749239-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=299&deploy=1',
            };

            const oauth = Oauth1Helper.getAuthHeaderForRequest(config);

            let headerSet = {
                'Authorization': oauth.Authorization,
                'Content-Type': 'application/json'
            };

            axios.request({
                method: 'post',
                maxBodyLength: Infinity,
                url: 'https://5749239-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=299&deploy=1',
                headers: headerSet,
                data: erpItemsDetails
            })
                .then(async (response) => {
                    console.log(JSON.stringify(response.data));
                    const resp = JSON.parse(JSON.stringify(response.data));
                    if (resp.success == "N") {
                        await knex('consumption_table_to_erp').where('sysid', dataObject.sysid).update({
                            status: 'Failure',
                            Error_log: JSON.stringify(response.data)
                        });
                    } else {
                        await knex('consumption_table_to_erp').where('sysid', dataObject.sysid).update({
                            status: 'Success',
                            Error_log: JSON.stringify(response.data)
                        });
                    }
                })
                .catch((error) => {
                    console.log(error);
                });
        }
        console.log("API CALLLS COMPLETE");

        await knex.destroy();
        res.end();
    } catch (error) {
        console.log(error);
        for (const data of dataToInsert) {
            await knex('consumption_table_to_erp').where('sysid', data.sysid).update({
                status: data.status,
                Error_log: data.Error_log
            });
        }
        await knex.destroy();
        res.end();
    }
});

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

app.get("/improvisedConsumption", async (req, res) => {
    const db = knex(dbConfig);
    console.log("Procedure execution starts");
    let storeCodes = ['C/008', 'C/009', 'C/010', 'C/016', 'C/022', 'C/024', 'C/033', 'C/038', 'C/047', 'C/053', 'C/058', 'C/059', 'C/066', 'C/069', 'C/070', 'C/076', 'C/077', 'C/083', 'C/084', 'C/085', 'C/088', 'C/092', 'C/094', 'C/103', 'C/104', 'C/113', 'C/125', 'C/127', 'C/139', 'C/145', 'C/147', 'C/150', 'C/151', 'C/152', 'C/158', 'C/165', 'C/166', 'C/167', 'C/177', 'C/184', 'C/185', 'C/186', 'C/194', 'C/195', 'C/196', 'C/207', 'C/218', 'C/219', 'C/220', 'F/002', 'F/018', 'F/023', 'F/024', 'F/034', 'F/039', 'F/057', 'F/072', 'F/080', 'F/085', 'F/090', 'F/095', 'F/103', 'F/110', 'F/111', 'F/128', 'F/133', 'F/137', 'F/140', 'F/141', 'F/142', 'F/150', 'F/161', 'F/166', 'F/169', 'F/170', 'F/171', 'F/176', 'F/185', 'F/188', 'F/194', 'F/198', 'F/201', 'F/204', 'F/211', 'F/215', 'F/226', 'F/233', 'F/234', 'F/243', 'F/249', 'F/255', 'F/256', 'F/263', 'F/269', 'F/272', 'F/277', 'F/278', 'F/279', 'F/283', 'F/289', 'F/291', 'F/294', 'F/302', 'F/308', 'F/311', 'F/312', 'F/318', 'F/321', 'F/322', 'F/335', 'F/336', 'F/342', 'F/348', 'F/352', 'F/358', 'F/360', 'F/361', 'F/362', 'F/378', 'C/007', 'C/017', 'C/021', 'C/023', 'C/025', 'C/028', 'C/029', 'C/037', 'C/040', 'C/046', 'C/057', 'C/067', 'C/081', 'C/082', 'C/089', 'C/091', 'C/093', 'C/095', 'C/098', 'C/099', 'C/105', 'C/107', 'C/110', 'C/112', 'C/114', 'C/115', 'C/126', 'C/128', 'C/129', 'C/130', 'C/131', 'C/132', 'C/133', 'C/146', 'C/148', 'C/149', 'C/156', 'C/159', 'C/168', 'C/176', 'C/178', 'C/179', 'C/187', 'C/197', 'C/206', 'C/217', 'C/221', 'C/222', 'F/006', 'F/008', 'F/009', 'F/016', 'F/022', 'F/040', 'F/041', 'F/047', 'F/058', 'F/062', 'F/069', 'F/073', 'F/076', 'F/078', 'F/091', 'F/102', 'F/104', 'F/105', 'F/108', 'F/132', 'F/134', 'F/138', 'F/189', 'F/195', 'F/199', 'F/205', 'F/218', 'F/220', 'F/227', 'F/228', 'F/229', 'F/232', 'F/235', 'F/242', 'F/244', 'F/246', 'F/250', 'F/251', 'F/252', 'F/258', 'F/260', 'F/265', 'F/270', 'F/271', 'F/276', 'F/284', 'F/285', 'F/286', 'F/292', 'F/293', 'F/295', 'F/297', 'F/298', 'F/305', 'F/307', 'F/310', 'F/319', 'F/320', 'F/324', 'F/325', 'F/326', 'F/327', 'F/329', 'F/332', 'F/333', 'F/334', 'F/338', 'F/339', 'F/340', 'F/349', 'F/351', 'F/354', 'F/363'];

    try {
        for (let storeCode of storeCodes) {
            let consumption_data = await db('consumption_table_to_erp')
                .select('*')
                .where('store_code', storeCode)
                .whereIn('status', ['Not_Updated', 'Failure'])
                .limit(10);

            if (consumption_data.length > 0) {
                for (let dataObject of consumption_data) {
                    let erpItemsDetails = JSON.stringify({
                        "sysId": dataObject.sysid,
                        "storeCode": dataObject.store_code,
                        "lineOfBusiness": dataObject.lineOfBusiness,
                        "dept": dataObject.dept,
                        "businessVertical": dataObject.businessVertical,
                        "itemDtls": [{
                            "itemCode": dataObject.itemCode,
                            "quantity": dataObject.quantity
                        }],
                        "txnDate": dataObject.date,
                    });

                    let config = {
                        method: 'post',
                        maxBodyLength: Infinity,
                        url: 'https://5749239-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=299&deploy=1',
                    };

                    const oauth = Oauth1Helper.getAuthHeaderForRequest(config);

                    let headerSet = {
                        'Authorization': oauth.Authorization,
                        'Content-Type': 'application/json'
                    };

                    try {
                        let response = await apiCalling('https://5749239-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=299&deploy=1', headerSet, erpItemsDetails);

                        if (response.success === "N") {
                            await db('consumption_table_to_erp').where('sysid', dataObject.sysid).update({
                                status: 'Failure',
                                Error_log: JSON.stringify(response)
                            });
                        } else {
                            await db('consumption_table_to_erp').where('sysid', dataObject.sysid).update({
                                status: 'Success',
                                Error_log: JSON.stringify(response)
                            });
                        }
                    } catch (error) {
                        console.log(error);
                    }
                }
            }
        }
        console.log("API CALLLS COMPLETE");

        await db.destroy();
        res.end();
    } catch (error) {
        console.log(error);
        await db.destroy();
        res.end();
    }
});

// Schedule a task to run every day at 3 PM
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

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});
