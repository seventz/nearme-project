const express = require('express');
const bodyparser = require("body-parser");
const path = require('path');
const request = require('request');
const multer = require("multer");
const cron = require('node-cron');
const crypto = require('crypto');
const aws = require('aws-sdk');
const multerS3 = require('multer-s3');

// Constants and Library
const cst = require('./source/constants');
const lib = require('./source/lib');
const dao = require('./source/dao');
const mysql = require("./source/mysqlcon");

// aws S3 Configuration
aws.config.update({
	accessKeyId: cst.auth.aws.accessKeyId,
	secretAccessKey: cst.auth.aws.secretAccessKey
});
const s3 = new aws.S3();
 
const app = express();
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({extended:true}));
app.use(express.static("public"));

// Data Crawler Initializer
const dataCrawler = require("./source/dataCrawler");

// -- node-cron scheduler -- //
cron.schedule(`53 8 */${cst.crawler.update.DAY_INTEVAL} * *`, async function(){
	dataCrawler.getMeetupTP();
	console.log("Updated Meetup automatically!");
});
cron.schedule(`53 9 */${cst.crawler.update.DAY_INTEVAL} * *`, async function(){
	dataCrawler.getEventPalTP();
	console.log("Updated EventPal automatically!");
});
cron.schedule(`53 10 */${cst.crawler.update.DAY_INTEVAL} * *`, async function(){
	dataCrawler.getAccupassTP();
	console.log("Updated Accupass automatically!");
});


app.get('/', async function(req, res){
	res.sendFile(path.join(__dirname + "/index.html"));
});

// Turn to Cache in the future
let lastSearchedTitle = [];
let lastSearch = [];
let lastParams = '';
app.get('/filter/:f', async function(req, res){
	let {f} = req.params;
	let {cat, type, owner, dist, center, listing, paging} = req.query;
	let {user_id, actl_id} = req.query;

	let timeNow = lib.getLocalISOTime();

	(!paging) ? paging = 0 : paging = parseInt(paging);
	(!listing) ? listing = 12 : listing = parseInt(listing);
	
	let currentParams = req.query;

	// Get [cat, center, dist, type, owner] as mainFilters
	// Logic: if only [paging, listing] different, get data from pseudo Cache
	let currentMainFilters = Object.values(currentParams).splice(0, 5).join(',');
	let lastMainFilters = Object.values(lastParams).splice(0, 5).join(',');
    
	if(currentMainFilters === lastMainFilters){
		console.log('Get data from memory.')
		let result = lastSearch.slice(paging*listing, (paging+1)*listing);
		res.json({data: result, info:{
			entries: lastSearch.length,
			listing: listing,
			paging: paging,
			pageCount: cst.admin.PAGE_COUNT,
			request: req.query}});
	}else{
		console.log("Query new data.")

		let bounds = {t: null, b: null, r: null, l: null};
		let subSQLs = [];
		let filterSQL = '';
		subSQLs.push(`t_start > '${timeNow}'`);
		if(cat){subSQLs.push(`category = '${cat}'`);}
		if(type){subSQLs.push(`actl_type = '${type}'`);}
		if(owner){subSQLs.push(`owner = '${owner}'`)}

		if(actl_id){subSQLs.push(`actl_id = '${actl_id}'`)};
		if(user_id){subSQLs.push(`owner = '${user_id}'`)};

		// This should be the last because SQL contains "order by"
		if(dist && center){
			center = {
				lat: parseFloat(req.query.center.split(',')[0]),
				lng: parseFloat(req.query.center.split(',')[1])
			}
			dist = parseInt(dist);
			bounds.t = center.lat + (dist / cst.algo.LAT_TO_M_PER_DEG);
			bounds.b = center.lat - (dist / cst.algo.LAT_TO_M_PER_DEG);
			bounds.r = center.lng + (dist / cst.algo.LNG_TO_M_PER_DEG);
			bounds.l = center.lng - (dist / cst.algo.LNG_TO_M_PER_DEG);
			subSQLs.push(`(lat > ${bounds.b} AND lat < ${bounds.t} AND lng > ${bounds.l} AND lng < ${bounds.r}) ORDER BY (POW((lat-${center.lat}),2) + POW((lng-${center.lng}),2))`);
		}
		if(subSQLs.length>0){filterSQL = `WHERE ${subSQLs.join(' AND ')}`;}
		
		let query = `SELECT * FROM data ${filterSQL}`;
		let result = await mysql.queryp(query, null, errMsg);

		// Store last searched data in pseudo Cache
		lastSearch = result;
		lastSearchedTitle = result.map(function(r){
			return {
				actl_id: r.actl_id,
				title: r.title
			}
		});
		////////
		
		// Send limited data to front-end
		let listingResult = result.slice(paging*listing, (paging+1)*listing);
		res.json({
			data: listingResult,
			info:{
				entries: result.length,
				listing: listing,
				paging: paging,
				pageCount: cst.admin.PAGE_COUNT,
				request: req.query
			}});
	}
	// Update last search
	lastParams = currentParams;	
});
function sortByDist(data, center){
	return data.map(function(d){
		d.dist = Math.sqrt(Math.pow(d.lat-center.lat, 2)+Math.pow(d.lng-center.lng, 2));
		// d.dist = Math.abs(d.lat-center.lat)+Math.abs(d.lng-center.lng);
		return d;
	}).sort(function(a, b){
		return a.dist - b.dist;
	});
}

