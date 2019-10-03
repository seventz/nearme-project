const mysql = require("./mysqlcon");
const dao = require("./dao")
const request = require('request');
const lib = require('./lib');
const cst = require('./constants');

let dataPackage = {
    id: null,
    actl_id: null,
    lat: 0,
    lng: 0,
    owner: '',
    title: '',
    category: '',
    actl_type: null,
    description: '',
    address: null,
    t_start: null,
    t_end: null,
    main_img: null,
    ref: null,
    official_id: null,
    created: null,
    free: null
}

async function getMeetupRefreshToken(refresh_token) {
    return new Promise(function(resolve, reject){
        let formData = {
            client_id: cst.auth.meetup.client_id,
            client_secret: cst.auth.meetup.client_secret,
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        }
        let options = {
            method: 'POST',
            url: "https://secure.meetup.com/oauth2/access",
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            form: formData
        }
        
        request(options, function(error, response, body){
            let result = JSON.parse(body)
            if(error || !result.access_token){
                reject("Refresh token error.")
            }
            else{
                cst.auth.meetup.access_token = result.access_token;
                cst.auth.meetup.refresh_token = result.refresh_token;
                resolve(result.access_token);
            }
        });
    });
}

function getMeetupTP(){
    return new Promise(function(resolve, reject){
        // Constants
        dataPackage.owner = 'Meetup';
        dataPackage.category = 'official';
        dataPackage.actl_type = null;
        dataPackage.main_img = null;

        let options = {
            url: 'https://api.meetup.com/find/upcoming_events',
            method: 'GET',
            headers: {
            'Authorization': `Bearer ${cst.auth.meetup.access_token}`
            },
            qs: cst.params.meetup
        };

        resolve(request(options, callback));
    });
    

    async function callback(error, response, body){
        if(error) throw error;
        let result = JSON.parse(body);
        if(!result.events){
            getMeetupRefreshToken(cst.auth.meetup.refresh_token).then(function(new_access_token){
                console.log(new_access_token)
                options.headers.Authorization = `Bearer ${new_access_token}`;
                request(options, callback);
            }).catch(function(err){
                // MAIL: update MeetupTP token failed.
                return console.log(err);
            });
        }else{
            let content = result.events;
            mysql.con.beginTransaction(async function(err){
                if(err) {return mysql.con.rollback(function(){throw err;});}
                let dupIds = await findDupIds(content);
                insertData(content, 0, dupIds).then(function(){
                    mysql.con.commit(function(err){
                        if(err){
                            return mysql.con.rollback(function(){throw err;});
                        }else{
                            return console.log("Update MeetupTP Successfully!");
                        }
                    });
                }).catch(function(err){
                    mysql.con.rollback(function(){throw err;});
                });
            });
        }
    }
    
    function findDupIds(content){
        return new Promise(async function(resolve, reject){
            // Find duplicate ids //
            let officialIds = content.map(c=>c.id);
            let existingIds = await mysql.queryp(`SELECT DISTINCT official_id FROM data WHERE owner = ?`, dataPackage.owner);
            existingIds = existingIds.map(e=>e.official_id);
            let dupIds = officialIds.filter(o=>existingIds.includes(o));
            resolve(dupIds);
        })
    }

    function insertData(content, count, dupIds){
        return new Promise(function(resolve, reject){
            if(count===content.length){
                console.log("Updated MeetTP")
                resolve();
            }else if(dupIds.includes(content[count].id)){
                // Update inexisting data only //
                insertData(content, count+1, dupIds);
                console.log(`dupId ${content[count].id} found and call next directly`)
            }else{
                console.log(`Add new data: ${count}`)
                if(content[count].venue){
                    dataPackage.lat = content[count].venue.lat;
                    dataPackage.lng = content[count].venue.lon;
                    dataPackage.address = content[count].venue.address_1;
                }else if(content[count].group){
                    dataPackage.lat = content[count].group.lat;
                    dataPackage.lng = content[count].group.lon;
                    dataPackage.address = null;
                }else{
                    dataPackage.lat = null;
                    dataPackage.lng = null;
                    dataPackage.address = null;
                }
                dataPackage.actl_id = lib.activityIdGen();
                dataPackage.title = content[count].name;
                dataPackage.description = lib.removeEmojis(content[count].description);
                dataPackage.t_start = new Date(content[count].time + content[count].utc_offset);
                dataPackage.t_end = new Date(content[count].time + content[count].utc_offset + content[count].duration);
                dataPackage.ref = content[count].link;
                dataPackage.official_id = content[count].id;
                dataPackage.created = new Date(content[count].created  + content[count].utc_offset);
                (content[count].member_pay_fee===false)? dataPackage.free=true : dataPackage.free=false;
    
                dao.insert('data', dataPackage).then(function(){
                    insertData(content, count+1, dupIds);
                }).catch(function(){
                    console.log("Error insertion.");
                    reject();
                })
            }
        })
        
    }
}

