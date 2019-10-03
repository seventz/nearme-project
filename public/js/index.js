// -- Initialize -- //
function init(){
    // document.getElementById('loading').style.display = 'none';
    initUrl();
    initListeners();
    loadMap();
    initPage();
    window.fbAsyncInit = fbInit;
    
    window.onpopstate = function(event){
        console.log(event.state)
        console.log("history changed to: " + document.location.href);
    }
}
if(document.readyState !== "loading"){init();}
else{document.addEventListener("DOMContentLoaded", init);}
// -- Main -- //
function initPage(){
    initVisitedStatus();
    initModalSection();
    initFilters();
    initProfileIcon();
    initMap();
    initActivityList();
}
function initUrl(){
    let urlParams = new URLSearchParams(window.location.search);
    let eventId = urlParams.get('event')
    if(eventId){showActivityContent(null, eventId);}
}
function initVisitedStatus(){
    if(localStorage.getItem('visited') < Date.now()){
        switchElementView('.main', 'none');
        switchElementView('.bg-landing', 'block');
        localStorage.setItem('visited', (new Date).setTime((new Date).getTime()+1000*60*60))
    }else{
        switchElementView('.main', 'contents');
    }
}
function initModalSection(){
    switchElementView('#modal-alert', 'none');
    switchElementView('#modal-activity-planner', 'none');
    switchElementView('#modal-sign-form', 'none');
    switchElementView('#modal-profile', 'none');
    switchElementView('#modal-activity-content', 'none');
    switchElementView('#modal-loading', 'none');
}

// -- Utils -- //
function switchElementView(selector, status){
    if(selector){document.querySelector(selector).style.display = status;}
}
function closeActivityPlanner(){
    switchElementView('#modal-activity-planner', 'none');
}
function closeSignForm(){
    switchElementView('#modal-sign-form', 'none');
}
function closeProfile(){
    switchElementView('#modal-profile', 'none');
}
function closeActivityContent(){
    switchElementView('#modal-activity-content', 'none');
}
function closeAlert(){
    switchElementView('#modal-alert', 'none');
}
function closeLoading(){
    switchElementView('#modal-loading', 'none');
}
function initListeners(){
    getElement('#btn-landing').addEventListener('click', function(){
        this.className = 'landing-button-active';
        getElement('.btn-group').className = 'btn-group active';
        switchElementView('.main', 'contents');
    });
    getElement('#close-activity-content').addEventListener('click', closeActivityContent);
    getElement('#close-profile').addEventListener('click', closeProfile);
    getElement('#close-sign-form').addEventListener('click', closeSignForm);
    getElement('#btn-filters').addEventListener('click', filters);
    getElement('#ac-time-switch').addEventListener('click', switchStartEndTimeDisplay);
    getElement('#checkbox-realtime-render').addEventListener('click', function(event){
        main.map = new google.maps.Map(getElement('#map'), mapOptions);
        main.listener = setMapListener(main, (event.target.checked ? {filters:'on'} : null));
    })
    getElement('#checkbox-user-location').addEventListener('click', function(){
        if(this.checked){
            getUserLocation().then(function(){
                panToLocation(main.currentLocation);
            });
        };
    });
    getElement('#upload-profile').addEventListener('change', handleProfileUpload);
    
    getElement('#btn-mylocation').addEventListener('click', function(){
        getUserLocation().then(function(){
            getElement('.bg-landing').className = 'bg-landing-hide';
            window.setTimeout(function(){
                switchElementView('.bg-landing-hide', 'none')
            }, 1000);
            panToLocation(main.currentLocation);
            filters();
        });
    })
    getElement('#btn-anywhere').addEventListener('click', function(){
        getElement('.bg-landing').className = 'bg-landing-hide';
        window.setTimeout(function(){
            switchElementView('.bg-landing-hide', 'none')
        }, 1000)
        getElement('#map').focus();
        panToLocation(main.currentLocation);
        filters();
    })

    getElement('#btn-host-activity').addEventListener('click', function(){
        requestUserData().then(function(){
            generateActivityPlanner();
            switchElementView('#modal-activity-planner', 'flex');
        }).catch(function(){
            alertBox("請先登入會員").then(function(){
                switchProfileIcon('hide');
                showSignInForm();
            });
        });
    });

    getElement('#sign-in-tag').addEventListener('click', function(){
        if(!this.classList.contains('active')){
            getElement('#sign-in-tag').classList.toggle('active');
            getElement('#sign-up-tag').classList.toggle('active');
            showSignInForm();
        }
    });
    getElement('#sign-up-tag').addEventListener('click', function(){
        if(!this.classList.contains('active')){
            getElement('#sign-in-tag').classList.toggle('active');
            getElement('#sign-up-tag').classList.toggle('active');
            showSignUpForm();
        }
    });
    getElement('#btn-explore').addEventListener('click', function(){
        let options = {
            cat: 'official',
            center: Object.values(main.defaultCenter).join(','),
            dist: 5000,
            owner: '',
            type: '',
            listing: getElement('#page-listing').value,
            paging: 0
        };
        getElement('#cat-filter').value = options.cat;
        getElement('#dist-filter').value = (options.dist)/1000;
        getElement('#dist').innerHTML = (options.dist)/1000 + '公里';
        panToLocation(main.defaultCenter);

        getActivityData(options);
    })
}
function initFilters(){
    getElement('#dist-filter').value = 3;
    let catFilter = getElement('#cat-filter');
    while(catFilter.children.length>1){
        catFilter.removeChild(catFilter.lastChild);
    }
    getCategory().then(function(data){
        data.forEach(function(d){
            createElement('OPTION', {atrs:{
                value: d,
                innerHTML: misc.cat[d]
            }}, catFilter);
        });
    });
}
function initProfileIcon(){
    requestUserData().then(function(result){
        switchProfileIcon('show');
        setUserData(result);
    }).catch(function(){
        removeUserData();
        switchProfileIcon('hide');
    });
}
function switchProfileIcon(status){
    removeChildOf('#nav-profile');
    if(status==='hide'){
        return createElement('DIV', {atrs:{
            textContent: '登入'
        }, evts:{
            click: showSignInForm
        }}, getElement('#nav-profile'));
    }
    if(status==='show'){
        return createElement('IMG', {atrs:{
            src: 'img/profile.png',
        }, evts:{
            click: showProfilePage
        }}, getElement('#nav-profile'));
    }
}
function initActivityList(){
    removeChildOf('#activity-list');
    removeChildOf('#page-container');
    filters();
}
function initDateTimePicker(){
    let timerSettings = {
        dateStart: (new Date),              
        timeFormat: "HH:ii",
        timeSeconds: false,
        timeIncrement: true,
        timeStepHours: 1,
        timeStepMinutes: 15
    }
    misc.startTimePicker = tail.DateTime("#actl-u-t_start", timerSettings);
    misc.endTimePicker = tail.DateTime("#actl-u-t_end", timerSettings);
    
    misc.startTimePicker.on('change', function(){
        timerSettings.dateStart = (new Date(parseInt(getElement('#actl-u-t_start').dataset.value)));
        misc.endTimePicker.remove();
        misc.endTimePicker = tail.DateTime("#actl-u-t_end", timerSettings);
        misc.endTimePicker.reload();
    });
}

