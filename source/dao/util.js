const mysql = require('../mysqlcon');
const lib = require('../lib');
const cst = require('../constants');

module.exports={
    insert: function(db, data, connection){
        return mysql.queryp(`INSERT INTO ${db} SET ?`, data, connection);
    },
    getDataByFilters: function(filters){
        let {center, dist, cat, owner, type} = filters;
        let timeNow = lib.getLocalISOTime();

        let filterSQL = '';
	    let subSQLs = [];
        
        let bounds = {t: null, b: null, r: null, l: null};
		subSQLs.push(`t_start > '${timeNow}'`);
		if(cat){subSQLs.push(`category = '${cat}'`);}
		if(type){subSQLs.push(`actl_type = '${type}'`);}
		if(owner){subSQLs.push(`owner = '${owner}'`)}
        if(dist && center){
			let latLng = {
				lat: parseFloat(center.split(',')[0]),
				lng: parseFloat(center.split(',')[1])
			}
			dist = parseInt(dist);
			bounds.t = latLng.lat + (dist / cst.algo.LAT_TO_M_PER_DEG);
			bounds.b = latLng.lat - (dist / cst.algo.LAT_TO_M_PER_DEG);
			bounds.r = latLng.lng + (dist / cst.algo.LNG_TO_M_PER_DEG);
			bounds.l = latLng.lng - (dist / cst.algo.LNG_TO_M_PER_DEG);
			subSQLs.push(`(lat > ${bounds.b} AND lat < ${bounds.t} AND lng > ${bounds.l} AND lng < ${bounds.r}) ORDER BY (POW((lat-${latLng.lat}),2) + POW((lng-${latLng.lng}),2))`);
        }

        if(subSQLs.length>0){filterSQL = `WHERE ${subSQLs.join(' AND ')}`;}
        return mysql.queryp(`SELECT * FROM data ${filterSQL}`, null);
    },
    getData: function(reference){
        return mysql.queryp(`SELECT * FROM data WHERE ?`, reference);
    },
    getUserData: function(reference){
        return mysql.queryp(`SELECT * FROM user WHERE ${refConcat(reference)}`, null);
    },
    getUserActivities: function(ids){
        let idArr = ids.split(',');
        return 	mysql.queryp(`SELECT actl_id, title, t_start FROM data WHERE actl_id in ('${idArr.join("', '")}')`, null);
    },
    getActivityData: function(reference){
        return mysql.queryp(`SELECT * FROM activity WHERE ${refConcat(reference)}`, null);
    },
    getActivityMembers: function(actl_id){
        return mysql.queryp("SELECT activity.*, user.name, user.icon FROM activity LEFT JOIN user ON (activity.user_id = user.user_id) WHERE activity.actl_id = ? AND (activity.status = ? OR activity.status = ?)", [actl_id, 'joined', 'held']);
    },
    getDistinctTypes: function(item, category){
        if(item==='actl_type'){
            return mysql.queryp("SELECT DISTINCT actl_type FROM data where category = ?", category);
        }else if(item==='owner'){
            return mysql.queryp("SELECT DISTINCT owner FROM data where category = ?", category);
        }
    },
    getImgPath: function(field, reference){
        if(field==='main_img'){
            return mysql.queryp("SELECT main_img FROM data WHERE ?", reference);
        }else if(field==='profile_pic')
            return mysql.queryp("SELECT profile_pic FROM user WHERE ?", reference);
    },
    updateUserData: function(data, reference){
        return mysql.queryp("UPDATE user SET ? WHERE ?", [data, reference]);
    },
    updateData: function(data, reference){
        return mysql.queryp("UPDATE data SET ? WHERE ?", [data, reference]);
    },
    delete: function(db, reference){
        return mysql.queryp(`DELETE FROM ${db} WHERE ${refConcat(reference)}`, null)
    },
    transaction: function(callback){
        return mysql.txn(callback);
    }
}
function refConcat(obj){
    let ref = [];
    for(let key in obj){
        ref.push(`${key} = '${obj[key]}'`);
    }
    return ref.join(" AND ");
}
