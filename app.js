const express = require('express');
const bodyparser = require("body-parser");
const path = require('path');
const request = require('request');
const multer = require("multer");
const cron = require('node-cron');
const crypto = require('crypto');
const aws = require('aws-sdk');
const multerS3 = require('multer-s3');
const Redis = require('ioredis');

// Constants and Library
const cst = require('./source/constants');
const lib = require('./source/lib');
const dao = require('./source/dao');
const mysql = require("./source/mysqlcon");
const dataCrawler = require("./source/dataCrawler");

// aws S3 Configuration
aws.config.update({
	accessKeyId: cst.auth.aws.accessKeyId,
	secretAccessKey: cst.auth.aws.secretAccessKey
});
const s3 = new aws.S3();
 
// Redis
const redis = new Redis({
	host: cst.auth.redis.host, 
	port: cst.auth.redis.port
})

const app = express();
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({extended:true}));
app.use(express.static("public"));

// -- node-cron scheduler -- //
cron.schedule(`53 8 */${cst.crawler.update.DAY_INTEVAL} * *`, function(){
	dataCrawler.getMeetupTP();
	console.log("Updated Meetup automatically!");
});
cron.schedule(`53 7 */${cst.crawler.update.DAY_INTEVAL} * *`, function(){
	dataCrawler.getEventPalTP();
	console.log("Updated EventPal automatically!");
});
cron.schedule(`53 6 */${cst.crawler.update.DAY_INTEVAL} * *`, function(){
	dataCrawler.getAccupassTP();
	console.log("Updated Accupass automatically!");
});

app.get('/', function(req, res){
	res.sendFile(path.join(__dirname + "/index.html"));
});

app.get('/filter/:mode', getFromCache, async function(req, res){
	let {mode} = req.params;
	let {center, dist, cat, owner, type, listing, paging} = req.query;
	let {actl_id} = req.query;
	let {id_token} = req.headers;

	console.log("Query new data.");
	let result;
	if(mode==='id'){
		result = await dao.getDataById(actl_id);
	}else{
		result = await dao.getData(req.query);
	}
	
	// Send limited data to front-end
	res.json({
		data: result.slice(paging*listing, (paging+1)*listing),
		info:{
			entries: result.length,
			listing: listing,
			paging: paging,
			pageCount: cst.admin.PAGE_COUNT,
			query: req.query
		}});


	// Update new search information into cache
	redis.set(`${id_token}:lastResult`, JSON.stringify(result), "EX", 600);
	let lastTitle = result.map(function(r){
		return {
			actl_id: r.actl_id,
			title: r.title
		}
	});
	redis.set(`${id_token}:lastTitle`, JSON.stringify(lastTitle), "EX", 600);
	redis.set(`${id_token}:lastFilter`, `${center},${dist},${cat},${owner},${type}`, "EX", 600);
});

app.get('/search/title/:mode', async function(req, res){
	let {mode} = req.params;
	let {words} = req.query;
	let {id_token} = req.headers;
	if(words.length === 0){return res.json();}

	// Get last searched data from cache
	let lastSearch = await redis.get(`${id_token}:lastTitle`).then(r=>JSON.parse(r));
	let filterL1 = await redis.get(`${id_token}:lastTitle:filterL1`).then(r=>JSON.parse(r));
	let lastKeyHead = await redis.get(`${id_token}:lastTitle:lastKeyHead`);

	if(mode==='realtime'){
		words = words.toLowerCase();
		let keyHead = words.charAt(0);
		let keyTails = words.substring(1).split("");
		
		// Logic
		// keyword 0 => 1 // do first search
		// keyword > 1 // search from last searched
		// keyword n => 0 // reset
		if(keyHead!=lastKeyHead){
			filterL1 = lastSearch.filter(s=>s.title.toLowerCase().includes(keyHead));
			await redis.set(`${id_token}:lastTitle:filterL1`, JSON.stringify(filterL1));
			res.json(filterL1);
		}else{
			if(keyTails.length===0){
				res.json(filterL1);
			}else if(keyTails.length>0){
				let filterL2 = filterL1;
				keyTails.forEach(function(kt){
					filterL2 = filterL2.filter(f2=>f2.title.toLowerCase().includes(kt))
				});
				res.json(filterL2);
			}
		}
		redis.set(`${id_token}:lastTitle:lastKeyHead`, keyHead);
		// lastKeyHead = keyHead; // Record the 1st word on last search
	}else if(mode==="keywords"){
		// Logic: compare all keyword fragments
		let splitWords = words.toLowerCase().split(',');
		let fragments = splitWords.filter(s=>s!='');
		let fitFragments = [];
		fragments.forEach(function(fr){
			let arr = lastSearch.filter(s=>s.title.toLowerCase().includes(fr))
			fitFragments.push(...arr);
		});
		res.json(fitFragments);
	}
});