// -- Main -- //
function chooseDist(element){
    getElement('#dist').innerHTML=element.value + '公里';
}
function filters(){
    let center = `${main.currentLocation.lat},${main.currentLocation.lng}`;
    let dist = getElement('#dist-filter').value;
    let cat = getElement('#cat-filter').value;
    let type = getElement('#type-filter').value;
    let listing = getElement('#page-listing').value;
    
    let data = {
        center: center,
        dist: dist*1000,
        cat: cat,
        owner: '',
        type: '',
        listing: listing,
        paging: 0
    }
    if(cat!='custom'){data.owner = type;}
    else{data.type = type;}
    getActivityData(data);
}
function switchMainView(element, id){
    let mapDiv = document.querySelector('.main-map');
    let cardDiv = document.querySelector('.main-list');
    mapDiv.className = "main-map";
    cardDiv.className = "main-list";
    mapDiv.style.display='flex';
    cardDiv.style.display='flex';
    if(element){id = element.id}
    if(id==='view-map'){
        mapDiv.classList.add('main-map-show');
        cardDiv.classList.add('main-list-hide');
    }else if(id==='view-card'){
        mapDiv.classList.add('main-map-hide');
        cardDiv.classList.add('main-list-show');
    }
}
function showAdvSearch(element){
    let arrow = document.querySelector('.adv-arrow').classList.toggle('adv-active');
    let searchbar = document.querySelector('#search-activity-container');
    element.classList.toggle('adv-active');
    if(element.classList.contains('adv-active')){searchbar.style.display='flex'}
    else{searchbar.style.display='none'}
}

