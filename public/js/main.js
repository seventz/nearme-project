// -- User -- //
function signin(){
    let body = JSON.stringify({
        provider: 'native',
        email: getElement('#sign-in-email').value,
        password: getElement('#sign-in-password').value
    });
    fetch("/user/signin", {
        method: "POST",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: body
    }).then(function(response){
        return response.json();
    }).then(function(result){
        clearValue(['#sign-in-password']);
        switch(result.status){
            case 200:
                switchElementView('#modal-sign-form', 'none');
                alertBox("登入成功！").then(function(){
                    setUserData(result);
                    switchProfileIcon('show');
                });
                break;
            case 400:
                alertBox("請求格式錯誤。");
                break;
            case 403:
                switchElementView('.alert-text', 'flex');
                getElement('.alert-text').innerHTML = "帳號或密碼錯誤。";
                break;
            case 500:
                alertBox("無法取得資料，請稍後再試。");
                break;
        }
    }).catch(function(){
        alertBox("登入錯誤，請稍後再試。")
    });
}
function signup(){
    let name = getElement('#sign-up-name').value;
    let email = getElement('#sign-up-email').value;
    let password = getElement('#sign-up-password').value;
    let password2 = getElement('#sign-up-password-2').value;
    let errMsg = signUpErrMsg(name, email, password, password2);

    if(errMsg){
        switchElementView('.alert-text', 'flex');
        getElement('.alert-text').innerHTML = errMsg;
        clearValue(['#sign-up-password', '#sign-up-password-2']);
        return;
    }
    switchElementView('.alert-text', 'hidden');
    let body = JSON.stringify({
        provider: 'native',
        name: name,
        email: email,
        password: password
    });
    fetch("/user/signup", {
        method: "POST",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: body
    }).then(function(response){
        return response.json();
    }).then(function(result){
        clearValue(['#sign-up-password', '#sign-up-password-2']);
        switch(result.status){
            case 200:
                switchElementView('#modal-sign-form', 'none');
                localStorage.setItem('access_token', result.data.access_token); 
                alertBox("建立帳戶成功！").then(function(){
                    setUserData(result);
                    switchProfileIcon('show');
                });
                break;
            case 409:
                alertBox("此 Email 帳戶已被註冊，請嘗試其他帳戶！");
                break;
            case 500:
                alertBox("系統繁忙，請稍後再試。");
                break;
        }
    }).catch(function(){
        alertBox("註冊帳號錯誤，請稍後再試。")
    });
}

