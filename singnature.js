const crypto = require('crypto');
const oauth1a = require('oauth-1.0a');

const CONSUMERKEY = '9d3a34b4b85c75f7635714220a34ebdc10ddbbeb35b4453efc924039020e6b52';
const CONSUMERSECRET = 'a8c2cffffe1829706406e29db276e8cb78f5d87ec721e2387fb28493311a5234';
const TOKENKEY = '26074dbfe595788a6b4e4867282eb4aa9d7e895092f654886c5df405c2d3d6c2';
const TOKENSECRET = 'b8067a8ccb6131cc843857989b304634ac77109d0a40ac052e48704eac6482d9';
const REALM = '5749239_SB1';
class Oauth1Helper {
    static getAuthHeaderForRequest(request) {
        const oauth = oauth1a({
            consumer: { key: CONSUMERKEY, secret: CONSUMERSECRET },
            signature_method: 'HMAC-SHA256',
            realm: REALM,
            hash_function(base_string, key) {
                return crypto
                    .createHmac('sha256', key)
                    .update(base_string)
                    .digest('base64')
            },
        })

        const authorization = oauth.authorize(request, {
            key: TOKENKEY,
            secret: TOKENSECRET,
        });
        return oauth.toHeader(authorization);
    }
}

module.exports = Oauth1Helper;