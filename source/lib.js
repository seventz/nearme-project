const crypto = require('crypto');
const cst = require('./constants');

const googleMapsClient = require('@google/maps').createClient({
    key: cst.auth.googlemap.APIKEY,
    Promise: Promise
});

function removeEmojis(str){
    if(!str) return '';
    let regex = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|[\ud83c[\ude50\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g;
    return str.replace(regex, '');
}
function activityIdGen(){
	return crypto.randomBytes(8).toString('hex');
}

function randomNoGen(upper){
	return Math.floor(Math.random()*parseInt(upper));
}

function userIdGen(){
	let randNum = Math.floor((1 + Math.random()) * 10E13);
	let numStr = (randNum).toString().slice(1);
	return numStr;
}

function getLocalISOTime(){
	let tzOffset = (new Date()).getTimezoneOffset() * 60000;
	let localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, -1);
	return localISOTime;
}

function delay(timeout){
    return new Promise(function(resolve){
        setTimeout(resolve, timeout);
    });
}

function geocodeBuffer(address){
    return new Promise(function(resolve, reject){
        googleMapsClient.geocode({
            address: address
        }, function(err, response) {
            if(err) reject(err);
            else resolve(response.json.results[0].geometry.location);
        });
    });
}

function reverseGeocodeBuffer(lat, lng){
    return new Promise(function(resolve, reject){
        googleMapsClient.reverseGeocode({
            'latlng': {lat, lng}
        }, function(err, response) {
            if(err) reject(err);
            else resolve(response.json.results[0].formatted_address);
        });
    });
}

function processingLocation(address, lat, lng){
	return new Promise(function(resolve, reject){
		if(address==='null'){
			// Reverse geocoding //
			reverseGeocodeBuffer(lat, lng).then(function(address){
				resolve({address: address});
			}).catch(err=>console.log(err));
		}else if(lat==='null' && lng==='null'){
			// Geocoding // 
			geocodeBuffer(address).then(function(location){
				resolve({location: {
					lat: location.lat,
					lng: location.lng
				}});
			}).catch(err=>console.log(err));
		}
	})
}

module.exports={
    removeEmojis: removeEmojis,
    activityIdGen: activityIdGen,
    randomNoGen: randomNoGen,
    userIdGen: userIdGen,
    getLocalISOTime: getLocalISOTime,
    delay: delay,
    geocodeBuffer: geocodeBuffer,
    reverseGeocodeBuffer: reverseGeocodeBuffer,
    processingLocation: processingLocation
};