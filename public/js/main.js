// -- User -- //
function signin(){
    let body = JSON.stringify({
        provider: 'native',
        email: document.getElementById('sign-in-email').value,
        password: document.getElementById('sign-in-password').value
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
        if(result.error){
            document.querySelector('.alert-text').style.display = "flex";
            document.querySelector('.alert-text').innerHTML = "Email or password does not match!";
            clearS(['#sign-in-password']);
        }else{
            clearS(['#sign-in-password']);
            switchElementView('#modal-sign-form', 'none');
            alertBox("登入成功！").then(function(){
                setUserData(result);
                switchProfileIcon('show');
            })
        }
    }).catch(function(err){
        console.log(err)
        alertBox("登入錯誤，請稍後再試。")
    });
}
function signup(){
    let name = document.getElementById('sign-up-name').value;
    let email = document.getElementById('sign-up-email').value;
    let password = document.getElementById('sign-up-password').value;
    let password2 = document.getElementById('sign-up-password-2').value;
    let errMsg = signUpErrMsg(name, email, password, password2); // test snippet
    // let errMsg = false; // test snippet

    if(errMsg){
        document.querySelector('.alert-text').style.display = "flex";
        document.querySelector('.alert-text').innerHTML = errMsg;
        clearS(['#sign-up-password', '#sign-up-password-2']);
    }else{
        clearS(['#sign-up-password', '#sign-up-password-2']);
        document.querySelector('.alert-text').style.display = "hidden";
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
            if(!result.error){
                switchElementView('#modal-sign-form', 'none');
                localStorage.setItem('access_token', result.data.access_token); 
                localStorage.setItem('user_id', result.data.user_id);
                alertBox("建立帳戶成功！").then(function(){
                    setUserData(result);
                    switchProfileIcon('show');
                })
            }else{
                alertBox("此帳號已註冊。");
            }
        });
    }
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
        console.log('Logged in and authenticated');
    }else{
        console.log('Not authenticated');
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
        if(result.error){
            document.querySelector('.alert-text').style.display = "flex";
            document.querySelector('.alert-text').innerHTML = "登入錯誤，請稍後再試。";
            switchElementView('#modal-sign-form', 'none');
        }else{
            switchElementView('#modal-sign-form', 'none');
            setUserData(result);
            alertBox("登入成功！").then(function(){
                switchProfileIcon('show');
            })
        }
    });
}
// -- Upload -- //
function uploadImage(file, data){
    let formData = new FormData();
    formData.append('profile', file, 'profile_pic');
    for(let name in data){
        formData.append(name, data[name]);
    }
    return fetch('/upload/profile', {
        method: 'POST',
        body: formData
    }).then(function(result){
        return result.json();
    }).catch(function(error){
        console.log(error);
    });
}
function updateActivityData(file, data, action){
    let formData = new FormData();
    if(file.length!=0){formData.append('activity', file, 'main_img');}
    for(let name in data){
        formData.append(name, data[name]);
    }
    let router = action==='add' ? 'addActl' : 'editActl';
    return fetch(`/upload/${router}`, {
        method: 'POST',
        body: formData
    }).then(function(response){
        return response.json();
    }).catch(function(error){
        console.log(error);
    });
}
// -- Main -- //
function getCategory(){
    return fetch('/get/list/category').then(r=>r.json());
}
function getType(cat){
    return fetch(`/get/list/type?cat=${cat}`).then(r=>r.json());
}
function getActivityData(mode, prop){
    let query = '';
    if(mode==='all'){
        misc.lastSearch = `/filter/f?cat=${prop.cat}&center=${prop.center}&dist=${prop.dist}&type=${prop.type}&owner=${prop.owner}&listing=${prop.listing}&paging=${prop.paging}`;
        query = misc.lastSearch;
    }else if(mode==='id'){
        query = `/filter/f?actl_id=${id}`;
    }
    return fetch(query).then(r=>r.json());
}
///////// testing 
function getActivityWithPrefs(id){
    return fetch(`/get/activity/?actl_id=${misc.editingActivityId}`).then(r=>r.json());
}
/////////
// -- Activity -- //
function generateActivityPlanner(){
    let container = getElement('.activity-planner-container');
    container.innerHTML='';
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
        input: selectType
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
    }}, document.querySelector('.modal-map'));
    
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
            owner: localStorage.getItem('user_id'),
            title: title.value,
            actl_type: type.value,
            address: mode==="choose" ? null : place.value,
            t_start: startTime.value,
            t_end: endTime.value,
            description: description.value
        }}
    );
}
function createActivity(){
    let input = checkActivityInput();
    if(!input){return;}
    switchElementView('#modal-loading', 'flex');
    updateActivityData(input.file, input.data, 'add').then(async function(result){
        switchElementView('#modal-loading', 'none');
        switch(result.status){
            case 200:
                updatePreference(result.data.actl_id, 'held', 'add');
                await alertBox("成功建立活動！");
                switchElementView('#modal-activity-planner', 'none');
                let status = await alertBox("顯示剛剛建立的活動？", 'showCancel');
                if(status===true){renderMainView('id', result.data.actl_id);}
                break;
            case 500:
                await alertBox("建立活動失敗，請稍後再試。");
                switchElementView('#modal-activity-planner', 'none');
                break;
        }
    });
}
async function editActivity(){
    let input = checkActivityInput();
    if(!input){return;}
    switchElementView('#modal-loading', 'flex');
    let actl_id = misc.editingActivityId;
    input.data.actl_id = actl_id;
    updateActivityData(input.file, input.data, 'edit').then(async function(result){
        switchElementView('#modal-loading', 'none');
        switch(result.status){
            case 200:
                await alertBox("成功編輯活動！");
                getElement(`#held-${actl_id}-title`).innerHTML = result.data.title;
                getElement(`#held-${actl_id}-time`).innerHTML = timeFormatter(result.data.t_start, 'md', 'hm');
                switchElementView('#modal-activity-planner', 'none');
                break;
            case 500:
                await alertBox("編輯活動失敗，請稍後再試。");
                switchElementView('#modal-activity-planner', 'none');
                break;
        }
    });
}
function showActivityContent(event, id){
    if(event){id = event.target.id.split('-')[1]}
    if(id){
        fetch(`/get/activity?actl_id=${id}`)
            .then(function(response){
                return response.json();
            }).then(function(result){
                renderActivityContent(result);
                switchElementView('#modal-activity-content', 'flex');
            }).catch(function(error){
                console.log(error);
                alertBox("沒有更多詳細資訊可以顯示。");
            })
    }else{
        alertBox("沒有更多詳細資訊可以顯示。");
    }
}
function actOnActivity(event, callback){
    let action = event.target.id.split('-')[0];
    let actl_id = event.target.id.split('-')[1];
    if(actl_id){
        let access_token = localStorage.getItem('access_token');
        if(!access_token){
            alertBox("請先登入會員！")
        }else{
            let headers = {
                'Authorization':`Bearer ${access_token}`,
                'Content-Type':'application/json'
            };
            let body = JSON.stringify({
                actl_id: actl_id
            });
            fetch(`/user/status/${action}`, {
                method: "POST",
                headers: headers,
                body: body
            }).then(function(response){
                return response.json()
            }).then(function(result){
                if(result.error){
                    alertBox("系統繁忙，請稍後再試。");
                }else{
                    if(result.message==='added'){
                        updatePreference(actl_id, action, 'add');
                    }else if(result.message==='removed'){
                        updatePreference(actl_id, action, 'delete');
                    }
                    callback(event, result);
                }
            }); 
        }
    }else{
        // error handling
    }
}

// -- Misc -- //
function requestUserData(){
    let access_token = localStorage.getItem('access_token');
    let provider = localStorage.getItem('provider');
    return new Promise(function(resolve, reject){
        if(access_token){
            fetch(`/user/profile?provider=${provider}`, {
                headers: {
                    'Authorization':`Bearer ${access_token}`,
                    'Content-Type':'application/json'
                }
            }).then(function(response){
                return response.json();
            }).then(function(result){
                if(result.error) reject(result.error);
                else resolve(result);
            }).catch(function(err){
                console.log(err);
                reject({error: "Fetching data error."})
            });
        }else{
            reject({error: "No access_token found."});
        }
    })
}