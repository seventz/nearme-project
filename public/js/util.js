// -- Global Variables -- //
const main = {
    map: null,
    dynMarker: null,
    pointerMarker: null,
    markers: [],
    bounds: null,
    currentLocation: {
        lat: null,
        lng: null
    },
    defaultCenter: {
        lat: 25.041,
        lng: 121.541
    },
    listener: null
}

const modal = {
    map: null,
    opened: false,
    marker: null,
    location: {
        lat: null,
        lng: null
    }
}

const misc = {
    lastSearch: '',
    cat:{
        custom: "使用者活動",
        official: "官方活動"
    },
    customType: [],
    startTimePicker: {},
    endTimePicker: {},
    editingActivityId: '',
    searchActivityId: '',
    currentTab: null,
    keywordCount: 1,
    statusChange: false,
    user: {},
    idToken: '',
    enterListener: null
}
function getElement(selector){
    return document.querySelector(selector);
}
function getElementAll(selector){
    return document.querySelectorAll(selector);
}
function removeChildOf(selector){
    return document.querySelector(selector).innerHTML = "";
}
function switchElementView(selector, status){
    return document.querySelector(selector).style.display = status;
}
function createElement(tagName, settings, parentElement){
	let obj=document.createElement(tagName);
	if(settings.atrs){setAttributes(obj, settings.atrs);}
	if(settings.stys){setStyles(obj, settings.stys);}
	if(settings.evts){setEventHandlers(obj, settings.evts);}
	if(parentElement instanceof Element){parentElement.appendChild(obj);}
	return obj;
};
function modifyElement(obj, settings, parentElement){
	if(settings.atrs){setAttributes(obj, settings.atrs);}
	if(settings.stys){setStyles(obj, settings.stys);}
	if(settings.evts){setEventHandlers(obj, settings.evts);}
	if(parentElement instanceof Element&&parentElement!==obj.parentNode){
		parentElement.appendChild(obj);
	}
	return obj;
};
function setStyles(obj,styles){
	for(let name in styles){
		obj.style[name]=styles[name];
	}
	return obj;
};
function setAttributes(obj,attributes){
	for(let name in attributes){
		obj[name]=attributes[name];
	}
	return obj;
};
function setEventHandlers(obj,eventHandlers,useCapture){
	for(let name in eventHandlers){
		if(eventHandlers[name] instanceof Array){
			for(let i=0;i<eventHandlers[name].length;i++){
				obj.addEventListener(name,eventHandlers[name][i],useCapture);
			}
		}else{
			obj.addEventListener(name,eventHandlers[name],useCapture);
		}
	}
	return obj;
};

// Load FB SDK
(function(d, s, id){
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) {return;}
    js = d.createElement(s); js.id = id;
    js.src = "https://connect.facebook.net/en_US/sdk.js";
    fjs.parentNode.insertBefore(js, fjs);
}(document, 'script', 'facebook-jssdk'));

function importJS(){
    let documentHead = document.getElementsByTagName("head")[0];
    // createElement('SCRIPT', {atrs:{
    //     type: "text/javascript",
    //     src: "js/googlemap/markerclusterer.js"
    // }}, documentHead);
    createElement('SCRIPT', {atrs:{
        src: "js/main.js"
    }}, documentHead);
    createElement('SCRIPT', {atrs:{
        src: "js/index.js"
    }}, documentHead);
    createElement('SCRIPT', {atrs:{
        src: "js/map.js"
    }}, documentHead);
}