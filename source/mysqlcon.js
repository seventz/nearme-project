// MySQL Initialization
const mysql = require("mysql");
const cst = require('./constants');
const mysqlCon = mysql.createConnection({
    host: cst.auth.mysql.host,
    user: cst.auth.mysql.user,
    password: cst.auth.mysql.password,
    database: cst.auth.mysql.database
});
// const mysqlCon = mysql.createPool({
//     connectionLimit: cst.auth.mysql.connlimit,
//     host: cst.auth.mysql.host,
//     user: cst.auth.mysql.user,
//     password: cst.auth.mysql.password,
//     database: cst.auth.mysql.database,
//     timezone: 'Z'
// });

mysqlCon.getConnection(function(err){
    if(err) throw err;
    else console.log("db connected!");
});

const sqlQuery = function(sql, params, callback){
    if(params){
        return mysqlCon.query(sql, params, function(error, results){
            if(error) return(callback(error));
            else return(results);
        });
    }else{
        return mysqlCon.query(sql, function(error, results){
            if(error) return(callback(error));
            else return(results);
        });
    }
}

const sqlQueryPromise = function(sql, params, callback){
    if(params){
        return new Promise(function(resolve, reject){
            mysqlCon.query(sql, params, function(error, results){
                if(error) reject(callback(error));
                else resolve(results);
            });
        });
    }else{
        return new Promise(function(resolve, reject){
            mysqlCon.query(sql, function(error, results){
                if(error) reject(callback(error));
                else resolve(results);
            });
        });
    }
}

module.exports={
    core: mysql,
    con: mysqlCon,
    query: sqlQuery,
    queryp: sqlQueryPromise
};