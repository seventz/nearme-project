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
		result = await dao.getData({actl_id: actl_id});
	}else{
		result = await dao.getDataByFilters(req.query);
		// Update new search information into cache
		redis.set(`${id_token}:lastResult`, JSON.stringify(result), "EX", 600);
		let lastTitle = result.map(function(r){
			return {
				actl_id: r.actl_id,
				title: r.title
			}
		});
		redis.set(`${id_token}:lastTitle`, JSON.stringify(lastTitle), "EX", 600);
	}
	redis.set(`${id_token}:lastFilter`, `${center},${dist},${cat},${owner},${type}`, "EX", 600);

	// Send limited data to front-end
	res.json({
		status: 200,
		data: result.slice(paging*listing, (paging+1)*listing),
		info:{
			entries: result.length,
			listing: listing,
			paging: paging,
			pageCount: cst.admin.PAGE_COUNT,
			query: req.query
		}});
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
		
		/**
		 * Logic:
		 * 1. keyword from 0 to 1: do first search
		 * 2. keyword > 1:  search from last searched
		 * 3. keyword from n to 0: reset
		 */
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
		// Record the 1st word on last search
		redis.set(`${id_token}:lastTitle:lastKeyHead`, keyHead);
	}else if(mode==="keywords"){
		/**
		 * Logic: compare all keyword fragments
		 */
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
	let content = dao.getData({actl_id: req.query.actl_id});
	let members = dao.getActivityMembers(req.query.actl_id);
	Promise.all([content, members]).then(function(results){
		let members = results[1];
		members.forEach(m=>m.icon=`../img/${m.icon}.png`);
		res.json({
			status: 200,
			data:{
				content: results[0][0],
				member: members
			}
		})
	}).catch(function(){
		res.json({status: 500, error: "Database query error."})
	});
});
app.get('/get/list/:p', async function(req, res){
	let {p} = req.params;
	let {cat} = req.query;
	if(p==='category'){return res.json(cst.admin.CAT);}
	if(p==='type'){
		if(cat==='custom'){
			dao.getDistinctTypes('actl_type', cat).then(function(result){
				return res.json(result.map(t=>t.actl_type));
			});
		}else if(cat==='official'){
			dao.getDistinctTypes('owner', cat).then(function(result){
				return res.json(result.map(t=>t.owner));
			});
		}
	}else{
		res.json({status: 400, error: "Invalid request."});
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
					return res.json({status: 500, error: "File uploading error."});
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
	}).catch(function(){
		res.json({status: 500, error: "Add activity error."});
	});
});
app.post('/upload/editActl', uploadS3Activity, async function(req, res){
	let data = req.body;
	data.title = lib.removeEmojis(data.title);
	data.description = lib.removeEmojis(data.description);
	
	if(req.files.activity){
		data.main_img = req.files.activity[0].location;
		deleteOldImg('main_img', {actl_id: data.actl_id});
	}

	let result = await lib.processingLocation(data.address, data.lat, data.lng);
	if(result.address){data.address = result.address}
	if(result.location){
		data.lat = result.location.lat;
		data.lng = result.location.lng;
	}
	dao.updateData(data, {actl_id: data.actl_id}).then(function(){
		res.json({status: 200, data: data});
	}).catch(function(){
		res.json({status: 500, error: "Update activity error."});
	});

});
app.post('/upload/profile', uploadS3Profile, async function(req, res){
	let data = req.body;
	if(!data.user_id || data.user_id==='null')
		return res.json({status: 401, error: "User_id required."});
	if(data.filename != "profile")
		return res.json({status: 400, error: "Invalid field name."})
	
	let path = req.files.profile[0].location;
	deleteOldImg('profile_pic', {user_id: data.user_id});
	
	dao.updateUserData({profile_pic: path}, {user_id: data.user_id}).then(function(){
		res.json({status: 200, data: path});
	}).catch(function(){
		res.json({status: 500, error: "Update user data error."})
	});
});