app.get('/get/activity', function(req, res){
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
	let data = req.body;
	let actl_id = lib.activityIdGen();
	data.id = null;
	data.actl_id = actl_id;
	data.category = 'custom';
	data.title = lib.removeEmojis(data.title);
	data.description = lib.removeEmojis(data.description);
	data.ref = `${cst.admin.SERVER}/?event=${actl_id}`;
	data.official_id = null;
	data.created = lib.getLocalISOTime();
	data.free = true;
	data.main_img = req.files.activity ? `${cst.admin.S3_BUCKET}${req.files.activity[0].key}` : null;

	// -- Processing location information -- //
	let result = await lib.processingLocation(data.address, data.lat, data.lng);
	if(result.address){data.address = result.address}
	if(result.location){
		data.lat = result.location.lat;
		data.lng = result.location.lng;
	}

	// -- Update activity table -- //
	let actlData = {
		id: null,
		user_id: data.owner,
		actl_id: actl_id,
		status: 'held'
	}
	let querySet = [
		{query: "INSERT INTO data SET ?", data: data}, 
		{query: "INSERT INTO activity SET ?", data: actlData}
	];
	
	// -- Transaction with all queries -- //
	mysql.txnQueries(querySet).then(function(){
		res.json({status: 200, data: data});
	}).catch(function(err){
		res.json({status: 500, error: "Add activity error."});
	});
});
app.post('/upload/editActl', uploadS3Activity, async function(req, res){
	// -- Update data table -- //
	let data = req.body;
	data.title = lib.removeEmojis(data.title);
	data.description = lib.removeEmojis(data.description);
	
	if(req.files.activity){
		// Add new main_img
		data.main_img = req.files.activity[0].location;
		// Delete old main_img
		let oldPath = await mysql.queryp(`SELECT main_img FROM data WHERE actl_id = ?`, data.actl_id, errMsg);
		if(oldPath[0].main_img){
			let params = {Bucket: cst.admin.BUCKET_NAME, Delete: {Objects:[{Key: oldPath[0].main_img.split(cst.admin.S3_BUCKET)[1]}]}};
			s3.deleteObjects(params, function(err, data){
				if(err) console.log(err, err.stack);
				else{console.log(data);}
			});
		}
	}

	let result = await lib.processingLocation(data.address, data.lat, data.lng);
	if(result.address){data.address = result.address}
	if(result.location){
		data.lat = result.location.lat;
		data.lng = result.location.lng;
	}

	mysql.queryp("UPDATE data SET ? WHERE actl_id = ?", [data, data.actl_id]).then(function(){
		res.json({status: 200, data: data});
	}).catch(function(){
		res.json({status: 500, error: "Update activity failed."});
	});

});
app.post('/upload/profile', uploadS3Profile, async function(req, res){
	let data = req.body;
	if(!data.user_id || data.user_id==='null')
		return res.json({status: 401, error: "User_id required."});
	if(data.filename != "profile")
		return res.json({status: 400, error: "Invalid field name."})
	
	let path = req.files.profile[0].location;

	// Delete old profile_pic
	let oldPath = await mysql.queryp(`SELECT profile_pic FROM user WHERE user_id = ?`, data.user_id, errMsg);
	if(oldPath[0].profile_pic){
		let params = {Bucket: cst.admin.BUCKET_NAME, Delete: {Objects:[{Key: oldPath[0].profile_pic.split(cst.admin.S3_BUCKET)[1]}]}};
		s3.deleteObjects(params, function(err, data) {
			if(err){console.log(err, err.stack);}
			else{console.log(data);}
		});
	}
	console.log(data)
	let query = 'UPDATE user SET profile_pic = ? WHERE user_id = ?';
	await mysql.queryp(query, [path, data.user_id], errMsg);
	res.json({status: 200, data: path})
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
		res.json({status: 400, error:"Invalid provider."});
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
app.get('/user/profile', bearerToken, getUserData, async function(req, res){
	let user = req.user;
	mysql.queryp("SELECT * FROM activity WHERE user_id = ?", user.user_id, errMsg).then(function(result){
		res.json({
			status: 200, 
			data:{
				user_id: user.user_id,
				provider: user.provider,
				name: user.name,
				email: user.email,
				icon: user.icon,
				profile_pic: user.profile_pic,
				access_token: user.access_token
			}, 
			preference: result.map(function(u){
				return {
					actl_id: u.actl_id,
					status: u.status
				}
			})
		});
	});
});
app.get('/user/activity', function(req, res){
	let actl_id = req.query.actl_id.split(',');
	mysql.queryp(`SELECT actl_id, title, t_start FROM data WHERE actl_id in ('${actl_id.join("', '")}')`, null, errMsg).then(function(result){
		res.json(result);
	});
});
app.post('/user/status/:action', bearerToken, getUserData, async function(req, res){
	let {action} = req.params;
	let actl_id = req.body.actl_id;
	let status = '';
	let user_id = req.user.user_id;
	if(action==='like'||action==='liked'){status = 'liked';}
	if(action==='join'||action==='joined'){status = 'joined';}
	if(action==='hold'||action==='held'){status = 'held';}

	if(status!='liked' && status!='joined' && status!='held'){
		return res.json({status: 400, error: "Invalid request."});
	}
	
	let query = "SELECT * FROM activity WHERE user_id = ? AND actl_id = ? AND status = ?";
	let activityStatus = await mysql.queryp(query, [user_id, actl_id, status], errMsg);
	if(activityStatus.length===0){
		let data = {
			id: null,
			actl_id: actl_id,
			user_id: user_id,
			status: status
		}
		mysql.queryp(`INSERT INTO activity SET ?`, data, errMsg).then(function(){
			res.json({status: 200, message: 'added'});
		}).catch(function(){
			res.json({status: 500, error: "Insert data error."})
		});
	}else{
		if(status==='held'){
			mysql.queryp("DELETE FROM data WHERE actl_id = ?", actl_id, errMsg).then(function(){
				res.json({status: 200, message: 'removed'});
			}).catch(function(){
				res.json({status: 500, error: "Remove data error."})
			});
		}else{
			mysql.queryp("DELETE FROM activity WHERE user_id = ? AND actl_id = ? AND status = ?", [user_id, actl_id, status], errMsg).then(function(){
				res.json({status: 200, message: 'removed'});
			}).catch(function(){
				res.json({status: 500, error: "Remove data error."})
			});
		}
	}
});
app.post('/user/update/profile', bearerToken, getUserData, function(req, res){
	let data = req.body;
	let user = req.user;
	let query = 'UPDATE user SET ? WHERE user_id = ?';
	mysql.queryp(query, [data, user.user_id], errMsg).then(function(){
		res.json({status: 200, message: 'updated'});
	}).catch(function(err){	
		res.json({status: 500, error: 'Update data error.'})
	});
	
});

async function getFromCache(req, res, next){
	let {mode} = req.params;
	let {actl_id} = req.query;
	let {center, dist, cat, owner, type, listing, paging} = req.query;
	let {id_token} = req.headers;

	paging = paging ? parseInt(paging) : 0;
	listing = listing ? parseInt(listing) : 12;
	req.query.paging = paging;
	req.query.lising = listing;
	if(mode==='id'){
		let lastResult = await redis.get(`${id_token}:lastResult`).then(r=>JSON.parse(r));
		let data = lastResult.filter(r=>r.actl_id===actl_id);
		if(data.length===1){
			console.log('Get data from memory.');
			return res.json({
				data: data, 
				info:{
					entries: data.length,
					listing: listing,
					paging: paging,
					pageCount: cst.admin.PAGE_COUNT,
					query: req.query
				}});
		}
		next();
	}else{
		let filter = `${center},${dist},${cat},${owner},${type}`;
		let lastFilter = await redis.get(`${id_token}:lastFilter`);
		if(filter===lastFilter){
			console.log('Get data from memory.');
			let lastResult = await redis.get(`${id_token}:lastResult`).then(r=>JSON.parse(r));
			return res.json({
				data: lastResult.slice(paging*listing, (paging+1)*listing), 
				info:{
					entries: lastResult.length,
					listing: listing,
					paging: paging,
					pageCount: cst.admin.PAGE_COUNT,
					query: req.query
				}});
		}
		next();
	}
}

function bearerToken(req, res, next){
	const bearerHeader = req.headers['authorization'];
	if(typeof bearerHeader==='undefined'){
		return res.json({status: 403, error: "Access denied without token."})
	}
	req.token = bearerHeader.split(' ')[1];
	next();
}

function getUserData(req, res, next){
	mysql.queryp("SELECT * FROM user WHERE access_token = ?", req.token, errMsg).then(function(result){
		if(result.length!=1){
			return res.json({status: 403, erorr: "Invalid token."})
		}
		if(result[0].provider==="native" && result[0].access_expired<Date.now()){
			return res.json({status: 401, error: "Token expired."})
		}
		req.user = result[0];
		next();
	});
}



function errMsg(err){
    console.log(err);
}

app.listen(cst.auth.admin.port, () => {
	console.log(`My application is running on port ${cst.auth.admin.port}!`)
});