let lastKeyHead = '';
let filterL1 = '';
app.get('/search/title/:mode', function(req, res){
	let {mode} = req.params;
	let {words} = req.query;
	
	if(words.length === 0){return res.json();}

	if(mode==='realtime'){
		words = words.toLowerCase();
		let keyHead = words.charAt(0);
		let keyTails = words.substring(1).split("");
		
		// Logic
		// keyword 0 => 1 // do first search
		// keyword > 1 // search from last searched
		// keyword n => 0 // reset
		if(keyHead!=lastKeyHead){
			filterL1 = lastSearchedTitle.filter(s=>s.title.toLowerCase().includes(keyHead));
			res.json(filterL1);
		}else{
			if(keyTails.length===0){
				res.json(filterL1);
			}else if(keyTails.length>0){
				let filterL2 = filterL1;
				keyTails.forEach(function(kt){
					filterL2 = filterL2.filter(f2=>f2.title.toLowerCase().includes(kt))
				});
				res.json(filterL2)
			}
		}
		
		lastKeyHead = keyHead; // Record the 1st word on last search
	}else if(mode==="keywords"){
		// Logic: compare all keyword fragments
		let splitWords = words.toLowerCase().split(',');
		let fragments = splitWords.filter(s=>s!='');
		let fitFragments = [];
		fragments.forEach(function(fr){
			let arr = lastSearchedTitle.filter(s=>s.title.toLowerCase().includes(fr))
			fitFragments.push(...arr);
		});
		res.json(fitFragments);
	}
});
app.get('/get/user/icon', async function(req, res){
	let {user_id} = req.query;
	let icon = await mysql.queryp(`SELECT icon FROM user WHERE user_id = ?`, user_id);
	res.json(icon);
});
app.get('/get/activity', async function(req, res){
	let {actl_id} = req.query;
	let promContent = mysql.queryp(`SELECT * FROM data WHERE actl_id = ?`, actl_id, errMsg);
	let promMember = mysql.queryp(`SELECT activity.*, user.name, user.icon FROM activity LEFT JOIN user ON (activity.user_id = user.user_id) WHERE activity.actl_id = ? AND (activity.status = ? OR activity.status = ?)`, [actl_id, 'joined', 'held'], errMsg);
	Promise.all([promContent, promMember]).then(function(results){
		let members = results[1];
		members.forEach(function(m){
			if(!m.icon || m.icon==='null'){
				m.icon = `../img/icon/${lib.randomNoGen(96)}.png`;
			}else{
				m.icon = `../img/${m.icon}.png`;
			}
		})
		res.json({
			content: results[0][0],
			member: members
		})
	}).catch(function(error){
		res.json({error: "Database query error."})
	});
});
app.get('/get/list/:p', async function(req, res){
	let {p} = req.params;
	let {cat} = req.query; 
	let result, types;
	if(p==='category'){
		res.json(cst.admin.CAT);
	}else if(p==='type'){
		if(cat==='custom'){
			result = await mysql.queryp(`SELECT DISTINCT actl_type FROM data where category = '${cat}'`, null, errMsg);
			types = result.map(t=>t.actl_type);
			res.json(types);
		}else if(cat==='official'){
			result = await mysql.queryp(`SELECT DISTINCT owner FROM data where category = '${cat}'`, null, errMsg);
			types = result.map(t=>t.owner);
			res.json(types);
		}
	}else{
		res.json({error: "Error request."});
	}
})

