const knex = require('knex');
const axios = require('axios');
const Oauth1Helper = require('./signature');

const dbConfig = {
    client: 'mssql',
    connection: {
        server: '',
        port: 1433,
        user: '',
        password: '',
        database: 'BWC_Datamart',
    },
    acquireConnectionTimeout: 60000,
    pool: { min: 0, max: 10000 },
};

axios.defaults.timeout = 180000;

const db = knex(dbConfig);

const apiCalling = async (url, headerSet, erpItemsDetails) => {
    try {
        let response = await axios.request({
            method: 'post',
            maxBodyLength: Infinity,
            url: url,
            headers: headerSet,
            data: erpItemsDetails,
        });
        return response.data;
    } catch (error) {
        console.log(error);
        throw error;
    }
};

const processConsumptionData = async (storeCode) => {
    try {
        let consumption_data = await db('consumption_table_to_erp')
            .select('*')
            .where('store_code', storeCode)
            .whereIn('status', ['Not_Updated', 'Failure'])
            .limit(10);

        for (let dataObject of consumption_data) {
            let erpItemsDetails = JSON.stringify({
                sysId: dataObject.sysid,
                storeCode: dataObject.store_code,
                lineOfBusiness: dataObject.lineOfBusiness,
                dept: dataObject.dept,
                businessVertical: dataObject.businessVertical,
                itemDtls: [
                    {
                        itemCode: dataObject.itemCode,
                        quantity: dataObject.quantity,
                    },
                ],
                txnDate: dataObject.date,
            });

            let config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: 'https://5749239-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=299&deploy=1',
            };

            const oauth = Oauth1Helper.getAuthHeaderForRequest(config);

            let headerSet = {
                Authorization: oauth.Authorization,
                'Content-Type': 'application/json',
            };

            let response = await apiCalling(config.url, headerSet, erpItemsDetails);

            if (response.success === 'N') {
                await db('consumption_table_to_erp').where('sysid', dataObject.sysid).update({
                    status: 'Failure',
                    Error_log: JSON.stringify(response),
                });
            } else {
                await db('consumption_table_to_erp').where('sysid', dataObject.sysid).update({
                    status: 'Success',
                    Error_log: JSON.stringify(response),
                });
            }
        }
    } catch (error) {
        console.log(error);
        throw error;
    }
};

const processAllStores = async () => {
    let storeCodes = [/* store codes list */];
    for (let storeCode of storeCodes) {
        await processConsumptionData(storeCode);
    }
};

module.exports = {
    processAllStores,
    db, // Export the db connection if needed elsewhere
};