function getEventPalTP(){
    // Constants
    dataPackage.owner = 'EventPal';
    dataPackage.category = 'official';
    dataPackage.t_end = null;
    dataPackage.free = false;

    let city = "臺北市";
    let server = "https://www.eventpal.com.tw"
    let querystr = "/FOAS/actions/ActivityIndex.action?activitytab.activityseqno=";
    //https://www.eventpal.com.tw/FOAS/actions/ActivityIndex.action?activitytab.activityseqno=8a246f7e-6c2a-4527-839f-6dd313717bcb

    let qs = {queryHotActivity: '', timeLineYear: 2019, timeLineMonth: -1};
    let site = server + '/FOAS/actions/IndexNew.action?';
    let options = {
        url: site,
        method: 'GET',
        qs: qs
    };

    request(options, async function(error, response, body){
        if(error){return error;}
        let result = JSON.parse(body);
        let content = getEpEventsByLocation(result, city);

        mysql.con.beginTransaction(async function(err){
            if(err) {return err;}
            let dupIds = await findDupIds(content);
            insertData(content, 0, dupIds).then(function(){
                mysql.con.commit(function(err){
                    if(err){
                        return mysql.con.rollback(function(){throw err;});
                    }else{
                        return console.log("Update EventPal Successfully!");
                    }
                });
            }).catch(function(err){
                mysql.con.rollback(function(){throw err;});
            });
        });

        function findDupIds(content){
            return new Promise(async function(resolve, reject){
                // Find duplicate ids //
                let officialIds = content.map(c=>c.data.seqno);
                let existingIds = await mysql.queryp(`SELECT DISTINCT official_id FROM data WHERE owner = ?`, dataPackage.owner);
                existingIds = existingIds.map(e=>e.official_id);
                let dupIds = officialIds.filter(o=>existingIds.includes(o));
                resolve(dupIds);
            })
        }

        function insertData(content, count, dupIds){
            return new Promise(async function(resolve, reject){
                if(count===content.length){
                    console.log("Updated EventPal.")
                    resolve();
                }else if(dupIds.includes(content[count].data.seqno)){
                    // Update inexisting data only //
                    insertData(content, count+1, dupIds);
                    console.log(`DupId ${content[count].data.seqno} found and call next directly.`)
                }else{
                    console.log(`Add new data: ${count}`)
                    let address = processAddr(city, content[count].data.location) || null;
                    dataPackage.actl_id = lib.activityIdGen();
                    dataPackage.title = content[count].data.activityname || null;
                    dataPackage.actl_type = content[count].data.gametype || null;
                    dataPackage.t_start = content[count].activityDateWithT || null;
                    dataPackage.description = content[count].data.activitybrief || null;
                    dataPackage.main_img = server + content[count].data.kvimage || null;
                    dataPackage.ref = server + querystr + content[count].data.seqno || null;
                    dataPackage.official_id = content[count].data.seqno || null;
                    dataPackage.created = new Date(content[count].data.createtime) || null;

                    lib.geocodeBuffer(address).then(function(location){
                        if(!address) dataPackage.address = null;
                        if(!location.lat) dataPackage.lat = null;
                        if(!location.lng) dataPackage.lng = null;
                        dataPackage.lat = location.lat;
                        dataPackage.lng = location.lng;
                        dataPackage.address = address;
    
                        dao.insert('data', dataPackage).then(function(){
                            insertData(content, count+1, dupIds);
                        }).catch(function(){
                            console.log("Error insertion.");
                            reject();
                        });
                    }).catch(function(err){
                        console.log(err);
                        // Proceeding to the next
                        insertData(content, count+1, dupIds);
                    })
                }
            });
        }
        function getEpEventsByLocation(result, city){
            let arr = [];
            result.forEach(function(r){
                if(r.data.city.trim() === city)
                    arr.push(r);
            })
            return arr;
        }
    });
}