app.post('/user/signin', async function(req, res){
	let {provider, email, password} = req.body;
	let access_expired = Date.now() + (cst.admin.TOKEN_EXPIRED_IN_SEC * 1000);
	let access_token = crypto.createHash('sha256').update(Date.now().toString()).digest('hex');
	let data = {};
	if(provider!='native' && provider!='facebook'){
		res.json({status: 400, error:"Invalid provider."});
	}
	if(provider === 'native'){
		let user = await dao.getUserData({
			provider: provider,
			email: email,
			password: crypto.createHmac('sha256', password+cst.auth.admin.pwsecret).digest('hex')
		});
		if(user.length!=1){
			return res.json({status: 401, erorr: "Invalid email or password."});
		}else{
			data = user[0];
			await dao.updateUserData({
				access_token: access_token,
				access_expired: access_expired
			}, {email: req.body.email});
		}
	}else if(provider === 'facebook'){
		let {access_token} = req.body;
		let fbUrl = `https://graph.facebook.com/me?fields=id,name,email,picture.width(300).height(300)&access_token=${access_token}`;
		request(fbUrl, async function(err, response, body){
			if(err){
				return res.json({status: 403, error: "Unable to get profile from Facebook."});
			}
			let resData = JSON.parse(body);
			let user = await dao.getUserData({
				provider: provider,
				name: resData.name,
				email: resData.email
			})
			if(user.length!=1){
				data = {
					user_id: lib.userIdGen(),
					provider: provider,
					name: resData.name,
					email: resData.email,
					icon: `icon/${lib.randomNoGen(96)}`,
					profile_pic: resData.picture.data.url,
					access_token: access_token,
				}
				await dao.insert('user', data);
			}else{
				data = user[0];
				await dao.updateUserData({
					access_token: access_token,
					profile_pic: data.profile_pic,
				}, {email: data.email});
			}
		});
	}
	let preference = await dao.getActivityData({user_id: data.user_id});	
	return res.json({
		status: 200,
		data:{
			user_id: data.user_id,
			provider: data.provider,
			name: data.name,
			email: data.email,
			icon: data.icon,
			profile_pic: data.profile_pic,
			access_token: access_token
		}, 
		preference: preference.map(function(u){
			return {
				actl_id: u.actl_id,
				status: u.status
			}
		})
	});
});
app.post('/user/signup', async function(req, res){
	let user = await dao.getUserData({email: req.body.email});
	if(user.length===1){
		return res.json({status: 409, erorr: "Duplicate email."});
	}
	let access_expired = Date.now() + (cst.admin.TOKEN_EXPIRED_IN_SEC * 1000);
	let access_token = crypto.createHash('sha256').update(Date.now().toString()).digest('hex');
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

	dao.insert('user', data).then(function(){
		res.json({
			status: 200, 
			data:{
				user_id: data.user_id,
				provider: data.provider,
				name: data.name,
				email: data.email,
				icon: data.icon,
				access_token: data.access_token
			}, 
			preference: []});
	}).catch(function(){
		res.json({status: 500, error: "Insert data error."});
	});
	
});
app.get('/user/profile', bearerToken, async function(req, res){
	let user = await dao.getUserData({access_token: req.token});
	if(user.length!=1){
		return res.json({status: 403, erorr: "Invalid token."});
	}
	let userActl = await dao.getActivityData({user_id: user[0].user_id});
	res.json({
		status: 200, 
		data:{
			user_id: user[0].user_id,
			provider: user[0].provider,
			name: user[0].name,
			email: user[0].email,
			icon: user[0].icon,
			profile_pic: user[0].profile_pic,
			access_token: user[0].access_token
		}, 
		preference: userActl.map(function(u){
			return {
				actl_id: u.actl_id,
				status: u.status
			}
		})
	});
});
app.get('/user/activities', function(req, res){
	dao.getUserActivities(req.query.actl_id).then(function(result){
		res.json(result);
	}).catch(function(){
		res.json({status: 500, error: "Database query error."})
	});
});
app.post('/user/status/:action', bearerToken, async function(req, res){
	let user = await dao.getUserData({access_token: req.token});
	if(user.length!=1){
		return res.json({status: 403, erorr: "Invalid token."});
	}
	let {action} = req.params;
	let actl_id = req.body.actl_id;
	let status = '';
	let user_id = user[0].user_id;
	if(action==='like'||action==='liked'){status = 'liked';}
	if(action==='join'||action==='joined'){status = 'joined';}
	if(action==='hold'||action==='held'){status = 'held';}
	if(status!='liked' && status!='joined' && status!='held'){
		return res.json({status: 400, error: "Invalid request."});
	}
	
	let actlData = await dao.getActivityData({
		user_id: user_id,
		actl_id: actl_id,
		status: status
	});
	if(actlData.length===0){
		dao.insert('activity', {
			actl_id: actl_id,
			user_id: user_id,
			status: status
		}).then(function(){
			return res.json({status: 200, message: 'added'});
		}).catch(function(){
			return res.json({status: 500, error: "Insert data error."});
		});
	}else{
		if(status==='held'){
			dao.delete('data', {actl_id: actl_id}).then(function(){
				return res.json({status: 200, message: 'removed'});
			}).catch(function(){
				return res.json({status: 500, error: "Remove data error."})
			});
		}else{
			dao.delete('activity', {
				actl_id: actl_id,
				user_id: user_id,
				status: status
			}).then(function(){
				res.json({status: 200, message: 'removed'});
			}).catch(function(){
				res.json({status: 500, error: "Remove data error."})
			});
		}
	}
});
app.post('/user/update/profile', bearerToken, async function(req, res){
	let user = await dao.getUserData({access_token: req.token});
	if(user.length!=1){
		return res.json({status: 403, erorr: "Invalid token."});
	}
	dao.updateUserData(req.body, {user_id: user[0].user_id}).then(function(){
		res.json({status: 200, message: 'updated'});
	}).catch(function(){	
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
	req.query.listing = listing;
	if(mode==='id'){
		let lastResult = await redis.get(`${id_token}:lastResult`).then(r=>JSON.parse(r));
		if(!lastResult){return next();}
		let data = lastResult.filter(r=>r.actl_id===actl_id);
		if(data.length!=1){return next();}
		console.log('Get data from memory.');
		return res.json({
			status: 200,
			data: data, 
			info:{
				entries: data.length,
				listing: listing,
				paging: paging,
				pageCount: cst.admin.PAGE_COUNT,
				query: req.query
			}});
	}else{
		let filter = `${center},${dist},${cat},${owner},${type}`;
		let lastFilter = await redis.get(`${id_token}:lastFilter`);
		if(filter!=lastFilter){return next();}
		console.log('Get data from memory.');
		let lastResult = await redis.get(`${id_token}:lastResult`).then(r=>JSON.parse(r));
		if(!lastResult){return next();}
		return res.json({
			status: 200,
			data: lastResult.slice(paging*listing, (paging+1)*listing), 
			info:{
				entries: lastResult.length,
				listing: listing,
				paging: paging,
				pageCount: cst.admin.PAGE_COUNT,
				query: req.query
			}});
	}
}
async function deleteOldImg(field, reference){
	let oldPath = await dao.getImgPath(field, reference);
	if(oldPath[0][field]){
		let params = {Bucket: cst.admin.BUCKET_NAME, Delete: {Objects:[{Key: oldPath[0][field].split(cst.admin.S3_BUCKET)[1]}]}};
		s3.deleteObjects(params, function(err, data){
			if(err){console.log(err, err.stack);}
			else{console.log(data);}
		});
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

function errMsg(err){
    console.log(err);
}

app.listen(cst.auth.admin.port, () => {
	console.log(`My application is running on port ${cst.auth.admin.port}!`)
});

module.exports=app;