const mysql = require('./mysqlcon');

function printErr(err){
    console.log(err)
}

module.exports={
    insert: function(db, data){
        return mysql.queryp(`INSERT INTO ${db} SET ?`, data, printErr);
    },
    get: function(db, target, filter){
        if(!target){target = '*';}
        if(filter){filter = `WHERE ${filter}`;}
        console.log(`SELECT DISTINCT ${target} FROM ${db} ${filter}`)
        return mysql.queryp(`SELECT '${target}' FROM ${db} ${filter}`)
    },
    userPreference:function(user_id){
        
    }
}