async function getAccupassTP(){
    // Constants
    dataPackage.owner = "Accupass";
    dataPackage.category = "official";

    let accupassChannels = ['learning', 'art', 'family', 'experience'];
    let server = "https://www.accupass.com";
    let apiBase = "https://api.accupass.com/v3";
    let region = "north"; // Taipei

    let channelObj = accupassChannels.map(function(ch){
        return {
            channel: ch,
            site: `${apiBase}/home/${region}/channel/${ch}`
        }
    })
    
    await getIdsByChannel(channelObj, 0);
    let dupIds = await findDupIds(channelObj);

    mysql.con.beginTransaction(async function(err){
        if(err) {return err;}
        insertData(channelObj, 0, dupIds).then(function(){
            mysql.con.commit(function(err){
                if(err){
                    return mysql.con.rollback(function(){throw err;});
                }else{
                    return console.log("Update Accupass Successfully!");
                }
            });
        }).catch(function(err){
            mysql.con.rollback(function(){throw err;});
        });
    });

    function insertData(channelObj, index, dupIds){
        return new Promise(function(resolve, reject){
            if(index===channelObj.length){
                return resolve();
            }else{
                insertDataByChannel(channelObj[index], 0, dupIds).then(function(){
                    resolve(insertData(channelObj, index+1, dupIds));
                }).catch(function(err){
                    console.log(err);
                    resolve(insertData(channelObj, index+1, dupIds));
                });
            }

            function insertDataByChannel(channel, count, dupIds){
                return new Promise(function(resolve, reject){
                    if(count===channel.id.length){
                        return resolve();
                    }else if(dupIds.includes(channel.id[count])){
                        console.log(`DupId found and proceeding to the next: ${channel.channel}, ${count}.`);
                        resolve(insertDataByChannel(channel, count+1, dupIds));
                    }else{
                        console.log(`Add new data: ${channel.channel}, ${count}.`)
                        let options = {
                            url: `${apiBase}/events/${channel.id[count]}`,
                            method: "GET"
                        };
                        request(options, async function(err, response, body){
                            let data = JSON.parse(body);
                            dataPackage.actl_id = lib.activityIdGen();
                            dataPackage.created = lib.getLocalISOTime();
                            dataPackage.actl_type = channel.channel;
                            dataPackage.lat = data.location.latitude;
                            dataPackage.lng = data.location.longitude;
                            dataPackage.title = lib.removeEmojis(data.title);
                            dataPackage.description = lib.removeEmojis(data.description);
                            dataPackage.address = data.address;
                            dataPackage.t_start = data.eventTimeObj.startDateTime;
                            dataPackage.t_end = data.eventTimeObj.endDateTime;
                            dataPackage.main_img = data.image200;
                            dataPackage.ref = `${server}/event/${data.eventIdNumber}`;
                            dataPackage.official_id = data.eventIdNumber;
                            dataPackage.free = data.isFree;
                            dao.insert('data', dataPackage).then(function(){
                                resolve(insertDataByChannel(channel, count+1, dupIds));
                            }).catch(function(err){
                                console.log("Error insertion: ", err);
                                // Proceeding th the next                     
                                resolve(insertDataByChannel(channel, count+1, dupIds));
                            });
                        })
                    }
                })
            }
        })
    }

    

    function findDupIds(channelObj){
        return new Promise(async function(resolve, reject){
            // Find duplicate ids //
            let dupIds = [];
            let existingIds = await mysql.queryp(`SELECT DISTINCT official_id FROM data WHERE owner = ?`, dataPackage.owner);
            existingIds = existingIds.map(e=>e.official_id);
            for(let i=0; i<channelObj.length; i++){
                let dup = channelObj[i].id.filter(id=>existingIds.includes(id));
                dup.forEach(d=>{dupIds.push(d);})
            }     
            resolve(dupIds);
        })
    }

    function getIdsByChannel(sites, index){
        return new Promise(function(resolve, reject){
            if(index===sites.length) return resolve();

            let options = {
                url: sites[index].site,
                method: 'GET'
            }
            request(options, function(err, response, body){
                if(err) reject(err)
                let result = JSON.parse(body);
                channelObj[index].id = result.channel.tagEvents.map(t=>t.eventIdNumber);
                resolve(getIdsByChannel(sites, index+1));
            });
        })
    }

}

/**
 * Function "processAddr" Logic:
 * 1. Include both "臺" and "台"
 * 2. If "()" found, split into ones outside "()" and inside "()"
 * 2.1 Further split " "
 * 3. Check any section containing "號"
 * 3.1 If neither or more than one, keep the original string and not processing
 * 4. Check the final one string. Get the substring from where cityname first appeared.
 * 4.1 If false, add cityname at the beginning and return
 * 4.2 If true, return the section starting at cityname
 */
function processAddr(city, addr){
    if(!addr) return null;
    let citySet = [city, getDupCityName(city)];
    let splittedAddr = splitAddr(addr);
    let finalOneAddr = examineAddrs(citySet, splittedAddr) || addr;
    return prependCity(citySet, finalOneAddr);
    
    function getDupCityName(city){
        if(city.charAt(0)==="臺"){
            city = city.replace("臺", "台");
        }
        else if(city.charAt(0)==="台"){
            city = city.replace("台", "臺");
        }
        return city;
    }
    function splitAddr(addr){
        if(addr.indexOf("(") >= 0){
            addr = addr.replace("(", " ");
            addr = addr.replace(")", " ");
        }
        return addr.split(/\s+/);
    }
    function examineAddrs(citySet, addrs){
        let addrsWithCity = [];
        for(let i=0; i<addrs.length; i++){
            if(addrs[i].includes("號")){
                addrsWithCity.push(addrs[i]);
            }
        }
        return addrsWithCity.length===1 ? addrsWithCity[0] : null;
    }
    function prependCity(citySet, addr){
        let index = getCityIndexOfAddr(citySet, addr);
        if (index >=0){
            return addr.substring(index);
        }else{
            return citySet[0].concat(addr);
        }
        function getCityIndexOfAddr(citySet, addr){
            if(addr.indexOf(citySet[0])>=0) return addr.indexOf(citySet[0]);
            else if(addr.indexOf(citySet[1])>=0) return addr.indexOf(citySet[1]);
            else return -1  
        }
    }
}


module.exports = {
    getMeetupTP: getMeetupTP,
    getEventPalTP: getEventPalTP,
    getAccupassTP: getAccupassTP
}