// -- User profile -- //
function showProfilePage(){
    requestUserData().then(function(result){
        showProfileContent(result);
    }).catch(function(error){
        alertBox("請先登入會員").then(function(){
            initPage();
        });
    });
}
async function showProfileContent(result){
    getElement('#profile-picture').src = result.data.profile_pic ? result.data.profile_pic : 'img/user.png';
    showUserInfo(result);
    switchElementView('#modal-profile', 'flex');
}
async function showUserInfo(result){
    // -- Reset content -- //
    let profileContent = document.querySelector('.profile-content');
    profileContent.innerHTML="";

    createElement('DIV', {atrs:{
        className: 'profile-title'
    }}, profileContent);
    createElement('P', {atrs:{
        textContent: '個人資訊'
    }}, document.querySelector('.profile-title'));
    
    // -- get data within this function scope -- //
    let data, preference;
    if(!result){
        result = await requestUserData();
        if(!result.error){
            data = result.data;
            preference = result.preference;
        }
    }else{
        data = result.data;
        preference = result.preference;
    }
    
    let userObj = [{
        title: "User ID",
        content: data.user_id
    }, {
        title: "Email",
        content: data.email
    }, {
        title: "Name",
        content: data.name
    }, {
        title: "Icon",
        content: data.icon ?  `<img class="icon-48" src="../img/${data.icon}.png">` : "(尚未設定圖示)"
    }];
    for(let i=0; i<userObj.length; i++){
        createElement('DIV', {atrs:{
            className: `profile-userinfo p-u-${i}`
        }}, profileContent);
        createElement('DIV', {atrs:{
            className: 'info-title',
            innerHTML: userObj[i].title
        }}, document.querySelector(`.p-u-${i}`));
        createElement('DIV', {atrs:{
            className: 'info-content',
            innerHTML: userObj[i].content
        }}, document.querySelector(`.p-u-${i}`));
    }
    createElement('DIV', {atrs:{
        className: 'profile-last'
    }}, profileContent);
    createElement('BUTTON', {atrs:{
        className: 'btn btn-altered',
        textContent: 'Edit'
    }, evts:{
        click: showEdit
    }}, document.querySelector('.profile-last'));
    
}
function showEdit(event){
    let iconTitle = document.querySelector('.p-u-3>.info-title');
    iconTitle.textContent = "Choose one...";
    iconTitle.setAttribute("style", "background-color: #f89b4f");

    let iconDiv =  document.querySelector('.p-u-3>.info-content');
    for(let i=0; i<7; i++){
        let randomNo = randomNoGen(96);
        createElement('IMG', {atrs:{
            id: `icon/${randomNo}`,
            className: 'icon-48 hover-effect',
            src: `../img/icon/${randomNo}.png`
        }, evts:{
            click: chooseIcon
        }}, iconDiv);
    }
    function chooseIcon(event){
        let nodes = getElementAll('.info-content>img');
        Array.from(nodes).forEach(n=>n.className='icon-48 hover-effect');
        event.target.className = "icon-48 selected";
    }
    event.target.parentNode.removeChild(event.target);
    createElement('BUTTON', {atrs:{
        className: 'btn btn-submit',
        textContent: 'OK'
    }, evts:{
        click: closeEdit
    }}, document.querySelector('.profile-last'));
    function closeEdit(event){
        event.target.parentNode.removeChild(event.target);
        let iconDiv = document.querySelector('.p-u-3>.info-content');
        
        let selectedIcon = document.querySelector('.info-content>img.selected');
        if(!selectedIcon){
            while(iconDiv.children.length>1){
            iconDiv.removeChild(iconDiv.lastChild);
        }}else{
            iconDiv.innerHTML = "";
            createElement('IMG', {atrs:{
                className: 'icon-48',
                src: `../img/${selectedIcon.id}.png`
            }}, iconDiv);
            updateUserData('icon', {icon: selectedIcon.id, user_id: localStorage.getItem('user_id')})
                .then(function(result){
                    if(result.message===true){
                        alertBox("圖示已更新！");
                    }else{
                        alertBox("圖示更新失敗，請稍後再試。");
                    }
                });
        }

        let iconTitle = document.querySelector('.p-u-3>.info-title');
        iconTitle.textContent = "Icon";
        iconTitle.setAttribute("style", "background-color: rgb(175, 175, 175)");

        createElement('BUTTON', {atrs:{
            className: 'btn btn-altered',
            textContent: 'Edit'
        }, evts:{
            click: showEdit
        }}, document.querySelector('.profile-last'));
        
    }
}
function updateUserData(field, data){
    return fetch(`/user/update/${field}`, {
        method: "POST",
        headers: {
            'Authorization':`Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type':'application/json'
        },
        body: JSON.stringify(data)
    }).then(function(result){
        return result.json();
    });
}
function showLikedList(tabName){
    // -- Reset content -- //
    let profileContent = document.querySelector('.profile-content');
    profileContent.innerHTML="";
    createElement('DIV', {atrs:{
        className: 'profile-title'
    }}, profileContent);
    createElement('P', {atrs:{
        textContent: '管理活動'
    }}, document.querySelector('.profile-title'));


    let panel = createElement('DIV', {atrs:{
        className: "user-actl-panel"
    }}, profileContent);
    let tab = createElement('DIV', {atrs:{
        className: "user-actl-tab flex-r-st"
    }}, panel);
    createElement('DIV', {atrs:{
        id: 'user-actl-tab-liked',
        textContent: '關注'
    }, evts:{
        click: switchMgmtTab
    }}, tab);
    createElement('DIV', {atrs:{
        id: 'user-actl-tab-joined',
        textContent: '參加'
    }, evts:{
        click: switchMgmtTab
    }}, tab);
    createElement('DIV', {atrs:{
        id: 'user-actl-tab-held',
        textContent: '舉辦'
    }, evts:{
        click: switchMgmtTab
    }}, tab);
    createElement('DIV', {atrs:{
        className: 'user-actl-list-container'
    }}, profileContent);


    // default management tab view
    tabName ? showMgmtTabContent(tabName) : showMgmtTabContent('liked');
    
    function switchMgmtTab(event){
        let tabs = getElementAll('.user-actl-tab>div');
        Array.from(tabs).map(t=>t.className='');
        event.target.classList += 'active';
        showMgmtTabContent(event.target.id.split('user-actl-tab-')[1]);
    }
    async function showMgmtTabContent(tabName){
        misc.currentActivityMgmtTabName = tabName;
        let preference = JSON.parse(localStorage.getItem('preference'));
        let detail = await fetch(`/user/activity?actl_id=${preference[tabName].join(",")}`).then(r=>r.json());
        console.log(detail)
        let container = document.querySelector('.user-actl-list-container');
        container.innerHTML="";
        let title = createElement('DIV', {atrs:{className: 'flex-r-b'}}, container);
        createElement('DIV', {stys:{width: '60px'}}, title);
        createElement('DIV', {atrs:{
            className: 'user-actl-list-title',
            innerHTML: mgmtText(tabName, detail.length)
        }}, title);
        let imgDiv = createElement('DIV', '', title);
        createElement('IMG', {atrs:{
            id: 'edit-invisible',
            className: 'icon-24 hover-effect hide',
            src:"../img/invisible.png"
        }, stys:{
            margin: '0px 3px'
        }, evts:{
            click: switchVisibility
        }}, imgDiv);
        createElement('IMG', {atrs:{
            id: 'edit-visible',
            className: 'icon-24 hover-effect',
            src:"../img/visible.png"
        }, stys:{
            margin: '0px 3px'
        }, evts:{
            click: switchVisibility
        }}, imgDiv);
        createElement('IMG', {atrs:{
            className: 'icon-24 hover-effect',
            src:"../img/edit.png"
        }, stys:{
            margin: '0px 3px'
        }, evts:{
            click: showPreferenceEditor
        }}, imgDiv);
        createElement('DIV', {atrs:{className: 'user-actl-list'}}, container);

        // Not showing passed activities
        // detailFuture = detail.filter(d=>(new Date(d.t_start))>Date.now());

        createUserActivityList(detail);
        async function switchVisibility(){
            document.querySelector('.user-actl-list').innerHTML = "";
            let title = document.querySelector('.user-actl-list-title');
            let visible = document.querySelector('#edit-visible');
            visible.classList.toggle('hide');
            let invisible = document.querySelector('#edit-invisible');
            invisible.classList.toggle('hide');
            let detail = await fetch(`/user/activity?actl_id=${preference[tabName].join(",")}`).then(r=>r.json());
            if(visible.classList.contains('hide')){
                // Current status is invisible
                detailFuture = detail.filter(d=>(new Date(d.t_start))>Date.now());
                createUserActivityList(detailFuture);
                title.innerHTML = mgmtText(misc.currentActivityMgmtTabName, detailFuture.length, 'invisible');
            }else{
                // Current status is visible
                createUserActivityList(detail);
                title.innerHTML = mgmtText(misc.currentActivityMgmtTabName, detail.length, 'visible');
            }
        }
        function showPreferenceEditor(){
            let crosses = getElementAll('.user-actl-card>img');
            Array.from(crosses).forEach(c=>c.classList.toggle('hide'));
        }
        function mgmtText(tabName, count, visibility){
            if(visibility==='invisible'){
                return count===0 ? "沒有即將展開的活動..." : `有<strong>${count}</strong>個活動即將展開...`;
            }
            let action = '';
            if(tabName==='liked'){action='關注'}
            if(tabName==='joined'){action=`參加`}
            if(tabName==='held'){action=`舉辦`}
            return count===0 ? `沒有${action}的活動...` : `${action}了<strong>${count}</strong>個活動...`;
        }
        function createUserActivityList(detail){
            let card, content;
            for(let i=0; i<detail.length; i++){
                card = createElement('DIV', {atrs:{
                    id: `${tabName}card-${detail[i].actl_id}`,
                    className: 'user-actl-card'
                }}, document.querySelector('.user-actl-list'));
                createElement('DIV', {atrs:{
                    className: 'user-card-no',
                    textContent: i+1
                }}, card);
                content = createElement('DIV', {atrs:{className: 'user-card-content flex-r-b'}}, card);
                createElement('DIV', {atrs:{
                    id: `${tabName}-${detail[i].actl_id}-title`,
                    className: 'hover-effect',
                    textContent: detail[i].title
                }, evts:{
                    click: showActivityContent
                }}, content);
                createElement('P', {atrs:{
                    id: `${tabName}-${detail[i].actl_id}-time`,
                    className: 'title',
                    textContent: timeFormatter(detail[i].t_start, 'md', 'hm')
                }}, content);
                
                if(tabName==='held'){
                    createElement('IMG', {atrs:{
                        id: `${tabName}-${detail[i].actl_id}-edit`,
                        className: 'icon-24 hover-effect hide',
                        src:'../img/document.png'
                    }, evts:{
                        click: editActivityOnProfile
                    }}, card);
                }
    
                createElement('IMG', {atrs:{
                    id: `${tabName}-${detail[i].actl_id}-delete`,
                    className: 'icon-24 hover-effect hide',
                    src:'../img/delete-r.png'
                }, evts:{
                    click: removeActivityOnProfile
                }}, card);
            }
        }
        
        async function editActivityOnProfile(event){
            misc.editingActivityId = event.target.id.split('-')[1];
            generateActivityPlanner();
            getElement('.activity-title>p').textContent = "編輯活動";
            let result = await fetch(`/get/activity/?actl_id=${misc.editingActivityId}`).then(r=>r.json());
            getElement("#actl-u-title").value = result.content.title;
            getElement("#actl-u-type").value = result.content.actl_type;
            getElement("#actl-u-place").value = `${result.content.lat.toFixed(4)}, ${result.content.lng.toFixed(4)}`;
            getElement("#actl-u-t_start").value = timeFormatter(result.content.t_start, 'ymd', 'hm');
            getElement("#actl-u-t_end").value = timeFormatter(result.content.t_end, 'ymd', 'hm');
            getElement("#actl-u-description").value = result.content.description;
            getElement("#create-activity").removeEventListener('click', createActivity);
            getElement("#create-activity").addEventListener('click', editActivity);

            switchElementView('#modal-activity-planner', 'flex');
        }
        async function removeActivityOnProfile(event){
            let status = await alertBox('確定移除此活動?', 'showCancel');
            if(status===true){
                // Dealing with DB update ...
                let action = event.target.id.split('-')[0];
                let actl_id = event.target.id.split('-')[1];
                if(action==='liked'||action==='joined'){
                    actOnActivity(event, function(event, result){
                        if(result.message==='removed'){
                            updatePrefOnLocal(actl_id, action, 'delete')
                            alertBox('成功移除此活動').then(function(){
                                showLikedList(tabName);
                            })
                        }else{
                            alertBox("無法移除此活動，請稍後再試。");
                        }
                    });
                }else if(action==='held'){
                    await fetch(`/user/delete/activity?actl_id=${actl_id}`);
                    updatePrefOnLocal(actl_id, action, 'delete');
                    alertBox('成功移除此活動').then(function(){
                        showLikedList(tabName);
                    })
                }
            }
        }
    }

}
function checkImageType(selector){
    let supportedType = ['jpg', 'jpeg', 'png', 'gif'];
    if(getElement(selector).files.length!=1){
        return({status: true, data: []});
    }else{
        let file = getElement(selector).files[0];
        let fileType = file.type.split('/')[1];
        return supportedType.includes(fileType) ? {status: true, data: file} : {status: false};
    }
}
async function handleProfileUpload(){
    let imgObj = checkImageType('#upload-profile');
    if(imgObj.status===false){return alertBox('請上傳圖片檔: (jpg / jpeg / png / gif)');}
    if(!imgObj.data.name){return;}
    let status = await alertBox(`確定要上傳${imgObj.data.name}?`, 'showCancel');
    if(status===true){
        switchElementView('#modal-loading', 'flex');
        let result = await uploadImage(imgObj.data, {
            filename: 'profile',
            user_id: localStorage.getItem('user_id')
        });
        switchElementView('#modal-loading', 'none');
        switch(result.status){
            case 200:
                alertBox("上傳圖片成功！").then(function(){
                    getElement('#profile-picture').src = result.data;
                });
                break;
            case 401:
                alertBox("上傳圖片失敗，請重新登入。").then(function(){
                    switchElementView('#modal-profile', 'none');
                    switchElementView('#modal-sign-form', 'flex');
                });
                break;
            case 400:
                alertBox("上傳格式設定錯誤。");
                break;
            default:
                alertBox("上傳圖片失敗，請稍後再試。");
                break;
        }
    }
}
function switchProfileUploadIcon(){
    checkProfileImageType('#profile-file')
        switchElementView('#icon-upload-profile', 'flex');
}


// -- Activity -- //
function switchStartEndTimeDisplay(){
    let StartTimeP = document.querySelector('#ac-t-start');
    let endTimeP = document.querySelector('#ac-t-end');
    if(StartTimeP.classList.contains('hide')){
        StartTimeP.className = '';
        endTimeP.className = 'hide';
    }else{
        StartTimeP.className = 'hide';
        endTimeP.className = '';
    }
}
function renderActivityCards(result){
    let preference = JSON.parse(localStorage.getItem('preference'));
    let {data} = result;
    let {entries, listing, paging, pageCount} = result.info;
    let {request} = result.info;
    let currentPage = parseInt(paging)+1;
    let lastPage = Math.floor((entries-1)/listing)+1;
    let pageTabs = Math.floor((lastPage-1)/pageCount)+1;
    let currentPageTab = Math.floor((currentPage-1)/pageCount)+1;
    let thisListing = (entries - currentPage*listing) > 0 ? listing : entries - (currentPage-1)*listing;
    let thisPageCount = (lastPage < pageCount) ? lastPage : pageCount;
    // console.log(currentPage, lastPage, pageTabs, currentPageTab)

    // Clear previous data
    let actlDiv = document.querySelector('#activity-list');
    let pageContainer = document.querySelector('#page-container');
    actlDiv.innerHTML='';
    pageContainer.innerHTML='';

    // Show activity entries
    if(entries === 0){
        document.querySelector('#activity-counts').innerHTML = `沒有搜尋結果...`
    }else{
        document.querySelector('#activity-counts').innerHTML = `共有 <strong>${entries}</strong> 筆搜尋結果`
    }

    // Create cards
    let actlCard, cardImg, content, footer, owner, 
    ownerWrapper, header, main, footerLeft, footerRight;
    for(let i=0; i<thisListing; i++){
        actlCard = createElement('DIV', {atrs:{
            id: `card-${data[i].actl_id}`,
            className: `actl-card`
        }}, actlDiv);
        
        // Anchor for info window //
        createElement('A', {atrs:{
            name: `card-${data[i].actl_id}`
        }}, actlCard)

        cardImg = createElement('DIV', {atrs:{
            className: "actl-card-img"
        }}, actlCard);
        content = createElement('DIV', {atrs:{
            className: "actl-card-content flex-c-c"
        }}, actlCard);
        footer = createElement('DIV', {atrs:{
            className: "actl-card-footer",
        }}, actlCard);
        
        createElement("IMG", {atrs:{
            src: data[i].main_img ? data[i].main_img : '../img/bg/start_exploring.jpg'
        }}, cardImg);
        ownerWrapper = createElement("DIV", {atrs:{
            className: 'actl-card-owner-wrapper flex-r-c'
        }}, cardImg)
        owner = createElement("DIV", {atrs:{
            className: 'actl-card-owner'
        }}, ownerWrapper)
        createElement("IMG", {atrs:{
            src: iconPicker(data[i]).url
        }}, owner);

        header = createElement('DIV', {atrs:{
            className: "actl-card-content-header flex-r-st"
        }}, content);
        createElement("IMG", {atrs:{
            className: 'icon-16',
            src: '../img/clock.png',
        }}, header);
        createElement("DIV", {atrs:{
            id: 'actl-card-time',
            innerHTML: data[i].t_start ? timeFormatter(data[i].t_start, 'ymd', 'hm') : ''
        }}, header);
        
        main = createElement('DIV', {atrs:{
            className: "actl-card-content-main flex-c-c"
        }}, content);

        if(data[i].actl_id){
            createElement("DIV", {atrs:{
                id: `title-${data[i].actl_id}`,
                className: 'actl-card-title hover-effect',
                innerHTML: data[i].title ? data[i].title : '(無標題)'
            }, evts:{
                click: showActivityContent
            }}, main);
        }else{
            createElement("DIV", {atrs:{
                className: 'actl-card-title',
                innerHTML: data[i].title ? data[i].title : '(無標題)'
            }}, main);
        }
        
        footerLeft = createElement("DIV", {atrs:{
            className: 'actl-card-footer-left flex-r-st',
        }}, footer);
        createElement("IMG", {atrs:{
            className: 'icon-30',
            src: '../img/tag.png',
        }}, footerLeft);
        createElement("DIV", {atrs:{
            className: 'actl-card-footer-type',
            innerHTML: data[i].actl_type ? data[i].actl_type : '(未分類)'
        }}, footerLeft);
        footerRight = createElement("DIV", {atrs:{
            className: 'actl-card-footer-right flex-r-st',
        }}, footer);
        if(data[i].lat){
            createElement("IMG", {atrs:{
                id: `${data[i].lat},${data[i].lng}`,
                className: 'actl-card-marker icon-30 hover-effect',
                src: '../img/marker.png',
            }, evts:{
                click: indicateLocation
            }}, footerRight);
        }else{
            createElement("IMG", {atrs:{
                className: 'actl-card-marker icon-30',
                src: '../img/marker.png',
            }}, footerRight);
        }

        if(preference && preference.liked.includes(data[i].actl_id)){
            createElement("IMG", {atrs:{
                id: `like-${data[i].actl_id}`,
                className: 'actl-card-favorite icon-30 hover-effect',
                src: '../img/favorite-filled.png',
            }, evts:{
                click: likeActivityOnCard
            }}, footerRight);
        }else{
            createElement("IMG", {atrs:{
                id: `like-${data[i].actl_id}`,
                className: 'actl-card-favorite icon-30 hover-effect',
                src: '../img/favorite.png',
            }, evts:{
                click: likeActivityOnCard
            }}, footerRight);
        }
    }

    // dummy div
    createElement("DIV", {stys:{
        height: '20px',
        width: '100%'
    }}, actlDiv);

    // Create pages
    let pagePrevAll = createElement('DIV', {atrs:{
        id: 'page-prevall',
        className: 'page-box',
        textContent: '<<'
    }}, pageContainer);
    let pagePrev = createElement('DIV', {atrs:{
        id: 'page-prev',
        className: 'page-box',
        textContent: '上一頁'
    }}, pageContainer);
    let pageCountDIV = createElement('DIV', {atrs:{
        id: `${data.cat}-${data.type}-${data.owner}-${data.dist}-${data.lat},${data.lng}-${paging}`,
        className: 'page-count'
    }}, pageContainer);
    
    let pageCountStart = (currentPageTab-1)*thisPageCount+1;
    let pageCountEnd = (pageCountStart+pageCount-1)>lastPage ? lastPage : pageCountStart+result.info.pageCount-1;

    for(let i=pageCountStart; i<=pageCountEnd; i++){
        createElement('DIV', {atrs:{
            id: `page-${i}`,
            className: 'page-box',
            textContent: i,
        }, evts:{
            click: renderLocationByPage
        }}, pageCountDIV);
    }

    let pageNext = createElement('DIV', {atrs:{
        id: 'page-next',
        className: 'page-box',
        textContent: '下一頁'
    }}, pageContainer);
    let pageNextAll = createElement('DIV', {atrs:{
        id: 'page-nextall',
        className: 'page-box',
        textContent: '>>'
    }}, pageContainer);
    createElement('DIV', {atrs:{
        className: 'page-sum',
        textContent: `共${lastPage}頁`
    }}, pageContainer);

    // Logic for each page click button
    if(currentPage != 1){
        pagePrev.addEventListener('click', renderLocationByPage);
    }else{
        pagePrev.classList.add('page-disabled');
    }
    if(currentPage != lastPage){
        pageNext.addEventListener('click', renderLocationByPage);
    }else{
        pageNext.classList.add('page-disabled');
    }
    if(currentPage/thisPageCount > 1){
        pagePrevAll.addEventListener('click', renderLocationByPage);
    }else{
        pagePrevAll.classList.add('page-disabled');
    }
    if(currentPageTab < pageTabs){
        pageNextAll.addEventListener('click', renderLocationByPage);
    }else{
        pageNextAll.classList.add('page-disabled');
    }

    // Current page set to be unclickable
    ActivatePageNo(currentPage);
    function ActivatePageNo(pageNo){
        if(!pageNo || lastPage === 0) return;
        document.querySelector(`#page-${pageNo}`).removeEventListener('click', renderLocationByPage);
        document.querySelector(`#page-${pageNo}`).classList.add('page-active');
    }
    
    function renderLocationByPage(event){
        let reqParam = event.target.id.split('-')[1];
        let reqPaging = parseInt(request.paging);
        switch(reqParam){
            case 'prev':
                reqPaging -= 1;
                break;
            case 'next':
                reqPaging += 1;
                break;
            case 'prevall':
                reqPaging-=thisPageCount;
                break;
            case 'nextall':
                reqPaging+=thisPageCount;
                break;
            default:
                reqPaging = parseInt(reqParam) - 1;
                break;
        }
        request.paging = reqPaging;
        getActivityData(request);
    }
}
function renderActivityContent(result){
    let content = result.content;
    let members = result.member;
    document.querySelector('#ac-img').src=content.main_img || 'img/bg/explorer.jpg';
    document.querySelector('#ac-title').innerHTML=content.title;
    document.querySelector('#ac-t-start').innerHTML= content.t_start ? `開始時間: ${timeFormatter(content.t_start, 'ymd', 'hm')}` : "(開始時間未定)";
    document.querySelector('#ac-t-end').innerHTML= content.t_end ? `結束時間: ${timeFormatter(content.t_end, 'ymd', 'hm')}`: "(結束時間未定)";
    document.querySelector('#ac-type').innerHTML=content.actl_type ? content.actl_type : "(未分類)" ;
    document.querySelector('#ac-description').innerHTML=content.description;
    document.querySelector('#ac-map').innerHTML=modal.map;
    document.querySelector('#ac-address').innerHTML=content.address || "(無地址資訊可顯示)";
    
    document.querySelector('#ac-ref>a').innerHTML=content.ref;
    document.querySelector('#ac-ref>a').href=content.ref; 
    document.querySelector('#ac-footer-info').innerHTML = additionalActivityInfo(content);
    document.querySelector('#ac-going-list').innerHTML='';
    document.querySelector('#ac-footer-btn').innerHTML='';
    if(content.category === 'official'){
        document.querySelector('#ac-owner').innerHTML=content.owner;
    }else if(content.category === 'custom'){
        document.querySelector('#ac-owner').innerHTML=members.filter(m=>m.status==='held')[0].name;
    }
    let currentUser = localStorage.getItem('user_id');
    let isJoined = false;
    for(let i=0; i<members.length; i++){
        createElement("DIV", {atrs:{
            className: `tip tip-${i}`
        }}, document.querySelector('#ac-going-list'));
        createElement('IMG', {atrs:{
            id: members[i].name,
            className: 'icon-30',
            src: members[i].icon           
        }}, document.querySelector(`.tip-${i}`));
        createElement("DIV", {atrs:{
            className: 'tiptext',
            textContent: members[i].name
        }}, document.querySelector(`.tip-${i}`));

        if(members[i].user_id === currentUser){isJoined = true;}
    }

    
    createElement('BUTTON', {atrs:{
        className: "btn btn-cancel ac-cancel",
        textContent: 'Cancel'
    }, evts:{
        click: closeActivityContent
    }}, document.querySelector('#ac-footer-btn'));
    if(isJoined){
        createElement('BUTTON', {atrs:{
            id: content.actl_id,
            className: "btn btn-faded ac-join",
            textContent: 'Joined'
        }}, document.querySelector('#ac-footer-btn'));
    }else{
        createElement('BUTTON', {atrs:{
            id: `join-${content.actl_id}`,
            className: "btn btn-submit ac-join",
            textContent: 'Join'
        }, evts:{
            click: joinActivityOnActivityContent
        }}, document.querySelector('#ac-footer-btn'));
    }
    
    
    // <div>Icons made by <a href="https://www.flaticon.com/authors/roundicons" title="Roundicons">Roundicons</a> from <a href="https://www.flaticon.com/"     title="Flaticon">www.flaticon.com</a></div>

    if(content.lat){
        modal.map = new google.maps.Map(document.getElementById('ac-map'), {
            zoom: 14,
            disableDefaultUI: true,
            center: {lat: content.lat, lng: content.lng}
        });
        modal.marker = new google.maps.Marker({
            position: {lat: content.lat, lng: content.lng},
            map: modal.map
        });
    }else{
        document.getElementById('ac-map').innerHTML = "(無地點資訊可顯示)"
    }

    function additionalActivityInfo(content){
        if(content.category==='custom'){return "";}
        if(content.category==='official'){
            return `※此為官方活動 ${content.free===0?"，並且可能必須付費":""}。詳情請參考連結。`;
        }
    }
}
function joinActivityOnActivityContent(event){
    actOnActivity(event, function(event, result){
        if(result.message==='added'){
            // updatePrefOnLocal(event.target.id, 'joined', 'add');
            alertBox("成功加入此活動！").then(function(){
                switchElementView('#modal-activity-content', 'none');
            });
        }else if(result.message==='removed'){
            // updatePrefOnLocal(event.target.id, 'joined', 'delete');
            alertBox("取消參加此活動").then(function(){
                switchElementView('#modal-activity-content', 'none');
            });
        }else if(result.error){
            alertBox("無法更新狀態，請稍後再試。").then(function(){
                switchElementView('#modal-activity-content', 'none');
            });
        }
    })
}
function likeActivityOnCard(event){
    actOnActivity(event, function(event, result){
        let actl_id = event.target.id.split('-')[1];
        if(result.message==='added'){
            event.target.src = event.target.src.replace('favorite.png', 'favorite-filled.png');
            // updatePrefOnLocal(actl_id, 'liked', 'add');
            alertBox("已加入關注！");
        }else if(result.message==='removed'){
            event.target.src = event.target.src.replace('favorite-filled.png', 'favorite.png');
            // updatePrefOnLocal(actl_id, 'liked', 'delete');
            alertBox("已取消關注！");
        }else if(result.error){
            console.log(result.error);
        }
    });
}
// -- Search -- //
function switchSearchMode(){
    let status = document.querySelector('#switch-search-mode').checked;
    let mode = document.querySelector('.adv-search-mode');
    // let searchBox = document.querySelector('#search-main');
    let searchContainer = document.querySelector('#search-main').parentNode;
    searchContainer.innerHTML='';
    
    if(status===false){
        mode.textContent = '即時';
        createElement('INPUT', {atrs:{
            id: 'search-main',
            className: 'searchbox input-effect',
            type: 'text',
            placeholder: '輸入任意字串即時搜尋...'
        }, stys:{
            width: "100%"
        }, evts:{
            input: realtimeSearch
        }}, searchContainer);
    }else{
        mode.textContent = '關鍵字'; 
        createElement('INPUT', {atrs:{
            id: 'search-main',
            className: 'searchbox input-effect',
            type: 'text',
            placeholder: '輸入關鍵字，以符號隔開搜尋...'
        }, stys:{
            width: "100%"
        }, evts:{
            input: keywordSearch
        }}, searchContainer);
    }
    createElement('DIV', {atrs:{
        id: 'search-main-items',
        className: 'autocomplete-items',
        type: 'text',
        placeholder: '輸入關鍵字，以符號隔開搜尋...'
    }}, searchContainer);
}
function clearSearch(){
    let lastSearch = misc.lastSearch;
    console.log(lastSearch)
    document.querySelector('#search-main').value = "";
    fetch(lastSearch).then(function(response){
            return response.json();
        }).then(function(result){
            renderActivityCards(result);
            main.markers = renderMarkers(result);
            addInfoWindow(main.markers, result);
        }).catch(function(error){
            console.log(error) // *TODO*: error handling
        });
}
function setSearch(event){
    let searchBox = document.querySelector('#search-main');
    let searchList = document.querySelector('#search-main-items');
    switch(event.type){
        case 'click':
            searchList.innerHTML = "";
            searchBox.value = event.target.innerHTML;
            misc.searchActivityId = event.target.id.split('-')[1];
            break;
        case 'mouseover':
            searchBox.value = event.target.innerHTML;
            break;
        case 'mouseout':
            searchBox.value = "";
            break;
        default:
            break;
    }
}
function setSelectType(event){
    let box = document.querySelector('#actl-u-type');
    let list = document.querySelector('#activity-planner-type');
    switch(event.type){
        case 'click':
            list.innerHTML = "";
            box.value = event.target.innerHTML;
            break;
        case 'mouseover':
            box.value = event.target.innerHTML;
            break;
        case 'mouseout':
            box.value = "";
            break;
        default:
            break;
    }
}
function clearSelect(event){
    event.target.parentNode.removeChild(event.target);
}
function selectType(event){
    let keyword = event.target.value.toLowerCase();
    let fitTypes = misc.customType.filter(t=>t.toLowerCase().includes(keyword));
    let typelist = document.querySelector('#activity-planner-type');
    let input = document.querySelector("#actl-u-type");
    typelist.innerHTML = "";
    if(fitTypes.length===0){
        createElement('DIV', {atrs:{
            textContent: '新增類型...'
        }, stys:{
            fontStyle: 'italic',
            color: 'grey'
        }, evts:{
            click: clearSelect,
        }}, typelist);
        input.addEventListener('keyup', function(event){
            if(event.keyCode===13 || event.keyCode===9){typelist.innerHTML=""}
        })
    }else{
        fitTypes.forEach(function(t){
            createElement('DIV', {atrs:{
                textContent: t
            }, evts:{
                click: setSelectType,
                mouseover: setSelectType,
                mouseout: setSelectType,
            }}, typelist);
        });
    }
}
function realtimeSearch(){
    let words = document.querySelector('#search-main').value;
    let searchList = document.querySelector('#search-main-items');

    if(words.length===0){return searchList.innerHTML = "";}
    let newWords = words.replace(/[\u3100-\u312F]/g, '');
    newWords = newWords.replace(/([\"\'\&\@\#\$\%\^\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g, "");
    if(words.length === newWords.length){
        fetch(`/search/title/realtime?words=${newWords}`).then(function(response){
            return response.json();
        }).then(function(result){
            searchList.innerHTML = "";
            result.forEach(function(r){
                createElement('DIV', {atrs:{
                    id: `search-${r.actl_id}`,
                    textContent: r.title
                }, evts:{
                    click: setSearch,
                    mouseover: setSearch,
                    mouseout: setSearch
                }}, searchList);
            })
        })
    }else{
        console.log("invalid")
    }
}
function keywordSearch(){
    let words = document.querySelector('#search-main').value;
    let searchList = document.querySelector('#search-main-items');
    if(words.length===0){return searchList.innerHTML = "";}

    let fragments = words.replace(/([\"\ \'\&\@\#\$\%\^\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g, ",");
    let fragmentsLength = fragments.split(',').length;
    if(fragmentsLength!=misc.keywordCount){
        // record current keyword counts
        misc.keywordCount = fragmentsLength;
        fetch(`/search/title/keywords?words=${fragments}`).then(function(response){
            return response.json();
        }).then(function(result){
            searchList.innerHTML = "";
            result.forEach(function(r){
                createElement('DIV', {atrs:{
                    id: `search-${r.actl_id}`,
                    textContent: r.title
                }, evts:{
                    click: setSearch,
                    mouseover: setSearch,
                    mouseout: setSearch
                }}, searchList);
            })
        })
    }
}
function searchActivityById(){
    let words = document.querySelector('#search-main').value;
    if(!words||!misc.searchActivityId){return;}
    let actl_id = misc.searchActivityId;
    fetch(`/filter/f?actl_id=${actl_id}`)
        .then(function(response){
            return response.json();
        }).then(function(result){
            renderActivityCards(result);
            main.markers = renderMarkers(result);
            addInfoWindow(main.markers, result);
        }).catch(function(error){
            console.log(error) // *TODO*: error handling
        });
    // Reset id
    misc.searchActivityId = '';
}

// -- User -- //
function showSignInForm(){
    switchElementView('#modal-sign-form', 'flex');
    let signContent = document.querySelector('.sign-content');
    signContent.innerHTML = "";
    createElement('DIV', {atrs:{
        className: 'text',
        textContent: 'Email Address:'
    }}, signContent);
    createElement('INPUT', {atrs:{
        type: 'email',
        className: 'input-effect',
        id: 'sign-in-email',
        placeholder: "nearme@gmail.com"
    }}, signContent);
    createElement('DIV', {atrs:{
        className: 'text',
        textContent: 'Password:'
    }}, signContent);
    createElement('INPUT', {atrs:{
        type: 'password',
        className: 'input-effect',
        id: 'sign-in-password',
        placeholder: "Password"
    }, evts:{
        keyup: enterListener
    }}, signContent);
    createElement('DIV', {atrs:{
        className: 'alert-text',
    }, stys:{
        display: 'hidden'
    }}, signContent);
    createElement('DIV', {atrs:{
        className: "sign-in-btn-group flex-r-c"
    }}, signContent);
    createElement('BUTTON', {atrs:{
        type: 'submit',
        id:"sign-in-btn",
        className: 'btn btn-submit',
        textContent: 'Submit'
    }, evts:{
        click: signin
    }}, document.querySelector('.sign-in-btn-group'));
    createElement('HR', {}, signContent);
    let otherWay = createElement('DIV', {atrs:{
        className: "flex-r-c",
        textContent: "或使用其他方法登入:"
    }}, signContent);
    createElement('IMG', {atrs:{
        id: "fbLogin",
        src:"../img/FB-icon.png"
    }, evts:{
        click: fbLogin
    }}, otherWay);
}
function showSignUpForm(){
    let signContent = document.querySelector('.sign-content');
    signContent.innerHTML = "";
    createElement('DIV', {atrs:{
        className: 'text',
        textContent: 'Name:'
    }}, signContent);
    createElement('INPUT', {atrs:{
        type: 'text',
        className: 'input-effect',
        id: 'sign-up-name',
        placeholder: "How do others call you?"
    }}, signContent);
    createElement('DIV', {atrs:{
        className: 'text',
        textContent: 'Email Address:'
    }}, signContent);
    createElement('INPUT', {atrs:{
        type: 'email',
        className: 'input-effect',
        id: 'sign-up-email',
        placeholder: "newuser@gmail.com"
    }}, signContent);
    createElement('DIV', {atrs:{
        className: 'text',
        textContent: 'Password:'
    }}, signContent);
    createElement('INPUT', {atrs:{
        type: 'password',
        className: 'input-effect',
        id: 'sign-up-password',
        placeholder: "At least 6 characters"
    }}, signContent);
    createElement('DIV', {atrs:{
        className: 'text',
        textContent: 'Confirm Password:'
    }}, signContent);
    createElement('INPUT', {atrs:{
        type: 'password',
        className: 'input-effect',
        id: 'sign-up-password-2',
        placeholder: "Enter password again"
    }, evts:{
        keyup: enterListener
    }}, signContent);
    createElement('DIV', {atrs:{
        className: 'alert-text',
    }, stys:{
        display: 'hidden'
    }}, signContent);
    createElement('DIV', {atrs:{
        className: "sign-in-btn-group flex-r-c"
    }}, signContent);
    createElement('BUTTON', {atrs:{
        type: 'submit',
        id:"sign-up-btn",
        className: 'btn btn-submit',
        textContent: 'Submit'
    }, evts:{
        click: signup
    }}, document.querySelector('.sign-in-btn-group'));
}
function signUpErrMsg(name, email, password, password2){
    if(name.length > 30){
        return "名稱太長，請輸入少於30個字。"
    }else if(!email.includes('@')){
        return "請輸入正確的電子郵件。";
    }else if (password != password2){
        return "請輸入相同的密碼。";
    }else if (password.length < 6){
        return "請輸入至少六位密碼。";
    }else{
        return false;
    }
}
function logout(){
    alertBox('確定登出?', 'showCancel').then(function(status){
        if(status===true){
            switchElementView('#modal-profile', 'none');
            alertBox('登出成功！').then(function(){
                removeUserData();
                initPage();
            });
        }
    });
}
function setUserData(result){
    localStorage.setItem('access_token', result.data.access_token);
    localStorage.setItem('user_id', result.data.user_id);
    localStorage.setItem('provider', result.data.provider);
    localStorage.setItem('icon', result.data.icon);
    let userPref = {liked: [], joined: [], held:[]};
    result.preference.forEach(function(p){
        if(p.status==="liked"){userPref.liked.push(p.actl_id);}
        else if(p.status==="joined"){userPref.joined.push(p.actl_id);}
        else if(p.status==="held"){userPref.held.push(p.actl_id);}
    });
    localStorage.setItem("preference", JSON.stringify(userPref));
}
function removeUserData(){
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('provider');
    localStorage.removeItem('preference');
    localStorage.removeItem('icon');
}
function enterListener(event){
    if(event.keyCode===13){
        if(event.target.id==="sign-in-password"){signin();}
        if(event.target.id==="sign-up-password-2"){signup();}
    }
}
function updatePrefOnLocal(actl_id, item, action){
    if(item==='like'){item='liked';}
    if(item==='join'){item='joined';}
    let pref = JSON.parse(localStorage.getItem('preference'));
    if(action==='add'){pref[item].push(actl_id)}
    else if(action==='delete'){pref[item] = pref[item].filter(p=>p!=actl_id)}
    localStorage.setItem('preference', JSON.stringify(pref));
}

// -- Misc -- //
function timeFormatter(time, ymdFormat, hmsFormat){
    let ymd = time.split('T')[0].split('-');
    let hms = time.split('T')[1].split(':');
    hms.pop();
    let finalArr = [];
    if(ymdFormat.includes('y')) finalArr.push(ymd[0]);
    if(ymdFormat.includes('m')) finalArr.push(ymd[1]);
    if(ymdFormat.includes('d')) finalArr.push(ymd[2]);
    let finalYMD = finalArr.join('-')+' ';
    finalArr = [];
    if(hmsFormat.includes('h')) finalArr.push(hms[0]);
    if(hmsFormat.includes('m')) finalArr.push(hms[1]);
    if(hmsFormat.includes('s')) finalArr.push(hms[2]);
    let finalHMS = finalArr.join(':');

    return finalYMD+finalHMS;
}
function clearS(selectorArr){
    selectorArr.forEach(s=>getElement(s).value="");
}
function alertBox(message, showCancel){
    getElement('#alert-cancel').removeEventListener('click', closeAlert);
    getElement('#alert-confirm').removeEventListener('click', closeAlert);
    getElement('#close-alert').removeEventListener('click', closeAlert);

    return new Promise(function(resolve, reject){
        switchElementView('#modal-alert', 'flex');
        getElement('#alert-text').innerHTML=message;

        getElement('#alert-confirm').addEventListener('click', function(){
            closeAlert();
            resolve(true);
        });
        getElement('#close-alert').addEventListener('click', function(){
            closeAlert();
            resolve(false);
        });
        if(showCancel){
            getElement('#alert-cancel').style.display = 'flex';
            getElement('#alert-cancel').addEventListener('click', function(){
                closeAlert();
                resolve(false);
            });
        }else{
            getElement('#alert-cancel').style.display = 'none';
        }
    });
}
function randomNoGen(upper){
	return Math.floor(Math.random()*parseInt(upper));
}
function activateCardAnimation(event){
    let actl_id = event.target.id.split('-')[1];
    if(actl_id){
        document.querySelector(`#card-${actl_id}`).classList.add('actl-card-active');
        window.setTimeout(function(){
            document.querySelector('.actl-card-active').classList.remove('actl-card-active')
        }, 3000);
    }
}