const fetch = require('node-fetch')
//atomicAPI
const {ExplorerApi, RpcApi} = require("atomicassets");
const exp = new ExplorerApi("https://wax.api.atomicassets.io", "atomicassets", {fetch});
const rpc = new RpcApi("https://wax.pink.gg", "atomicassets", {fetch});
require('dotenv').config()
var jwt = require('jsonwebtoken');

const { Api, JsonRpc } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');     
const { TextEncoder, TextDecoder } = require('util');             


const memoToConfirm = 'ConfirmAccount'


//MySQL
const bcrypt = require('bcrypt');
var mysql      = require('mysql');
const { response } = require("express");
const cons = require("consolidate");
var connection = mysql.createConnection({
    host     : process.env.DB_HOST,
    user     : process.env.DB_USER,
    password : process.env.DB_PASSWORD,
    database : process.env.DB_DATABASE
  });

connection.connect()

//eos
const rpcEndpoint = new JsonRpc("http://wax.pink.gg", {
  fetch,
});
const signatureProvider = new JsSignatureProvider([process.env.PRIVATE_KEY]);
const apiRpc = new Api({
    rpc: rpcEndpoint,
    signatureProvider,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder(),
  });
const TAPOS = {
    blocksBehind: 3,
    expireSeconds: 30,
  };



class controller{
    async test (req, res) {
        connection.query(`delete from users where walletname = 'wa.wa'`)
        return res.send('fdfd')
    }

    async shop(req, res){
        const templates = [527221, 512599]
        
        const getTemplateInfo = async(template) => {
            const response = await fetch(`https://wax.api.atomicassets.io/atomicassets/v1/templates/${process.env.COLLECTION_NAME}/${template}`)
            const json = await response.json()
            return {
                schema: json.data.schema.schema_name,
                data: json.data.immutable_data
            }
        }

        return res.json([{
                id: 0,
                template: templates[0],
                cost: 1000,
                data: await getTemplateInfo(templates[0])
            },
            {
                id: 1,
                template: templates[1],
                cost: 1000000,
                data: await getTemplateInfo(templates[1])
            }
        ])
    }

