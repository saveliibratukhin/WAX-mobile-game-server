
const { Api, JsonRpc } = require("eosjs");
const { JsSignatureProvider } = require("eosjs/dist/eosjs-jssig");
const fetch = require("node-fetch");
const { TextEncoder, TextDecoder } = require('util');  


const signatureProvider = new JsSignatureProvider([process.env.PRIVATE_KEY]);

const rpc = new JsonRpc("http://wax.pink.gg", {
  fetch,
});

const apiRpc = new Api({
    rpc,
    signatureProvider,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder(),
  });

const TAPOS = {
    blocksBehind: 3,
    expireSeconds: 30,
  };


class eosApi {
    async mintAsset(req, res){
      try {
        const result= await apiRpc.transact(
        {
          actions: [
            {
              account: "atomicassets",
              name: "mintasset",
              authorization: [
                  {
                      actor: "nftgametest2",
                      permission: "active"
                  },
              ],
              data: {
                  authorized_minter: "nftgametest2",
                  collection_name: "sav4ixxtestt",
                  schema_name: "chest",
                  template_id: 514470,
                  new_asset_owner: "nftgametest2",
                  immutable_data: [],
                  mutable_data: [],
                  tokens_to_back: []
              },
          }]
        }, 
        TAPOS);
      }
      catch(e){
        return res.status(400).send(e)
      }
      return res.send(result)
    }
}

module.exports = new eosApi()