// -- FB -- //
function fbInit(){
    FB.init({
    appId      : '534473647313246',
    cookie     : true,
    xfbml      : true,
    version    : 'v4.0'
    });
    
    FB.getLoginStatus(function(response){
        fbLoginStatusChange(response);
    });
    FB.AppEvents.logPageView();
};
function fbLoginStatusChange(response){
    if(response.status === 'connected'){
        let fbToken = response.authResponse.accessToken;
        fbSignin(fbToken);
    }
}
function fbLogin(){
    FB.login(function(response){
		fbLoginStatusChange(response);
    },{scope: "public_profile,email"});
}
function fbSignin(access_token){
    let body = JSON.stringify({
        provider: 'facebook',
        access_token: access_token
    });
    fetch("/user/signin", {
        method: "POST",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: body
    }).then(function(response){
        return response.json();
    }).then(function(result){
        switch(result.status){
            case 200:
                switchElementView('#modal-sign-form', 'none');
                alertBox("登入成功！").then(function(){
                    setUserData(result);
                    switchProfileIcon('show');
                });
                break;
            case 400:
                alertBox("請求格式錯誤。");
                break;
            case 403:
                alertBox("無法取得資料，請稍後再試。");
                break;
        }
    }).catch(function(){
        alertBox("登入錯誤，請稍後再試。")
    });
}
// -- Upload -- //
function uploadProfileImage(file, data){
    return new Promise(function(resolve, reject){
        let formData = new FormData();
        formData.append('profile', file, 'profile_pic');
        for(let name in data){
            formData.append(name, data[name]);
        }
        fetch('/upload/profile', {
            method: 'POST',
            body: formData
        }).then(function(result){
            return result.json();
        }).then(function(result){
            switch(result.status){
                case 200:
                    resolve(result);
                    break;
                case 400: case 401:
                    reject(result);
                    break;
            }
        }).catch(function(){
            reject({status: 503, error: "Server busy."})
        });
    })
}
// -- Main -- //
function getCategory(){
    return fetch('/get/list/category').then(r=>r.json());
}
function getType(cat){
    return fetch(`/get/list/type?cat=${cat}`).then(r=>r.json());
}
function getActivityData(mode, prop){
    let queryArr = [], query = '';
    let options = {headers: {'id_token': localStorage.getItem('id_token')}};
    if(mode==='all'){
        if(typeof prop === "string"){
            query = prop;
        }else{
            for(let name in prop){queryArr.push(`${name}=${prop[name]}`);}
            query = `/filter/${mode}?${queryArr.join('&')}`;
        }
        misc.lastSearch = query; // => Store the last search query
    }else if(mode==='id'){
        query = `/filter/${mode}?actl_id=${prop}`;
    }
    return fetch(query, options).then(r=>r.json());
}
function getUserActivities(ids){
    return fetch(`/user/activities?actl_id=${ids}`).then(r=>r.json());
}
function getActivityDetail(id){
    return fetch(`/get/activity/?actl_id=${id}`).then(r=>r.json());
}
// -- Search -- //
function realtimeSearch(){
    let words = getElement('#search-main').value;
    let list = getElement('#search-main-items');

    if(words.length===0){return removeChildOf('#search-main-items');}
    // Not include bopomofo
    let newWords = words.replace(/[\u3100-\u312F]/g, '');
    newWords = newWords.replace(/([\"\'\&\@\#\$\%\^\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g, "");
    if(words.length === newWords.length){
        let options = {
            method: "GET",
            headers: {id_token: localStorage.getItem('id_token')}
        }
        fetch(`/search/title/realtime?words=${newWords}`, options)
            .then(function(response){
                return response.json();
            }).then(function(result){
                removeChildOf('#search-main-items');
                result.forEach(function(r){
                    createElement('DIV', {atrs:{
                        id: `search-${r.actl_id}`,
                        textContent: r.title
                    }}, list);
                    getElement(`#search-${r.actl_id}`).addEventListener('mouseover', function(){
                        getElement('#search-main').value = this.textContent;
                        misc.searchActivityId = r.actl_id;
                    });
                });
            });
    }
    addClickResetListener('#search-main-items');
}
function keywordSearch(){
    let words = getElement('#search-main').value;
    let searchList = getElement('#search-main-items');
    if(words.length===0){return removeChildOf('#search-main-items');}

    let fragments = words.replace(/([\"\ \'\&\@\#\$\%\^\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g, ",");
    let fragmentsLength = fragments.split(',').length;
    if(fragmentsLength!=misc.keywordCount){
        // record current keyword counts
        misc.keywordCount = fragmentsLength;
        let options = {
            method: "GET",
            headers: {id_token: localStorage.getItem('id_token')}
        }
        fetch(`/search/title/keywords?words=${fragments}`, options).then(function(response){
            return response.json();
        }).then(function(result){
            removeChildOf('#search-main-items');
            result.forEach(function(r){
                createElement('DIV', {atrs:{
                    id: `search-${r.actl_id}`,
                    textContent: r.title
                }}, searchList);
                getElement(`#search-${r.actl_id}`).addEventListener('mouseover', function(){
                    getElement('#search-main').value = this.textContent;
                    misc.searchActivityId = r.actl_id;
                });
            })
        })
    }
    addClickResetListener('#search-main-items');
}
// -- Activity -- //
function generateActivityPlanner(){
    let container = getElement('.activity-planner-container');
    removeChildOf('.activity-planner-container');
    createElement('DIV', {atrs:{
        id: 'close-modal-host-activity',
        className: 'close',
        textContent: '+'
    }, evts:{
        click: closeActivityPlanner
    }}, container);
    let title = createElement('DIV', {atrs:{
        className: 'activity-title',
    }}, container);
    createElement('P', {atrs:{
        textContent: '建立活動'
    }}, title);
    let main = createElement('DIV', {atrs:{
        className: 'activity-main',
    }}, container);
    
    let sub = createElement('DIV', {atrs:{
        className: 'activity-sub',
    }}, main);
    let section = createElement('DIV', {atrs:{
        className: 'form-section',
    }}, sub);
    createElement('DIV', {atrs:{textContent: '主題:'}}, section);
    let sectionRight = createElement('DIV', {atrs:{className: 'section-right'}}, section);
    createElement('INPUT', {atrs:{
        id: 'actl-u-title',
        className: 'input-effect',
        type: 'text',
        placeholder: "Title"
    }}, sectionRight);
    section = createElement('DIV', {atrs:{
        className: 'form-section',
    }}, sub);
    createElement('DIV', {atrs:{
        textContent: '類型:'
    }}, section);
    let autocomplete = createElement('DIV', {atrs:{
        className: 'autocomplete',
    }}, section);
    createElement('INPUT', {atrs:{
        id: 'actl-u-type',
        className: 'input-effect search-box',
        type: 'text',
        placeholder: "Type"
    }, evts:{
        input: autoCompleteType
    }}, autocomplete);
    createElement('DIV', {atrs:{
        id: 'activity-planner-type',
        className: 'autocomplete-items',
    }}, autocomplete);
    section = createElement('DIV', {atrs:{
        className: 'form-section',
    }}, sub);
    createElement('DIV', {atrs:{
        textContent: '開始時間:'
    }}, section);
    sectionRight = createElement('DIV', {atrs:{className: 'section-right'}}, section);
    createElement('INPUT', {atrs:{
        id: 'actl-u-t_start',
        className: 'input-effect',
        readOnly: 'realonly',
        placeholder: "Start Time"
    }}, sectionRight);
    section = createElement('DIV', {atrs:{
        className: 'form-section',
    }}, sub);
    createElement('DIV', {atrs:{
        textContent: '結束時間:'
    }}, section);
    sectionRight = createElement('DIV', {atrs:{className: 'section-right'}}, section);
    createElement('INPUT', {atrs:{
        id: 'actl-u-t_end',
        className: 'input-effect',
        readOnly: 'realonly',
        placeholder: "End Time"
    }}, sectionRight);
    section = createElement('DIV', {atrs:{
        className: 'form-section',
    }}, sub);
    createElement('DIV', {atrs:{
        textContent: '詳細敘述:'
    }}, section);
    sectionRight = createElement('DIV', {atrs:{className: 'section-right'}}, section);
    createElement('TEXTAREA', {atrs:{
        id: 'actl-u-description',
        className: 'form-control',
        rows: 5,
        placeholder: "Type some description..."
    }}, sectionRight);

    
    sub = createElement('DIV', {atrs:{
        className: 'activity-sub',
    }}, main);
    section = createElement('DIV', {atrs:{
        className: 'form-section',
    }}, sub);
    createElement('DIV', {atrs:{
        id: 'mode-hint',
        textContent: '選擇地點:'
    }}, section);
    let locationDiv = createElement('DIV', {atrs:{
        className: 'flex-r',
    }}, section);
    createElement('INPUT', {atrs:{
        id: 'actl-u-place',
        className: 'input-effect choose-mode',
        type: 'text',
        placeholder: "Choose on map",
        readOnly: 'realonly'
    }}, locationDiv);
    createElement('BUTTON', {atrs:{
        className: 'btn btn-altered',
        textContent: '切換模式'
    }, stys: {
        minWidth: '100px'
    }, evts:{
        click: switchMapMode
    }}, locationDiv);
    createElement('DIV', {atrs:{
        className: 'modal-map',
    }}, sub);
    section = createElement('DIV', {atrs:{
        id: 'map-modal'
    }}, getElement('.modal-map'));
    
    section = createElement('DIV', {atrs:{
        className: 'flex-r-st',
    }, stys: {
        margin: '10px'
    }}, sub);
    let uploadWrapper = createElement('DIV', {atrs:{
        className: 'upload-wrapper',
    }}, section);
    createElement('BUTTON', {atrs:{
        className: 'btn btn-altered',
        textContent: '上傳照片'
    }}, uploadWrapper);
    let inputUpload = createElement('INPUT', {atrs:{
        id:'actl-u-file',
        type: 'file'
    }}, uploadWrapper);
    createElement('DIV', {atrs:{
        id: 'upload-file-tip',
    }}, section);
    let last = createElement('DIV', {atrs:{
        className: 'activity-footer flex-r-c'
    }}, container);
    createElement('BUTTON', {atrs:{
        id: 'create-activity',
        className: 'btn btn-submit',
        textContent: '確定'
    }, evts:{
        click: createActivity
    }}, last);
    
    inputUpload.addEventListener('change', function(){
        let textTip = getElement('#upload-file-tip');
        let imgObj = checkImageType('#actl-u-file');
        if(imgObj.status===false){
            textTip.innerHTML = '請上傳圖片檔: (jpg / jpeg / png / gif)';
            textTip.style.color = 'red';
            return;
        }
        if(imgObj.data.name){
            textTip.innerHTML = `選擇了一個檔案: ${imgObj.data.name}`;
            textTip.style.color = 'black';
            return;
        }
    });
    getType('custom').then(data=>misc.customType=data);
    initDateTimePicker();
    initModalMap();
}
function generateActivityEditor(actl_id){
    generateActivityPlanner();
    getElement('.activity-title>p').textContent = "編輯活動";
    getActivityData('id', actl_id).then(function(result){
        if(result.data.length===0){return alertBox("沒有內容可以顯示。");}
        let data = result.data[0];
        getElement("#actl-u-title").value = data.title;
        getElement("#actl-u-type").value = data.actl_type;
        getElement("#actl-u-place").value = `${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}`;
        getElement("#actl-u-t_start").value = timeFormatter(data.t_start, 'ymd', 'hm');
        getElement("#actl-u-t_end").value = timeFormatter(data.t_end, 'ymd', 'hm');
        getElement("#actl-u-description").value = data.description;
        getElement("#create-activity").removeEventListener('click', createActivity);
        getElement("#create-activity").addEventListener('click', function(){
            editActivity(actl_id);
        });
        switchElementView('#modal-activity-planner', 'flex');
    });
}
function checkActivityInput(){
    let title = getElement("#actl-u-title");
    let type = getElement("#actl-u-type");
    let place = getElement("#actl-u-place");
    let description = getElement("#actl-u-description");
    let startTime = getElement("#actl-u-t_start");
    let endTime = getElement("#actl-u-t_end");
    let imgObj = checkImageType("#actl-u-file");

    // Logic for all fields filled
    if(!title.value){return title.focus();}
    if(!type.value){return type.focus();}
    if(!place.value){return place.focus();}
    if(!description.value){return description.focus();}
    if(!startTime.value){return startTime.focus();}
    if(!endTime.value){return endTime.focus();}
    if(startTime.dataset.value>=endTime.dataset.value){return endTime.focus();}
    if(imgObj.status===false){return;}

    let mode = place.className.includes("choose-mode") ? "choose" : "input";

    return({
        file: imgObj.data,
        data:{
            lat: mode==="choose" ? place.value.split(',')[0] : null,
            lng: mode==="choose" ? place.value.split(',')[1] : null,
            owner: misc.user.data.user_id,
            title: title.value,
            actl_type: type.value,
            address: mode==="choose" ? null : place.value,
            t_start: startTime.value,
            t_end: endTime.value,
            description: description.value
        }}
    );
}
function showActivityContent(event, id){
    if(event){id = event.target.id.split('-')[1]}
    if(!id){return alertBox("沒有更多詳細資訊可以顯示。");}
    getActivityDetail(id).then(function(result){
        switch(result.status){
            case 200:
                renderActivityContent(result);
                switchElementView('#modal-activity-content', 'flex');
                break;
            case 500:
                alertBox("系統錯誤，請稍後再試。");
                break;
        }
    });
}
function createActivity(){
    let input = checkActivityInput();
    if(!input){return;}
    switchElementView('#modal-loading', 'flex');
    updateActivityData(input.file, input.data, 'add').then(async function(result){
        triggerStatusChange();
        switchElementView('#modal-loading', 'none');
        updatePreference(result.data.actl_id, 'held', 'add');
        await alertBox("成功建立活動！");
        switchElementView('#modal-activity-planner', 'none');
        let status = await alertBox("顯示剛剛建立的活動？", 'showCancel');
        if(status===true){renderMainView('id', result.data.actl_id);}
    }).catch(async function(result){
        switchElementView('#modal-loading', 'none');
        await alertBox("建立活動失敗，請稍後再試。");
        switchElementView('#modal-activity-planner', 'none');
    });
}
function editActivity(actl_id){
    let input = checkActivityInput();
    if(!input){return;}
    input.data.actl_id = actl_id;
    switchElementView('#modal-loading', 'flex');
    updateActivityData(input.file, input.data, 'edit').then(async function(result){
        triggerStatusChange();
        switchElementView('#modal-loading', 'none');
        await alertBox("成功編輯活動！");
        getElement(`#held-${actl_id}-title`).innerHTML = result.data.title;
        getElement(`#held-${actl_id}-time`).innerHTML = result.data.t_start.substring(5);
        switchElementView('#modal-activity-planner', 'none');
    }).catch(async function(result){
        switchElementView('#modal-loading', 'none');
        await alertBox("編輯活動失敗，請稍後再試。");
        switchElementView('#modal-activity-planner', 'none');
    });
}
function updateActivityData(file, data, action){
    return new Promise(function(resolve, reject){
        let formData = new FormData();
        if(file.length!=0){formData.append('activity', file, 'main_img');}
        for(let name in data){
            formData.append(name, data[name]);
        }
        let router = action==='add' ? 'addActl' : 'editActl';
        fetch(`/upload/${router}`, {
            method: 'POST',
            body: formData
        }).then(function(response){
            return response.json();
        }).then(function(result){
            switch(result.status){
                case 200:
                    resolve(result);
                    break;
                case 500:
                    reject(result);
                    break;
            }
        });
    });
}
function updateActivityStatus(actl_id, action){
    return new Promise(function(resolve, reject){
        let headers = {
            'Authorization':`Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type':'application/json'
        };
        fetch(`/user/status/${action}`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({actl_id: actl_id})
        }).then(function(response){
            return response.json();
        }).then(function(result){
            switch(result.status){
                case 200:
                    resolve(result);
                    break;
                case 400: case 401: case 403: case 500:
                    reject(result);
                    break;
            }
        });
    });
}
function updateUserData(data){
    return new Promise(function(resolve, reject){
        fetch(`/user/update/profile`, {
            method: "POST",
            headers: {
                'Authorization':`Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type':'application/json'
            },
            body: JSON.stringify(data)
        }).then(function(response){
            return response.json();
        }).then(function(result){
            switch(result.status){
                case 200:
                    resolve(result);
                    break;
                case 500:
                    reject(result);
                    break;
            }
        });
    })
}
// -- Misc -- //
function requestUserData(){
    let access_token = localStorage.getItem('access_token');
    let provider = localStorage.getItem('provider');
    return new Promise(function(resolve, reject){
        fetch(`/user/profile?provider=${provider}`, {
            headers: {
                'Authorization':`Bearer ${access_token}`,
                'Content-Type':'application/json'
            }
        }).then(function(response){
            return response.json();
        }).then(function(result){
            switch(result.status){
                case 200:
                    resolve(result);
                    break;
                case 400: case 401: case 403:
                    reject(result);
                    break;
            }
        }).catch(function(err){
            reject({status: 500, error: "Fetching data error."})
        });
    })
}