    async buyItem(req, res){
        //console.log(req.body)
        jwt.verify(req.body.token, process.env.SECRET_KEY, (err, decoded) => {
            if (err)
                return res.status(400).send(err)
            
            connection.query(`select gold from users where walletName = '${decoded.walletName}'`, function (error, results, fields){
                if (results[0].gold < req.body.cost)
                    return res.status(400).send(`You don't have enough money`)
                else connection.query(`update users set gold = gold - ${req.body.cost} where walletName = '${decoded.walletName}'`, async function (error, results, fields){
                    if (error)
                        return res.status(400).send(error)
                        try{                            
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
                                        schema_name: req.body.schema,
                                        template_id: req.body.template,
                                        new_asset_owner: decoded.walletName,
                                        immutable_data: [],
                                        mutable_data: [],
                                        tokens_to_back: []
                                    },
                                }]
                            }, 
                            TAPOS);
                            //console.log(result)
                        } catch(e){
                            //обход проблемы с цпу
                            connection.query(` insert into logs (user, action, time, additionalInf) values ((select id from users where walletName = '${decoded.walletName}'), 'buy nft', Now(), 'Error ${e.details[0].message}');`)
                            return res.status(400).send(e.details[0].message)
                        }
                        connection.query(` insert into logs (user, action, time, additionalInf) values ((select id from users where walletName = '${decoded.walletName}'), 'buy nft', Now(), 'OK');`)
                        return res.send('Success')
                })
            })
        })
    }

    async getAccountAssets(req, res){
        try{
            const assets =  await rpc.getAccountAssets(req.body.walletName)
            //return res.json(assets.map(a => a.id))
            const isInCollection = async a => (await a.collection()).name == process.env.COLLECTION_NAME
            const boolArray = await Promise.all(assets.map(isInCollection))
            const tags = assets.filter((value, index) => boolArray[index])
            const result = await Promise.all(tags.map( async a =>{ 
                const container = {}
                container.name = (await a.data()).name
                container.id = a.id
                const tmp = await a.template()
                container.template = tmp? tmp.id : 0
                container.schema = (await a.schema()).name 
                return container
            }))
            return res.json( 
                result
        )}
        catch (e){
            console.log(e)
            return res.status(400)
        }
    }

    async getBlockTime  (req, res) {
        jwt.verify(req.body.token, process.env.SECRET_KEY, (err, decoded) => {
            if (err)
                return res.status(400).send(err)
            connection.query(`select isConfirmed, timediff(blockFor, NOW()) as diff from users where walletname = '${decoded.walletName}'`, async function (error, results, fields) {
            if (error)
                return res.status(400).send(error)
            return res.json(results[0])
        })})
    }

    async getEquip(req, res){
        const addInf = async (slot, assetId) => {
            if (!assetId)
                return {
                    slot: slot,
                    id: 0,
                    template:0,
                    schema: 0
                }
            console.log(slot, assetId)
            const response = await fetch(`https://wax.api.atomicassets.io/atomicassets/v1/assets/${assetId}`)
            const json = await response.json()
            console.log(json.data.schema.schema_name)
            return {
                slot: slot,
                id: assetId,
                name: json.data.data.name ,
                template: json.data.template? json.data.template.template_id : 0,
                schema: json.data.schema.schema_name
            }
        }

        jwt.verify(req.body.token, process.env.SECRET_KEY, (err, decoded) => {
            if (err)
                return res.status(400).send(err)
                connection.query(`select head, armor, pants, boots, hands, skill1, skill2 from users where walletname = '${decoded.walletName}'`, async function (error, results, fields) {
                if (error)
                    return res.status(400).send(error)

                return res.json(
                    [await addInf('Head', results[0].head),
                    await addInf('Armor', results[0].armor),
                    await addInf('Pants', results[0].pants),
                    await addInf('Boots', results[0].boots),
                    await addInf('Hands', results[0].hands),
                    await addInf('Skill 1',results[0].skill1),
                    await addInf('Skill 2' ,results[0].skill2) ]
                )
            })
        })
    }

    async getAssetInfo(req, res){
        try {
            // result = await exp.getAsset(req.itemId)
            // return res.json(result)
            const response = await fetch(`https://wax.api.atomicassets.io/atomicassets/v1/assets/${req.body.itemId}`)
            const json = await response.json()
            return res.json(json.data.data)
        }
        catch(e){
            console.log(e)
            return res.status(400).send(e)
        }
    }

    async equipNFT(req, res) {
        const isSkill = req.body.slot == 'skill1' || req.body.slot == 'skill2'
        console.log(isSkill)
        console.log(req.body)

        jwt.verify(req.body.token, process.env.SECRET_KEY, (err, decoded) => {
            if (err)
                return res.status(400).send(err)
            else {
                connection.query(`select level from users where walletname = '${decoded.walletName}'`, function (error, results, fields) {
                    if (error) throw error;
                    if (results[0].level < req.body.lvlReqs)
                        return res.status(202).send('Your level is low')
                })
                
                const slot = isSkill? 'skill1, skill2' : req.body.slot

                connection.query(`select ${slot} from users where walletname = '${decoded.walletName}'`, function (error, results, fields) {
                    if (error) throw error;
                    console.log(JSON.stringify(results[0])) //мвмвмвмвм
                    if(isSkill && (results[0].skill1 == req.body.nftId || results[0].skill2 == req.body.nftId  ))
                        return res.status(201).send('This NFT already equipped')
                    if (JSON.stringify(results[0]).split(':"')[1] == req.body.nftId + '"}')
                        return res.status(201).send('This NFT already equipped')
                    else connection.query(` update users set ${req.body.slot} = '${req.body.nftId}' where walletname = '${decoded.walletName}';`, function (error, results, fields) {
                        if (error) throw error;
                        return res.status(200).send('Equipped!')
                    })
                })  
            }
        })
    }

    async unequipNFT(req, res) {
        const isSkill = req.body.slot == 'skill'
        jwt.verify(req.body.token, process.env.SECRET_KEY, (err, decoded) => {
            if (err)
                return res.status(400).send(err)
            if (!isSkill)
                connection.query(`update users set ${req.body.slot} = null where walletName = '${decoded.walletName}' `, function (error, results, fields) {
                    if (error)
                        throw error
                    return results.affectedRows == 1? res.status(200).send('Success!') : res.status(400).send('Error')
                })
            else {
                connection.query(`select skill1, skill2 from users where walletName = '${decoded.walletName}'`, function (error, results, fields) {
                    if (error)
                        throw error
                    console.log(results[0].skill1)
                    console.log (req.body.nftId)
                    connection.query(`update users set ${results[0].skill1 == req.body.nftId? 'skill1' : 'skill2'} = null where walletName = '${decoded.walletName}' `, function (error, results, fields) {
                        if (error)
                            throw error
                        return results.affectedRows == 1? res.status(200).send('Success!') : res.status(400).send('Error')
                    })
                })
            }
        })
    }


    //тут добавляем проверку НФТ на аккаунте, если нет то какое-то наказание (невозможность играть какое-то время, к примеру)
    async startGame(req, res) {
        var vitality = 0
        var strength = 0
        var intelligence = 0
        var agility = 0
        var ok = true

        const addStats = async (nftId, walletName, slot) => {
            if (!nftId)
                return
            const response = await fetch(`https://wax.api.atomicassets.io/atomicassets/v1/assets/${nftId}`)
            const json = await response.json()
            if (json.data.owner != walletName){
                connection.query(`update users set blockFor =  DATE_ADD(NOW(), INTERVAL 2 HOUR), ${slot} = null where walletName = '${walletName}'`)
                ok = false
                return res.status(400).send(`You don't have asset #${nftId}`)
            }
            if (json.data.data.strength)
                strength += parseInt(json.data.data.strength)
            if(json.data.data.vitality)
                vitality += parseInt(json.data.data.vitality)
            if( json.data.data.intelligence)
                intelligence += parseInt( json.data.data.intelligence )
            if (json.data.data.agility)
                agility += parseInt (json.data.data.agility)
        }

        const getSkillStats = async (nftId, walletName, slot) => {
            if (!nftId)
                return null
            const response = await fetch(`https://wax.api.atomicassets.io/atomicassets/v1/assets/${nftId}`)
            const json = await response.json()
            //проверка на наличие на кошельке
            if (json.data.owner != walletName){
                //добавление блока в бд
                connection.query(`update users set blockFor =  DATE_ADD(NOW(), INTERVAL 2 HOUR), ${slot} = null where walletName = '${walletName}'`)
                ok = false
                return res.status(400).send(`You don't have asset #${nftId}`)
            }
            return {
                name: json.data.data.name,
                damage: json.data.data.damage,
                cost: json.data.data.cost
            }
        }

        jwt.verify(req.body.token, process.env.SECRET_KEY, (err, decoded) => {
            console.log('start game ' + req.body.token)
            if (err)
                return res.status(400).send(err)
            else {
                connection.query(` insert into logs (user, action, time) values ((select id from users where walletName = '`+ decoded.walletName + `'), 'game start', Now());`)
                connection.query( `select id, level, strength, vitality, intelligence, agility, head, armor, pants, boots,hands, skill1, skill2 from users where walletName = '${decoded.walletName}'`, async (error, results, fields) => {
                    if (err)
                        return res.status(400).send(err)
                    
                    connection.query(`select * from gamestats where user = ${results[0].id}`, async function (e, ress, f){
            

                        if (ress[0] != null) {
                            const skill1 = await getSkillStats(results[0].skill1, decoded.walletName, 'skill1')
                            const skill2 = await getSkillStats(results[0].skill2, decoded.walletName, 'skill2')
    
                            ress[0].skill1 = skill1
                            ress[0].skill2 = skill2

                            return res.json({
                                isAlreadyInGame: true,
                                stats: ress[0]
                            })
                        }
                        else {

                            vitality = results[0].vitality
                            strength = results[0].strength
                            intelligence = results[0].intelligence
                            agility = results[0].agility
                            
                            await addStats(results[0].head, decoded.walletName, 'head')
                            await addStats(results[0].armor, decoded.walletName, 'armor')
                            await addStats(results[0].pants, decoded.walletName, 'pants')
                            await addStats(results[0].boots, decoded.walletName, 'boots')
                            await addStats(results[0].hands, decoded.walletName, 'hands')

                            const skill1 = await getSkillStats(results[0].skill1, decoded.walletName, 'skill1')
                            const skill2 = await getSkillStats(results[0].skill2, decoded.walletName, 'skill2')

                            const level = results[0].level
                            const oppLvl = Math.floor(Math.random() * level + 1)

                            //тут цифры надо сравнить
                            connection.query(`insert into gamestats (user, strength, vitality, agility, intelligence, oppLvl, playerCurrentHP, 
                                playerCurrentMana, oppCurrentHP, skill1, skill2, gameStarted) values (${results[0].id}, ${strength}, ${vitality}, ${agility},
                                    ${intelligence}, ${oppLvl}, -1, -1, -1, '${results[0].skill1}', '${results[0].skill2}', NOW())`)

                            //return res.status(400)
                            if (ok) 
                                return res.json({
                                    isAlreadyInGame: false,
                                    stats : {
                                        isAlreadyInGame: false,
                                        strength,
                                        vitality,
                                        intelligence,
                                        agility,
                                        skill1,
                                        skill2,
                                        oppLvl,
                                    }
                                })
                    }})
                } )
            }
        })
    }

    async setGameData (req,res) {
        console.log(req.body)
        jwt.verify(req.body.token, process.env.SECRET_KEY, (err, decoded) => {
            connection.query(`update gamestats set playerCurrentHP = ${req.body.playerCurrentHP}, oppCurrentHP = ${req.body.oppCurrentHP}, playerCurrentMana = ${req.body.playerCurrentMana}
            where user = (select id from users where walletName = '${decoded.walletName}')`, (error, results, fields) => {
                if (error)
                    return res.status(400).send(error)
                else {
                    return res.status(200)
                }
            })
        })
    }

    async gameResult(req, res) {
        console.log(req.body)
        jwt.verify(req.body.token, process.env.SECRET_KEY, (err, decoded) => {
            if (err)
                return res.status(400).send(err)
            else {
                connection.query(`delete from gamestats where user = (select id from users where walletName = '${decoded.walletName}')`)
                if (req.body.result == 'win'){
                    connection.query(`select id, level, luck, exp from users where walletName = '${decoded.walletName}'`, async function (err, results, fields){
                        if (err)
                            console.log(err)
                        
                        const koef = 1 / (results[0].level - req.body.oppLvl + 1) * 4 + results[0].luck
                        const exp = Math.floor( Math.random() * koef * 100 )
                        const gold = Math.floor( Math.random() * koef * 100 )
                        const newLevel = results[0].exp + exp >= Math.pow(10, results[0].level)*10
                        if (newLevel) {
                            connection.query(`update users set winCount = winCount + 1, level = level + 1, exp = exp + ${exp}, gold = gold+${gold}, availableStats = availableStats + 10 where walletName = '${decoded.walletName}'`)
                        } else {
                            connection.query(`update users set winCount = winCount + 1, exp = exp + ${exp}, gold = gold + ${gold} where walletName = '${decoded.walletName}'`)
                        }
                        const nft = Math.random() < results[0].luck / 200
                        if (nft){
                            try{                            
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
                                            template_id: 527221,
                                            new_asset_owner: decoded.walletName,
                                            immutable_data: [],
                                            mutable_data: [],
                                            tokens_to_back: []
                                        },
                                    }]
                                }, 
                                TAPOS);
                                //console.log(result)
                            } catch(e){
                                //обход проблемы с цпу
                                connection.query(` insert into logs (user, action, time, additionalInf) values (${results[0].id}, 'game result', Now(), '${req.body.result}, nft: Error ${e.details[0].message}, new level: ${newLevel}');`)
                                return res.status(400).json({
                                    exp: exp,
                                    gold: gold,
                                    nft: nft,
                                    newLevel: newLevel,
                                    err: e
                                })
                            }
                        }
                        //log
                        connection.query(` insert into logs (user, action, time, additionalInf) values (${results[0].id}, 'game result', Now(), '${req.body.result}, nft: ${nft}, new level: ${newLevel}');`)
                        return res.json({
                            exp,
                            gold,
                            nft,
                            newLevel
                        })
                    })
                } else if (req.body.result == 'lose'){
                    connection.query(`select level from users where walletName = '${decoded.walletName}'`, (err, results, fields) => {
                        const blockTime = (results[0].level - req.body.oppLvl) * 3 + 1
                        connection.query(`insert into logs (user, action, time, additionalInf) values ( (select id from users where walletName = '${decoded.walletName}'), 'game result', Now(), '${req.body.result}, blockTime = ${blockTime} mins');`)
                            connection.query(`update users set loseCount = loseCount + 1, blockFor = DATE_ADD(NOW(), INTERVAL ${blockTime} MINUTE) where walletName = '${decoded.walletName}'`)
                            return res.json({
                                blockFor: blockTime
                            })})
                } else if (req.body.result == 'conceded'){

                    connection.query(`insert into logs (user, action, time, additionalInf) values ( (select id from users where walletName = '${decoded.walletName}'), 'game result', Now(), '${req.body.result}, blockTime = 5 mins');`)
                    connection.query(`update users set loseCount = loseCount + 1, blockFor = DATE_ADD(NOW(), INTERVAL 5 MINUTE) where walletName = '${decoded.walletName}'`)
                    return res.json({
                        blockFor: 5
                    })
                }
            }
        })
    }

    //для хэдера
    async getUserData(req, res) {
        jwt.verify(req.body.token, process.env.SECRET_KEY, (err, decoded) => {
            if (err)
                return res.status(400).send(err)
            connection.query(`SELECT walletName, level, exp, gold from users where walletName =  '${decoded.walletName}'`, function (error, results, fields) {
                if (error) throw error;
                return res.json(results);
            });
        })
    }

    async increaseStats (req, res) {
        jwt.verify(req.body.token, process.env.SECRET_KEY, (err, decoded) => {
            if (err)
                return res.status(400).send(err)
            connection.query(`update users set strength = ${req.body.strength}, vitality = ${req.body.vitality}, agility = ${req.body.agility}, intelligence = ${req.body.intelligence}, luck = ${req.body.luck}, availableStats = ${req.body.availableStats}  where walletName =  '${decoded.walletName}'`, function (error, results, fields) {
                if (error) 
                    return res.status(400).send(err)
                return res.send('Success!');
            });
        })
    }

    async getUserFullData(req, res) {
        console.log('data ', req.body.token)
        jwt.verify(req.body.token, process.env.SECRET_KEY, (err, decoded) => {
            if (err)
                return res.status(400).send(err)
            connection.query(`SELECT username, walletName, level, exp, gold, strength, vitality, agility, intelligence, luck, winCount, loseCount, regDay, isConfirmed, availableStats from users where walletName =  '${decoded.walletName}'`, function (error, results, fields) {
                if (error) throw error;
                return res.json(results[0]);
            });
        })
    }

    async verifyToken(req, res){
        console.log('verif', req.body.walletName ,req.body.token)
        jwt.verify(req.body.token, process.env.SECRET_KEY, (err, decoded) => {
            if (err)
                return res.status(400).send(err)
            else if (req.body.walletName === decoded.walletName) {
                return res.status(200).send()
            } else{
                return res.status(400).send('error')
            }
        })
    }

    async login(req, res) {
        const {walletName, password} = req.body
        connection.query(`SELECT password from users where walletName = '` + walletName + `'`, function (error, results, fields) {
            if (error) {
                console.log(error)
                return res.status(400).send("Server error")
            }
            if(results.length == 0)
                return res.status(400).send('User not found')
            else if (bcrypt.compareSync(password, results[0].password)){
                var token = jwt.sign({walletName: walletName}, process.env.SECRET_KEY);
                return res.status(200).json({ token: token, walletName: walletName })
            }
            else return res.status(400).send('Wrong password')
        });
    }

    async signUp(req,res) {
        connection.query(`select count(*) as count from users where walletName = '${req.body.walletName}'`, (error, results, fields) => {
            if (error)
                return res.status(400).send(error)
            if (results[0].count > 0)
                return res.status(400).send('User with this wallet already exists')
        })

                    
        try {
            const response = await fetch(`https://wax.api.atomicassets.io/atomicassets/v1/accounts/${req.body.walletName}`)
            const json = await response.json()
            if (json.data.assets == 0)
                return res.status(400).send('Wallet does not exist or you need to have at list 1 asset on your wallet')
        } catch(e){
            return res.status(400).send(e)
        }


        connection.query(`insert into users (username, password, walletName, regday) values 
        ('${req.body.username}', '${bcrypt.hashSync(req.body.password, 7)}', '${req.body.walletName}', curdate())`, function (error, results, fields) {
            if (error) 
                return res.status(400).send(error);
            return res.status(200).send('Success')
            })
    }

    async confirmAccount(req, res) {
        let confirmed = false;
        jwt.verify(req.body.token, process.env.SECRET_KEY, async (err, decoded) => {
            if (err)
                return res.status(400).send(err)
            const response = await fetch(`https://wax.api.atomicassets.io/atomicassets/v1/transfers?template_id=${process.env.PASS_TEMPLATE_ID}&account=${decoded.walletName}&memo=${memoToConfirm}`)
            const json = await response.json()
            json.data.forEach(e => {
                if (e.recipient_name == process.env.CONFIRM_RECIPIENT){
                    confirmed = true
                    connection.query(`update users set isConfirmed = 1 where walletName = '${decoded.walletName}'`)
                    return res.status(200).send('Confirmed!')
                }
            });
            if (!confirmed)
                return res.status(400).send('Transfer not found')
        })
    }

    //TODO: withdrawal 
}

module.exports = new controller()