const util = require('./util');
const crypto = require('crypto');
const request = require('request');
const cst = require('../constants');

module.exports={
    signinNative: function(data){
        return new Promise(async function(resolve, reject){
            let {email, password} = data;
            let access_expired = Date.now() + (cst.admin.TOKEN_EXPIRED_IN_SEC * 1000);
            let user = await util.getUserData({
                provider: 'native',
                email: email,
                password: crypto.createHmac('sha256', password+cst.auth.admin.PW_SECRET).digest('hex')
            });
            if(user.length!=1){
                return reject({status: 403, error: "Invalid email or password."});
            }
            let access_token = crypto.createHash('sha256').update(Date.now().toString()).digest('hex');
            util.updateUserData({
                access_token: access_token,
                access_expired: access_expired
            }, {email: email}).then(function(){
                user[0].access_token = access_token
                resolve({status: 200, user: user[0]});
            }).catch(function(){
                reject({status: 500, error: "Update user data error."});
            });
        })
    },
    signinFB: function(data){
        return new Promise(function(resolve, reject){
            let {access_token} = data;
            let fbUrl = `https://graph.facebook.com/me?fields=id,name,email,picture.width(300).height(300)&access_token=${access_token}`;
            request(fbUrl, async function(err, response, body){
                if(err){
                    return reject({error: "Unable to get profile from Facebook."});
                }
                let resData = JSON.parse(body);
                let user = await util.getUserData({
                    provider: 'facebook',
                    name: resData.name,
                    email: resData.email
                });
                if(user.length!=1){
                    let newData = {
                        user_id: lib.userIdGen(),
                        provider: 'facebook',
                        name: resData.name,
                        email: resData.email,
                        icon: `icon/${lib.randomNoGen(96)}`,
                        profile_pic: resData.picture.data.url,
                        access_token: access_token,
                    }
                    util.insert('user', newData).then(function(){
                        resolve({status: 200, user: newData});
                    }).catch(function(){
                        reject({status: 500, error: "Insert data error."});
                    });
                }else{
                    util.updateUserData({
                        access_token: access_token,
                        profile_pic: data.profile_pic,
                    }, {email: data.email}).then(function(){
                        resolve({status: 200, user: user[0]});
                    }).catch(function(){
                        reject({status: 500, error: "Update data error."});
                    });
                }
            });
        });
    },
    addActivity: function(data, actlData){
        return util.transaction(function(conn){
            return new Promise(async function(resolve, reject){
                util.insert('data', data, conn).then(function(){
                    util.insert('activity', actlData, conn).then(function(){
                        resolve({status: 200, data: data});
                    }).catch(function(){
                        reject({status: 500, error: "Add activity error."});
                    });
                }).catch(function(){
                    reject({status: 500, error: "Add activity error."});
                });
            });
        });
    }
}