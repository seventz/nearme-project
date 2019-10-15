// MySQL Initialization
const mysql = require("mysql");
const cst = require('./constants');

const mysqlPool = mysql.createPool({
    connectionLimit: cst.auth.mysql.CONNLIMIT,
    host: cst.auth.mysql.HOST,
    user: cst.auth.mysql.USER,
    password: cst.auth.mysql.PASSWORD,
    database: cst.auth.mysql.DATABASE,
    timezone: 'Z'
});

const transactionFunction = function(callback, ...args){
    return new Promise(function(resolve, reject){
        mysqlPool.getConnection(function(err, conn){
            conn.beginTransaction(function(err){
                if(err){
                    conn.rollback(function(){
                        reject({status: 500, error: 'Transaction connection error.'});
                        conn.release();
                    });
                }else{
                    callback(...args).then(function(results){
                        conn.commit(function(err){
                            if(err){conn.rollback(function(){
                                reject({status: 500, error: 'Transaction commitment error.'});
                                conn.release();
                            })}else{
                                resolve({status: 200, data: results});
                                conn.release();
                            }
                        });
                    }).catch(function(err){
                        conn.rollback(function(){
                            reject({status: 500, error: 'Callback function error.'});
                            conn.release();
                        });
                    });
                }
            })
        });
    });
}
const transactionQueriesPromise = function(queryArr){
    return new Promise(function(resolve, reject){
        mysqlPool.getConnection(async function(err, conn){
            conn.beginTransaction(function(err){
                if(err){
                    conn.rollback(function(){
                        reject({status: 500, error: 'Transaction connection error.'});
                        conn.release();
                    })
                }else{
                    processingQuery(queryArr, 0).then(function(){
                        conn.commit(function(err){
                            if(err){conn.rollback(function(){
                                reject({status: 500, error: 'Transaction commitment error.'});
                                conn.release();
                            })}else{
                                resolve({status: 200});
                                conn.release();
                            }
                        });
                    }).catch(function(err){
                        reject({status: 500, error: `Processing query: ${arr[count].query} error.`});
                        conn.release(); 
                    });
    
                    function processingQuery(arr, count){
                        return new Promise(function(resolve, reject){
                            if(count===arr.length){
                                resolve();
                            }else{
                                conn.query(arr[count].query, arr[count].data, function(err){
                                    if(err) reject(err);
                                    else resolve(processingQuery(arr, count+1));
                                });
                            }
                        })
                    }
                }
            });
        });
    });
}

const transactionQueryPromise = function(query, params){
    return new Promise(function(resolve, reject){
        mysqlPool.getConnection(function(err, conn){
            conn.beginTransaction(function(err){
                if(err){
                    conn.rollback(function(){
                        reject({status: 500, error: 'Transaction connection error.'});
                        conn.release();
                    })
                }else{
                    conn.query(query, params, function(error, results){
                        if(error){
                            reject({status: 500, error: 'Database query error.'});
                            conn.rollback(function(){
                                conn.release();
                            });
                        }else{
                            conn.commit(function(err){
                                if(err){conn.rollback(function(){
                                    reject({status: 500, error: 'Transaction commitment error.'});
                                    conn.release();
                                })}else{
                                    console.log("transaction committed")
                                    resolve(results);
                                    conn.release();
                                }
                            });
                        }
                    });
                }
            });
        });
    });
}

const transaction = function(callback){
    return new Promise(function(resolve, reject){
        mysqlPool.getConnection(function(connErr, conn){
            if(connErr){
                conn.release();
                return reject(connErr);
            }else{
                conn.beginTransaction(function(txnErr){
                    if(txnErr){
                        conn.rollback(function(){
                            conn.release();
                            return reject(txnErr);
                        });
                    }else{
                        // Pass pool connection into callback()
                        callback(conn).then(function(result){
                            conn.commit(function(commErr){
                                if(commErr){
                                    conn.rollback(function(){
                                        reject(commErr)
                                        return conn.release();
                                    });
                                }
                                resolve(result);
                                conn.release();
                            });
                        }).catch(function(cbErr){
                            conn.rollback(function(){
                                reject(cbErr);
                                return conn.release();
                            });
                        });
                    }
                });
            }
        });
    });
}

const sqlQueryPromise = function(query, params, connection){
    return new Promise(function(resolve, reject){
        if(connection){
            connection.query(query, params, function(error, results){
                if(error) reject(error);
                else resolve(results);
            });
        }else{
            mysqlPool.query(query, params, function(error, results){
                if(error) reject(error);
                else resolve(results);
            });
        }
    });
}

module.exports={
    core: mysql,
    pool: mysqlPool,
    queryp: sqlQueryPromise,
    txn: transaction,
    txnFunction: transactionFunction,
    txnQuery: transactionQueryPromise,
    txnQueries: transactionQueriesPromise
};