const mysql = require('./mysqlcon');
const lib = require('./lib');
const cst = require('./constants')

module.exports={
    insert: function(db, data){
        return mysql.queryp(`INSERT INTO ${db} SET ?`, data, printErr);
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
        return mysql.queryp(`SELECT * FROM data ${filterSQL}`, null, printErr);
    },
    getData: function(reference){
        return mysql.queryp(`SELECT * FROM data WHERE ?`, reference, printErr);
    },
    getUserData: function(reference){
        return mysql.queryp(`SELECT * FROM user WHERE ${refConcat(reference)}`, null, printErr);
    },
    getUserActivities: function(ids){
        let idArr = ids.split(',');
        return 	mysql.queryp(`SELECT actl_id, title, t_start FROM data WHERE actl_id in ('${idArr.join("', '")}')`, null, printErr);
    },
    getActivityData: function(reference){
        return mysql.queryp(`SELECT * FROM activity WHERE ${refConcat(reference)}`, null, printErr);
    },
    getActivityMembers: function(actl_id){
        return mysql.queryp("SELECT activity.*, user.name, user.icon FROM activity LEFT JOIN user ON (activity.user_id = user.user_id) WHERE activity.actl_id = ? AND (activity.status = ? OR activity.status = ?)", [actl_id, 'joined', 'held'], printErr);
    },
    getDistinctTypes: function(item, category){
        if(item==='actl_type'){
            return mysql.queryp("SELECT DISTINCT actl_type FROM data where category = ?", category, printErr);
        }else if(item==='owner'){
            return mysql.queryp("SELECT DISTINCT owner FROM data where category = ?", category, printErr);
        }
    },
    getImgPath: function(field, reference){
        if(field==='main_img'){
            return mysql.queryp("SELECT main_img FROM data WHERE ?", reference, printErr);
        }else if(field==='profile_pic')
            return mysql.queryp("SELECT profile_pic FROM user WHERE ?", reference, printErr);
    },
    updateUserData: function(data, reference){
        return mysql.queryp("UPDATE user SET ? WHERE ?", [data, reference], printErr);
    },
    updateData: function(data, reference){
        return mysql.queryp("UPDATE data SET ? WHERE ?", [data, reference], printErr);
    },
    delete: function(db, reference){
        return mysql.queryp(`DELETE FROM ${db} WHERE ${refConcat(reference)}`, null, printErr)
    }
}
function refConcat(obj){
    let ref = [];
    for(let key in obj){
        ref.push(`${key} = '${obj[key]}'`);
    }
    return ref.join(" AND ");
}
function printErr(err){
    console.log(err)
}
