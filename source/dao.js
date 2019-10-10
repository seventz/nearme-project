const mysql = require('./mysqlcon');
const lib = require('./lib');
const cst = require('./constants')

function printErr(err){
    console.log(err)
}

module.exports={
    insert: function(db, data){
        return mysql.queryp(`INSERT INTO ${db} SET ?`, data, printErr);
    },
    getData: function(filters){
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
    getDataById: function(actl_id){
        return mysql.queryp(`SELECT * FROM data WHERE actl_id = '${actl_id}'`, null, printErr);
    }
}