let upload = multer({
	storage: multerS3({
		s3: s3,
		bucket: 'seventz002',
		metadata: function(req, file, cb){
			cb(null, {fieldName: file.fieldname});
		},
		key: function(req, file, cb){
			let imgExt = file.mimetype.replace(/image\//, ".");
			switch (file.fieldname) {
				case 'activity':
					cb(null, `${file.fieldname}/${Date.now()}${imgExt}`);
					break;
				case 'profile':
					cb(null, `${file.fieldname}/${Date.now()}${imgExt}`);
					break;
				default:
					res.json(errMsg("Upload error"));
					return;
			}
		}
	})
});
let uploadS3Activity = upload.fields([{name: 'activity', maxCount: 1}]);
let uploadS3Profile = upload.fields([{name: 'profile', maxCount: 1}]);
app.post('/upload/addActl', uploadS3Activity, async function(req, res){
	// -- Update data table -- //
	let dataPackage = req.body;
	let actl_id = lib.activityIdGen();
	dataPackage.t_start = lib.minusUTCOffset(dataPackage.t_start);
	dataPackage.t_end = lib.minusUTCOffset(dataPackage.t_end);
	dataPackage.id = null;
	dataPackage.actl_id = actl_id;
	dataPackage.category = 'custom';
	dataPackage.title = lib.removeEmojis(dataPackage.title);
	dataPackage.description = lib.removeEmojis(dataPackage.description);
	dataPackage.ref = `${cst.admin.SERVER}/?event=${actl_id}`;
	dataPackage.official_id = null;
	dataPackage.created = lib.getLocalISOTime();
	dataPackage.free = true;
	dataPackage.main_img = req.files.activity ? `${cst.admin.S3_BUCKET}${req.files.activity[0].key}` : null;

	// -- Processing location information -- //
	let result = await processingLocation(dataPackage.address, dataPackage.lat, dataPackage.lng);
	if(result.address){dataPackage.address = result.address}
	if(result.location){
		dataPackage.lat = result.location.lat;
		dataPackage.lng = result.location.lng;
	}

	// -- Update activity table -- //
	let actlData = {
		id: null,
		user_id: dataPackage.owner,
		actl_id: actl_id,
		status: 'held'
	}
	
	mysql.con.beginTransaction(async function(err){
		if(err){return mysql.con.rollback(function(err){errMsg(err);});}
		await dao.insert('data', dataPackage);
		await dao.insert('activity', actlData);
		mysql.con.commit(function(err){
			if(err){
				res.json({status: 500, error: "Add activity failed."});
				return mysql.con.rollback(function(err){errMsg(err);});
			}else{
				res.json({status: 200, data: dataPackage});
			}
		});
	});
});
app.post('/upload/editActl', uploadS3Activity, async function(req, res){
	// -- Update data table -- //
	let dataPackage = req.body;
	dataPackage.title = lib.removeEmojis(dataPackage.title);
	dataPackage.description = lib.removeEmojis(dataPackage.description);
	dataPackage.t_start = lib.minusUTCOffset(dataPackage.t_start);
	dataPackage.t_end = lib.minusUTCOffset(dataPackage.t_end);
	
	if(req.files.activity){
		// Add new main_img
		dataPackage.main_img = req.files.activity[0].location;
		// Delete old main_img
		let oldPath = await mysql.queryp(`SELECT main_img FROM data WHERE actl_id = ?`, dataPackage.actl_id, errMsg);
		if(oldPath[0].main_img){
			let params = {Bucket:'seventz002', Delete: {Objects:[{Key: oldPath[0].main_img.split(cst.admin.S3_BUCKET)[1]}]}};
			s3.deleteObjects(params, function(err, data){
				if(err) console.log(err, err.stack);  // error
				else{console.log(data);}
			});
		}
	}

	let result = await processingLocation(dataPackage.address, dataPackage.lat, dataPackage.lng);
	if(result.address){dataPackage.address = result.address}
	if(result.location){
		dataPackage.lat = result.location.lat;
		dataPackage.lng = result.location.lng;
	}

	mysql.con.beginTransaction(async function(err){
		if(err){return mysql.con.rollback(function(err){errMsg(err);});}
		await mysql.queryp(`UPDATE data SET ? WHERE actl_id = ?`, [dataPackage, dataPackage.actl_id]);
		mysql.con.commit(function(err){
			if(err){
				res.json({status: 500, error: "Update activity failed."});
				return mysql.con.rollback(function(err){errMsg(err);});
			} else{
				res.json({status: 200, data: dataPackage});
			}
		});
	});
});
app.post('/upload/profile', uploadS3Profile, async function(req, res){
	let data = req.body;
	if(!data.user_id || data.user_id==='null'){
		res.json({status: 401, error: "User_id required."});
	}else if(data.filename != "profile"){
		res.json({status: 400, error: "Invalid field name."})
	}else{
		let path = req.files.profile[0].location;

		// Delete old profile_pic
		let oldPath = await mysql.queryp(`SELECT profile_pic FROM user WHERE user_id = ?`, data.user_id, errMsg);
		if(oldPath[0].profile_pic){
			let params = {Bucket:'seventz002', Delete: {Objects:[{Key: oldPath[0].profile_pic.split(cst.admin.S3_BUCKET)[1]}]}};
			s3.deleteObjects(params, function(err, data) {
				if(err){console.log(err, err.stack);}
				else{console.log(data);}
			});
		}
		
		let query = 'UPDATE user SET profile_pic = ? WHERE user_id = ?';
		await mysql.queryp(query, [path, data.user_id], errMsg);
		res.json({status: 200, data: path})
	}
	
});

app.post('/user/signin', async function(req, res){
	let provider = req.body.provider;
	let timeNow = Date.now();
	let access_expired = timeNow + (cst.admin.TOKEN_EXPIRED_IN_SEC * 1000);
	let access_token = crypto.createHash('sha256').update(timeNow.toString()).digest('hex');
	
	if(provider === 'native'){
		let email = req.body.email;
		let encrPwd = crypto.createHmac('sha256', req.body.password+cst.auth.admin.pwsecret).digest('hex');
		let userData = await mysql.queryp("SELECT * FROM user WHERE provider = ? AND email = ? AND password = ?", [provider, email, encrPwd], errMsg)
		if(userData.length === 0){
			res.json({error: 'No user data matched.'});
		}else{
			mysql.query("UPDATE user SET access_token = ?, access_expired = ? WHERE email = ?", [access_token, access_expired, email], errMsg);
			let userPreference = await mysql.queryp("SELECT * FROM activity WHERE user_id = ?", userData[0].user_id, errMsg);
			let preference = userPreference.map(function(u){
				return {
					actl_id: u.actl_id,
					status: u.status
				}
			});
			
			res.json({data:{
				user_id: userData[0].user_id,
				provider: userData[0].provider,
				name: userData[0].name,
				email: userData[0].email,
				icon: userData[0].icon,
				access_token: access_token
			}, preference: preference});
		}
	}else if(provider === 'facebook'){
		let {access_token} = req.body;
		let fbUrl = `https://graph.facebook.com/me?fields=id,name,email,picture.width(300).height(300)&access_token=${access_token}`;
		request(fbUrl, async function(err, response, body){
			if(err){
				res.json({error: "Cannot get profile from Facebook. Consider to sign in directly."});
			}else{
				let responseData = JSON.parse(body);
				let data = {
					id: null,
					user_id: lib.userIdGen(),
					provider: provider,
					name: responseData.name,
					email: responseData.email,
					password: null,
					icon: `icon/${lib.randomNoGen(96)}`,
					profile_pic: responseData.picture.data.url,
					access_token: access_token,
					access_expired: null
				}
				let userData = await mysql.queryp("SELECT * FROM user WHERE provider = ? AND name = ? AND email = ?", [provider, data.name, data.email], errMsg)
				if(userData.length === 0){
					mysql.queryp("INSERT INTO user SET ?", data, errMsg).then(function(result){
						res.json({data:{
							user_id: data.user_id,
							provider: data.provider,
							name: data.name,
							email: data.email,
							icon: data.icon,
							access_token: access_token
						}, preference: []});
					});
				}else{
					mysql.query("UPDATE user SET access_token = ?, profile_pic = ? WHERE email = ?", [access_token, data.profile_pic,data.email], errMsg);
					let userPreference = await mysql.queryp("SELECT * FROM activity WHERE user_id = (SELECT user_id FROM user WHERE provider = ? AND email = ?)", [data.provider, data.email], errMsg);
					let preference = userPreference.map(function(u){
						return {
							actl_id: u.actl_id,
							status: u.status
						}
					});
					
					res.json({data:{
						user_id: data.user_id,
						provider: data.provider,
						name: data.name,
						email: data.email,
						icon: data.icon,
						access_token: access_token
					}, preference: preference});
				}
			}
		});
	}else{
		res.json({error:"Invalid provider."});
	}
});
app.post('/user/signup', async function(req, res){
	let findUser = await mysql.queryp("SELECT * FROM user WHERE email = ?", req.body.email, errMsg);
	if(findUser.length>0){
		res.json({error: "此帳號已註冊。"});
	}else{
		let timeNow = Date.now();
		let access_expired = timeNow + (cst.admin.TOKEN_EXPIRED_IN_SEC * 1000);
		let access_token = crypto.createHash('sha256').update(timeNow.toString()).digest('hex');
		let encrPwd = crypto.createHmac('sha256', req.body.password+cst.auth.admin.pwsecret).digest('hex');

		let data = {
			id: null,
			user_id: lib.userIdGen(),
			provider: req.body.provider,
			name: req.body.name,
			email: req.body.email,
			password: encrPwd,
			icon: `icon/${lib.randomNoGen(96)}`,
			access_token: access_token,
			access_expired: access_expired
		}

		mysql.queryp('INSERT INTO user SET ?', data, errMsg)
			.then(function(){
				res.json({data:{
					user_id: data.user_id,
					provider: data.provider,
					name: data.name,
					email: data.email,
					icon: data.icon,
					access_token: data.access_token
				}, preference: []});
			}).catch(function(){
				res.json({error: "更新資料失敗，請稍後再試。"})
			});
	}
});
app.get('/user/profile', bearerToken, async function(req, res){
	const timeNow = Date.now();
	let {provider} = req.query;
	if(!req.token){return res.json({status: 403, error: "Access denied without token."});}
	if(!provider){return res.json({status: 400, error: "Invalid provider."});}
	
	let query = "SELECT * FROM user WHERE provider = ? AND access_token = ?";
	let queryReplacement = [provider, req.token];
	if(provider === "native"){
		query += " AND access_expired > ?";
		queryReplacement.push(timeNow);
	}
	let userData = await mysql.queryp(query, queryReplacement, errMsg);
	if(userData.length != 1){
		res.json({status: 401, error: "Token expired."});
	}else{
		let userPreference = await mysql.queryp("SELECT * FROM activity WHERE user_id = ?", userData[0].user_id, errMsg);
		let preference = userPreference.map(function(u){
			return {
				actl_id: u.actl_id,
				status: u.status
			}
		});
		res.json({
			status: 200, 
			data:{
				user_id: userData[0].user_id,
				provider: userData[0].provider,
				name: userData[0].name,
				email: userData[0].email,
				icon: userData[0].icon,
				profile_pic: userData[0].profile_pic,
				access_token: userData[0].access_token
			}, 
			preference: preference
		});
	}
});
app.get('/user/activity', function(req, res){
	let actl_id = req.query.actl_id.split(',');
	mysql.queryp(`SELECT actl_id, title, t_start FROM data WHERE actl_id in ('${actl_id.join("', '")}')`, null, errMsg).then(function(result){
		res.json(result);
	});
});

app.post('/user/status/:action', bearerToken, async function(req, res){
	let {action} = req.params;
	let {actl_id} = req.body;
	// if(action != 'like' || action != 'attend') res.json({error: "Invalid request."});
	let dataPackage = {actl_id: actl_id};
	if(!req.token) res.json({error: "Access denied without token."});
	
	let userData = await mysql.queryp(`SELECT user_id FROM user WHERE access_token = '${req.token}';`, null, errMsg);
	if(!userData.length === 0) res.json({erorr: "Invalid token."})
	else{
		let user_id = userData[0].user_id;
		dataPackage.user_id = user_id;
		let status = '';
		if(action==='like'||action==='liked'){status = 'liked';}
		else if(action==='join'||action==='joined'){status = 'joined';}
		dataPackage.status = status;
		console.log(dataPackage)
		let query = "SELECT * FROM activity WHERE user_id = ? AND actl_id = ? AND status = ?";
		
		let activityStatus = await mysql.queryp(query, [user_id, actl_id, status], errMsg);
		if(activityStatus.length===0){
			dataPackage.id = null;
			mysql.queryp(`INSERT INTO activity SET ?`, dataPackage, errMsg).then(function(){
				res.json({message: 'added'});
			}).catch(function(error){
				console.log(error);
				res.json({error: "Insert data error."})
			});
		}else{
			res.json({message: 'removed'});
			mysql.query(`DELETE FROM activity WHERE user_id = ? AND actl_id = ? AND status = ?`, [user_id, actl_id, status], errMsg);
		}
	}
});
app.post('/user/delete/activity', function(req, res){
	let {actl_id} = req.query;
	mysql.query(`DELETE FROM data WHERE actl_id = ?`, actl_id, errMsg);
	res.json();
});

app.post('/user/update/:item', bearerToken, function(req, res){
	let {item} = req.params;
	let data = req.body;
	if(!req.token){return res.json({error: "Access denied without token."});}
	if(item==="icon"){
		let query = 'UPDATE user SET icon = ? WHERE user_id = ?';
		mysql.queryp(query, [data.icon, data.user_id], errMsg).then(function(){
			res.json({message: true});
		}).catch(function(err){
			console.log(err);
			res.json({error: 'Update data error.'})
		});
	}
	
});

function bearerToken(req, res, next){
	const bearerHeader = req.headers['authorization'];
	if(typeof bearerHeader!='undefined') {
		const bearerToken = bearerHeader.split(' ')[1];
		req.token = bearerToken;
	}
	next();
}

function processingLocation(address, lat, lng){
	return new Promise(function(resolve, reject){
		if(address==='null'){
			// Reverse geocoding //
			lib.reverseGeocodeBuffer(lat, lng).then(function(address){
				resolve({address: address});
			}).catch(err=>console.log(err));
		}else if(lat==='null' && lng==='null'){
			// Geocoding // 
			lib.geocodeBuffer(address).then(function(location){
				resolve({location: {
					lat: location.lat,
					lng: location.lng
				}});
			}).catch(err=>console.log(err));
		}
	})
}

function errMsg(err){
    console.log(err);
}

app.listen(cst.auth.admin.port, () => {
	console.log(`My application is running on port ${cst.auth.admin.port}!`)
});
