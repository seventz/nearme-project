// -- Initialize -- //
function init(){
    initListeners();
    loadMap();
    initPage();
    window.fbAsyncInit = fbInit;
}
if(document.readyState !== "loading"){init();}
else{document.addEventListener("DOMContentLoaded", init);}
// -- Main -- //
function initPage(){
    initUserStatus();
    initMain();
}
function initMain(){
    initUrl();
    initVisitedStatus();
    initFilters();
    initMap();
    switchSearchMode();
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
// Set up user id token for search cache identification // 
function setUserIdToken(user_id){
    localStorage.setItem('id_token', user_id ? user_id : `guest_${randomNoGen(10000)}`);
}
// -- Utils -- //
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
    getElement('#btn-filters').addEventListener('click', function(){
        renderMainView('all', getFilters());
    });
    getElement('#ac-time-switch').addEventListener('click', function(){
        getElement('#ac-t-start').classList.toggle('hide');
        getElement('#ac-t-end').classList.toggle('hide');        
    });
    getElement('#checkbox-realtime-render').addEventListener('click', function(event){
        main.map = new google.maps.Map(getElement('#map'), mapOptions);
        main.listener = setMapListener(event.target.checked ? {filters:'on'} : null);
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
            renderMainView('all', getFilters());
        });
    })
    getElement('#btn-anywhere').addEventListener('click', function(){
        getElement('.bg-landing').className = 'bg-landing-hide';
        window.setTimeout(function(){
            switchElementView('.bg-landing-hide', 'none')
        }, 1000);
        renderMainView('all', getFilters());
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
        let filters = {
            cat: 'official',
            center: Object.values(main.defaultCenter).join(','),
            dist: 5000,
            owner: '',
            type: '',
            listing: getElement('#listing-filter').value,
            paging: 0
        };
        getElement('#cat-filter').value = filters.cat;
        getElement('#dist-filter').value = (filters.dist)/1000;
        getElement('#dist').innerHTML = (filters.dist)/1000 + '公里';
        renderMainView('all', filters);
    });
    getElement('#dist-filter').addEventListener('input', function(){
        getElement('#dist').innerHTML = this.value + '公里';
    })
    getElement('#cat-filter').addEventListener('change',function(){
        if(!this.value){return;}
        let typeFilter = getElement('#type-filter');
        while(typeFilter.children.length>1){
            typeFilter.removeChild(typeFilter.lastChild);
        }
        getType(this.value).then(function(data){
            data.forEach(function(d){
                createElement('OPTION', {atrs:{
                    value: d,
                    innerHTML: d
                }}, typeFilter);
            })
        })
    })
    getElement('#listing-filter').addEventListener('change', function(){
        renderMainView('all', getFilters());
    })
    getElement('#advanced-search').addEventListener('click', function(){
        getElement('.adv-arrow').classList.toggle('active');
        getElement('#search-activity-container').classList.toggle('show');
    });
    getElement('#search-activity').addEventListener('click', function(){
        if(!misc.searchActivityId){return;}
        renderMainView('id', misc.searchActivityId)
        misc.searchActivityId = '';
    })
    getElement('#clear-search').addEventListener('click', function(){
        clearValue(['#search-main']);
        renderMainView('all', misc.lastSearch);
    })
    getElement('#user-info').addEventListener('click', showUserInfo);
    getElement('#logout').addEventListener('click', logout);
    getElement('#user-activity-manager').addEventListener('click', function(){
        showWatchList(misc.currentTab);
    });
}
function initUserStatus(){
    requestUserData().then(function(result){
        setUserData(result);
        switchProfileIcon('show');
        renderMainView('all', getFilters());
    }).catch(function(){
        setUserIdToken();
        removeUserData();
        switchProfileIcon('hide');
        renderMainView('all', getFilters());
    });
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
function switchProfileIcon(status){
    removeChildOf('#nav-profile');
    if(status==='show'){
        createElement('IMG', {atrs:{
            src: 'img/profile.png',
        }, evts:{
            click: showProfilePage
        }}, getElement('#nav-profile'));
    }else if(status==='hide'){
        createElement('DIV', {atrs:{
            textContent: '登入'
        }, evts:{
            click: showSignInForm
        }}, getElement('#nav-profile'));
    }
}

// -- Main -- //
function renderMainView(mode, fields){
    getActivityData(mode, fields).then(function(result){
        renderMainList(result);
        main.markers = renderMarkers(result);
        addInfoWindow(main.markers, result);
    });
    panToLocation(main.currentLocation);
}
function getFilters(){
    let center = `${main.currentLocation.lat},${main.currentLocation.lng}`;
    let dist = getElement('#dist-filter').value;
    let cat = getElement('#cat-filter').value;
    let type = getElement('#type-filter').value;
    let listing = getElement('#listing-filter').value;
    return {
        center: center,
        dist: dist*1000,
        cat: cat,
        owner: cat!='custom' ? type : '',
        type: cat==='custom' ? type : '',
        listing: listing,
        paging: 0
    }
}
function switchMainView(element){
    getElement('.main-map').className = "main-map";
    getElement('.main-list').className = "main-list";
    if(element.id==='view-map'){
        getElement('.main-map').classList.add('show');
        getElement('.main-list').classList.add('hide');
    }else if(element.id==='view-card'){
        getElement('.main-map').classList.add('hide');
        getElement('.main-list').classList.add('show');
    }
}
function renderMainList(result){
    // Show activity entries
    let entries = result.info.entries
    getElement('#activity-counts').innerHTML = entries===0 ? `沒有搜尋結果...` : `共有 <strong>${entries}</strong> 筆搜尋結果`
    // Create cards
    renderCards(result.data);
    // dummy div
    createElement("DIV", {stys:{
        height: '20px',
        width: '100%'
    }}, getElement('#activity-list'));
    // Create pages
    renderPages(result.info);
}
function renderCards(data){
    removeChildOf('#activity-list');
    let preference = JSON.parse(localStorage.getItem('preference'));
    let actlCard, cardImg, content, footer, owner, 
    ownerWrapper, header, main, footerLeft, footerRight;
    for(let i=0; i<data.length; i++){
        actlCard = createElement('DIV', {atrs:{
            id: `card-${data[i].actl_id}`,
            className: `actl-card`
        }}, getElement('#activity-list'));
        
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

        let heart = createElement("IMG", {atrs:{
            id: `like-${data[i].actl_id}`,
            className: 'actl-card-favorite icon-30 hover-effect',
            src: '../img/favorite.png',
        }}, footerRight);
        if(preference && preference.liked.includes(data[i].actl_id)){
            heart.src = '../img/favorite-filled.png';
        }
        heart.addEventListener('click', function(){
            likeActivity(data[i].actl_id);
        })
    }
}
function renderPages(info){
    removeChildOf('#page-container');
    let {entries, listing, paging, pageCount, query} = info;
    let currentPage = parseInt(paging)+1;
    let lastPage = Math.floor((entries-1)/listing)+1;
    let pageTabs = Math.floor((lastPage-1)/pageCount)+1;
    let currentPageTab = Math.floor((currentPage-1)/pageCount)+1;
    let currentPageCount = (lastPage < pageCount) ? lastPage : pageCount;

    let pageContainer = getElement('#page-container');
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
        className: 'page-count'
    }}, pageContainer);
    
    let pageCountStart = (currentPageTab-1)*currentPageCount+1;
    let pageCountEnd = (pageCountStart+pageCount-1)>lastPage ? lastPage : pageCountStart+pageCount-1;

    for(let i=pageCountStart; i<=pageCountEnd; i++){
        createElement('DIV', {atrs:{
            id: `page-${i}`,
            className: 'page-box',
            textContent: i,
        }}, pageCountDIV);
        if(i!=currentPage){
            getElement(`#page-${i}`).addEventListener('click', function(){
                renderMainViewByPage(query, i);
            })
        }
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
        pagePrev.addEventListener('click', function(){
            renderMainViewByPage(query, currentPage-1);
        });
    }else{
        pagePrev.classList.add('disabled');
    }
    if(currentPage != lastPage){
        pageNext.addEventListener('click', function(){
            renderMainViewByPage(query, currentPage+1);
        });
    }else{
        pageNext.classList.add('disabled');
    }
    if(currentPage/currentPageCount > 1){
        pagePrevAll.addEventListener('click', function(){
            renderMainViewByPage(query, currentPage-pageCount);
        });
    }else{
        pagePrevAll.classList.add('disabled');
    }
    if(currentPageTab < pageTabs){
        pageNextAll.addEventListener('click', function(){
            renderMainViewByPage(query, currentPage+pageCount);
        });
    }else{
        pageNextAll.classList.add('disabled');
    }
    getElement(`#page-${currentPage}`).classList.add('disabled')
}
function renderMainViewByPage(query, page){
    query.paging = page-1;
    renderMainView('all', query);
}

// -- User profile -- //
function showProfilePage(){
    requestUserData().then(function(result){
        getElement('#profile-picture').src = result.data.profile_pic ? result.data.profile_pic : 'img/user.png';
        showUserInfo(result);
        switchElementView('#modal-profile', 'flex');
    }).catch(function(error){
        alertBox("請先登入會員").then(function(){
            initPage();
        });
    });
}
async function showUserInfo(result){
    // -- Reset content -- //
    removeChildOf('.profile-content');

    createElement('DIV', {atrs:{
        className: 'profile-title'
    }}, getElement('.profile-content'));
    createElement('P', {atrs:{
        textContent: '個人資訊'
    }}, getElement('.profile-title'));
    
    // -- get data within this function scope -- //
    let data, preference;
    if(Object.keys(misc.user).length!=0){
        data = misc.user.data;
        preference = misc.user.preference
    }else if(result){
        data = result.data;
        preference = result.preference;
    }else{
        result = await requestUserData();
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
        }}, getElement('.profile-content'));
        createElement('DIV', {atrs:{
            className: 'info-title',
            innerHTML: userObj[i].title
        }}, getElement(`.p-u-${i}`));
        createElement('DIV', {atrs:{
            className: 'info-content',
            innerHTML: userObj[i].content
        }}, getElement(`.p-u-${i}`));
    }
    
    createElement('DIV', {atrs:{
        id: 'flat-icon-credit',
        innerHTML: '<div>Icons made by&nbsp</div><a href="https://www.flaticon.com/authors/roundicons" title="Roundicons"><div>Roundicons&nbsp</div></a><div>from&nbsp</div><a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a>'
    }, stys:{
        fontSize: '0.8em',
        display: 'none'
    }}, getElement('.p-u-3'));

    createElement('DIV', {atrs:{
        className: 'profile-last'
    }}, getElement('.profile-content'));
    createElement('BUTTON', {atrs:{
        id: 'edit-profile',
        className: 'btn btn-altered',
        textContent: 'Edit'
    }, evts:{
        click: showEdit
    }}, getElement('.profile-last'));
    
}
function showEdit(){
    modifyElement(getElement('.p-u-2>.info-title'), {atrs:{
        textContent: "New name...",
    }, stys:{
        backgroundColor: "#f89b4f" 
    }}, getElement('.p-u-2'));

    let name = getElement('.p-u-2>.info-content').textContent;
    getElement('.p-u-2').removeChild(getElement('.p-u-2>.info-content'))
    createElement('INPUT', {atrs:{
        className: 'info-content input-effect',
        value: name
    }}, getElement('.p-u-2'));


    modifyElement(getElement('.p-u-3>.info-title'), {atrs:{
        textContent: "Choose one...",
    }, stys:{
        backgroundColor: "#f89b4f" 
    }}, getElement('.p-u-3'));

    for(let i=0; i<7; i++){
        let randomNo = randomNoGen(96);
        let icon = createElement('IMG', {atrs:{
            id: `icon/${randomNo}`,
            className: 'icon-48 hover-effect',
            src: `../img/icon/${randomNo}.png`
        }}, getElement('.p-u-3>.info-content'));

        icon.addEventListener('click', function(){
            let nodes = getElementAll('.info-content>img');
            Array.from(nodes).forEach(n=>n.class='icon-48 hover-effect');
            this.className = "icon-48 selected";
        })
    }

    switchElementView('#flat-icon-credit', 'flex');

    modifyElement(getElement('#edit-profile'), {atrs:{
        id: 'close-edit-profile',
        className: 'btn btn-submit',
        textContent: 'OK'
    }, evts:{
        click: closeEdit
    }}, getElement('.profile-last'));
    getElement('#close-edit-profile').removeEventListener('click', showEdit)
}
function closeEdit(){
    let updateData = {};
    let nameDiv = getElement('.p-u-2');
    let nameContent = getElement('.p-u-2>.info-content');
    let nameTitle = getElement('.p-u-2>.info-title');
    
    let newName = nameContent.value;
    if(newName != misc.user.data.name){
        updateData.name = newName;
    }
    
    nameDiv.removeChild(nameContent)
    createElement('DIV', {atrs:{
        className: 'info-content',
        textContent: newName
    }}, nameDiv);
    
    modifyElement(nameTitle, {atrs:{
        textContent: "Name",
    }, stys:{
        backgroundColor: "#afafaf" 
    }}, nameDiv);
    
    let iconDiv = getElement('.p-u-3>.info-content');
    let selectedIcon = getElement('.info-content>img.selected');
    if(!selectedIcon){
        while(iconDiv.children.length>1){
            iconDiv.removeChild(iconDiv.lastChild);
        }
    }else{
        removeChildOf('.p-u-3>.info-content');
        createElement('IMG', {atrs:{
            className: 'icon-48',
            src: `../img/${selectedIcon.id}.png`
        }}, iconDiv);
        updateData.icon = selectedIcon.id;
    }
    switchElementView('#flat-icon-credit', 'none');

    modifyElement(getElement('.p-u-3>.info-title'), {atrs:{
        textContent: "Icon",
    }, stys:{
        backgroundColor: "#afafaf" 
    }}, getElement('.p-u-3'));
    


    modifyElement(getElement('#close-edit-profile'), {atrs:{
        id: 'edit-profile',
        className: 'btn btn-altered',
        textContent: 'Edit'
    }, evts:{
        click: showEdit
    }}, getElement('.profile-last'));
    getElement('#edit-profile').removeEventListener('click', closeEdit);

    // Update data if any change
    if(Object.keys(updateData).length>0){
        updateUserData(updateData).then(function(result){
            if(result.status===200){
                for(let key in updateData){
                    misc.user.data[key] = updateData[key];
                }
                alertBox("資料已更新！");
            }
        }).catch(function(result){
            if(result.status===500){
                alertBox("資料更新失敗，請稍後再試。");
            }
        });
    }
}
function showWatchList(tabName){    
    // -- Reset content -- //
    let profileContent = getElement('.profile-content');
    removeChildOf('.profile-content');
    createElement('DIV', {atrs:{
        className: 'profile-title'
    }}, profileContent);
    createElement('P', {atrs:{
        textContent: '管理活動'
    }}, getElement('.profile-title'));

    let panel = createElement('DIV', {atrs:{
        className: "user-actl-panel"
    }}, profileContent);
    let tab = createElement('DIV', {atrs:{
        className: "user-actl-tab flex-r-st"
    }}, panel);
    let likedTab = createElement('DIV', {atrs:{
        id: 'user-actl-tab-liked',
        textContent: '關注'
    }}, tab);
    let joinedTab = createElement('DIV', {atrs:{
        id: 'user-actl-tab-joined',
        textContent: '參加'
    }}, tab);
    let heldTab = createElement('DIV', {atrs:{
        id: 'user-actl-tab-held',
        textContent: '舉辦'
    }}, tab);
    createElement('DIV', {atrs:{
        className: 'user-actl-container'
    }}, profileContent);
    likedTab.addEventListener('click', function(){
        generateWatchContent('liked');
    });
    joinedTab.addEventListener('click', function(){
        generateWatchContent('joined');
    });
    heldTab.addEventListener('click', function(){
        generateWatchContent('held');
    });
    
    // default management tab view
    tabName ? generateWatchContent(tabName) : generateWatchContent('liked');
}
async function generateWatchContent(tabName){
    // Store current tab infomation
    misc.currentTab = tabName;

    // Reset tab view
    let tabs = getElementAll('.user-actl-tab>div');
    Array.from(tabs).map(t=>t.className='');
    getElement(`#user-actl-tab-${tabName}`).classList += 'active';
    removeChildOf('.user-actl-container');

    // Create main frame
    let preference = JSON.parse(localStorage.getItem('preference'));
    let detail = await getUserActivities(preference[tabName].join(","));
    let title = createElement('DIV', {atrs:{
        className: 'flex-r-b'
    }}, getElement('.user-actl-container'));
    createElement('DIV', {stys:{width: '60px'}}, title);
    createElement('DIV', {atrs:{
        className: 'user-actl-list-title',
        innerHTML: mgmtText(tabName, detail.length)
    }}, title);
    let imgDiv = createElement('DIV', '', title);
    let eyeView = createElement('IMG', {atrs:{
        id: 'edit-visible',
        className: 'icon-24 hover-effect',
        src:"../img/visible.png"
    }, stys:{
        margin: '0px 3px'
    }}, imgDiv);
    let editPen = createElement('IMG', {atrs:{
        className: 'icon-24 hover-effect',
        src:"../img/edit.png"
    }, stys:{
        margin: '0px 3px'
    }}, imgDiv);
    createElement('DIV', {atrs:{
        className: 'user-actl-list'
    }}, getElement('.user-actl-container'));
    
    // Show remove icon
    editPen.addEventListener('click', function(){
        let crosses = getElementAll('.user-actl-card>img');
        Array.from(crosses).forEach(c=>c.classList.toggle('hide'));
    });
    
    // Not showing passed activities
    eyeView.addEventListener('click', function(event){
        let element = event.target;
        let status = element.id.split('-')[1];
        let allCards = Array.from(getElementAll('.user-actl-list>div'));
        let oldCards = allCards.filter(n=>n.classList.contains('old-card'));
        getElement('.user-actl-list-title').innerHTML=mgmtText(tabName, allCards.length, 'visible');
        if(status==='invisible'){
            element.id = `edit-visible`;
            element.src = `../img/visible.png`;
            oldCards.forEach(o=>o.style.display='flex');
        }else{
            getElement('.user-actl-list-title').innerHTML=mgmtText(tabName, allCards.length-oldCards.length, 'invisible');
            element.id = `edit-invisible`;
            element.src = `../img/invisible.png`;
            oldCards.forEach(o=>o.style.display='none');
        }
    })
    
    renderUserActivityList(detail);
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
}
function renderUserActivityList(detail){
    // Get tab name from memory
    let tabName = misc.currentTab;
    for(let i=0; i<detail.length; i++){
        let card = createElement('DIV', {atrs:{
            id: `${tabName}-${detail[i].actl_id}`,
            className: `user-actl-card ${(new Date(detail[i].t_start)) > Date.now() ? 'new-card' : 'old-card'}`
        }}, getElement('.user-actl-list'));
        createElement('DIV', {atrs:{
            className: 'user-card-no',
            textContent: i+1
        }}, card);
        let content = createElement('DIV', {atrs:{className: 'user-card-content flex-r-b'}}, card);
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
            let editor = createElement('IMG', {atrs:{
                id: `${tabName}-${detail[i].actl_id}-edit`,
                className: 'icon-24 hover-effect hide',
                src:'../img/document.png'
            }}, card);
            editor.addEventListener('click', function(){
                generateActivityEditor(detail[i].actl_id);
            });
        }

        let cross = createElement('IMG', {atrs:{
            id: `${tabName}-${detail[i].actl_id}-delete`,
            className: 'icon-24 hover-effect hide',
            src:'../img/delete-r.png'
        }}, card);
        cross.addEventListener('click', function(){
            removeActivity(detail[i].actl_id, tabName);
        });
    }
}

// -- Upload -- //
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
    if(status===false){return;}

    switchElementView('#modal-loading', 'flex');
    uploadProfileImage(imgObj.data, {
        filename: 'profile',
        user_id: misc.user.data.user_id
    }).then(function(result){
        switchElementView('#modal-loading', 'none');
        alertBox("上傳圖片成功！").then(function(){
            getElement('#profile-picture').src = result.data;
        });
    }).catch(function(result){
        switchElementView('#modal-loading', 'none');
        switch(result.status){
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
    });
}

// -- Activity -- //
function renderActivityContent(result){
    let content = result.data.content;
    let members = result.data.member;

    getElement('#ac-img').src=content.main_img || 'img/bg/explorer.jpg';
    getElement('#ac-title').innerHTML=content.title;
    getElement('#ac-t-start').innerHTML=content.t_start ? `開始時間: ${timeFormatter(content.t_start, 'ymd', 'hm')}` : "(開始時間未定)";
    getElement('#ac-t-end').innerHTML= content.t_end ? `結束時間: ${timeFormatter(content.t_end, 'ymd', 'hm')}`: "(結束時間未定)";
    getElement('#ac-type').innerHTML=content.actl_type ? content.actl_type : "(未分類)" ;
    getElement('#ac-description').innerHTML=content.description;
    getElement('#ac-address').innerHTML=content.address || "(無地址資訊可顯示)";
    
    getElement('#ac-ref>a').innerHTML=content.ref;
    getElement('#ac-ref>a').href=content.ref;

    removeChildOf('#ac-going-list');
    removeChildOf('#ac-footer-btn');
    if(content.category==='official'){
        getElement('#ac-owner').innerHTML=content.owner;
        getElement('#ac-footer-info').innerHTML=`※此為官方活動 ${content.free===0 ? "，並且可能必須付費" : ""}。詳情請參考連結。`;
    }else if(content.category==='custom'){
        getElement('#ac-owner').innerHTML=members.filter(m=>m.status==='held')[0].name;
        getElement('#ac-footer-info').innerHTML="";
    }

    let isJoined = false;
    for(let i=0; i<members.length; i++){
        createElement("DIV", {atrs:{
            className: `tip tip-${i}`
        }}, getElement('#ac-going-list'));
        createElement('IMG', {atrs:{
            id: members[i].name,
            className: 'icon-30',
            src: members[i].icon           
        }}, getElement(`.tip-${i}`));
        createElement("DIV", {atrs:{
            className: 'tiptext',
            textContent: members[i].name
        }}, getElement(`.tip-${i}`));

        if(misc.user.data && members[i].user_id === misc.user.data.user_id){
            isJoined = true;
        }
    }

    createElement('BUTTON', {atrs:{
        className: "btn btn-cancel ac-cancel",
        textContent: 'Cancel'
    }, evts:{
        click: closeActivityContent
    }}, getElement('#ac-footer-btn'));
    let joinBtn = createElement('BUTTON', {atrs:{
        className: "btn ac-join",
        textContent: isJoined ? "Joined" : "join"
    }}, getElement('#ac-footer-btn'));
    if(isJoined){
        joinBtn.classList.add('btn-faded');
    }else{
        joinBtn.classList.add('btn-submit');
        joinBtn.addEventListener('click', function(){
            joinActivity(content.actl_id)
        });
    }

    if(content.lat){
        modal.map = new google.maps.Map(getElement('#ac-map'), {
            zoom: 14,
            disableDefaultUI: true,
            center: {lat: content.lat, lng: content.lng}
        });
        modal.marker = new google.maps.Marker({
            position: {lat: content.lat, lng: content.lng},
            map: modal.map
        });
    }else{
        getElement('#ac-map').innerHTML = "(無地點資訊可顯示)"
    }
}
function joinActivity(actl_id){
    switchElementView('#modal-loading', 'flex');
    updateActivityStatus(actl_id, 'join').then(function(result){
        switchElementView('#modal-loading', 'none');
        if(result.message==='added'){
            updatePreference(actl_id, 'joined', 'add');
            alertBox("成功加入此活動！").then(function(){
                switchElementView('#modal-activity-content', 'none');
            });
        }
    }).catch(function(result){
        switchElementView('#modal-loading', 'none');
        showErrorMsg(result).then(function(){
            switchElementView('#modal-activity-content', 'none');
        });
    })
}
function likeActivity(actl_id){
    switchElementView('#modal-loading', 'flex');
    updateActivityStatus(actl_id, 'like').then(function(result){
        switchElementView('#modal-loading', 'none');
        if(result.message==='added'){
            updatePreference(actl_id, 'liked', 'add');
            getElement(`#like-${actl_id}`).src = '../img/favorite-filled.png';
            alertBox("已加入關注！");
        }else if(result.message==='removed'){
            updatePreference(actl_id, 'liked', 'delete');
            getElement(`#like-${actl_id}`).src = '../img/favorite.png';
            alertBox("已取消關注！");
        }
    }).catch(function(result){
        switchElementView('#modal-loading', 'none');
        showErrorMsg(result).then(function(){
            switchElementView('#modal-activity-content', 'none');
        });
    });
}
async function removeActivity(actl_id, action){
    let status = await alertBox('確定移除此活動?', 'showCancel');
    if(status===false) return;

    switchElementView('#modal-loading', 'flex');
    updateActivityStatus(actl_id, action).then(function(result){
        triggerStatusChange();
        switchElementView('#modal-loading', 'none');
        updatePreference(actl_id, action, 'delete');
        alertBox('成功移除此活動').then(function(){
            showWatchList(action);
        });
    }).catch(function(result){
        switchElementView('#modal-loading', 'none');
        showErrorMsg(result).then(function(){
            switchElementView('#modal-activity-content', 'none');
        });
    });
}
function showErrorMsg(data){
    switch(data.status){
        case 400:
            return alertBox("請求格式錯誤。");
        case 401: case 403:
            return alertBox("請重新登入。");
        case 500:
            return alertBox("系統繁忙，請稍後再試。");
    }
}

// -- Search -- //
function switchSearchMode(){
    let status = getElement('#switch-search-mode').checked;
    removeChildOf('#search-container');
    getElement('.adv-search-mode').textContent = status===true ? "即時" : "關鍵字" ;
    createElement('INPUT', {atrs:{
        id: 'search-main',
        className: 'search-box input-effect',
        type: 'text',
        placeholder: status===true ? "輸入任意字串即時搜尋..." : "輸入關鍵字，以符號隔開搜尋..."
    }, evts:{
        input: status===true ? realtimeSearch : keywordSearch
    }}, getElement('#search-container'));
    createElement('DIV', {atrs:{
        id: 'search-main-items',
        className: 'autocomplete-items',
        type: 'text'
    }}, getElement('#search-container'));
}
function autoCompleteType(event){
    let word = event.target.value.toLowerCase();
    let fitTypes = misc.customType.filter(t=>t.toLowerCase().includes(word));
    let typelist = getElement('#activity-planner-type');
    removeChildOf('#activity-planner-type');
    if(fitTypes.length===0){
        createElement('DIV', {atrs:{
            textContent: '新增類型...'
        }, stys:{
            fontStyle: 'italic',
            color: 'grey'
        }}, typelist);
    }else{
        for(let i=0; i<fitTypes.length; i++){
            createElement('DIV', {atrs:{
                id: `type-${i}`,
                textContent: fitTypes[i]
            }}, typelist);
            getElement(`#type-${i}`).addEventListener('mouseover', function(){
                getElement('#actl-u-type').value = this.textContent;
            });
        }
    }
    addKeydownResetListener('#activity-planner-type');
    addClickResetListener('#activity-planner-type');
}

// -- User -- //
function showSignInForm(){
    switchElementView('#modal-sign-form', 'flex');
    let signContent = getElement('.sign-content');
    removeChildOf('.sign-content');
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
    }}, getElement('.sign-in-btn-group'));
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
    let signContent = getElement('.sign-content');
    removeChildOf('.sign-content');
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
    }}, getElement('.sign-in-btn-group'));
}
function signUpErrMsg(name, email, password, password2){
    if(name.length > 30){return "名稱太長，請輸入少於30個字。"}
    if(!email.includes('@')){return "請輸入正確的電子郵件。";}
    if(password != password2){return "請輸入相同的密碼。";}
    if(password.length < 6){return "請輸入至少六位密碼。";}
    return false;
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
    // store user data in memory
    misc.user = {
        data: result.data,
        preference: result.preference
    }
    // Set user id token for search cache
    setUserIdToken(result.data.user_id);
    localStorage.setItem('access_token', result.data.access_token);
    localStorage.setItem('provider', result.data.provider);
    let userPref = {liked: [], joined: [], held:[]};
    result.preference.forEach(function(p){
        if(p.status==="liked"){userPref.liked.push(p.actl_id);}
        else if(p.status==="joined"){userPref.joined.push(p.actl_id);}
        else if(p.status==="held"){userPref.held.push(p.actl_id);}
    });
    localStorage.setItem("preference", JSON.stringify(userPref));
}
function removeUserData(){
    misc.user = {};
    localStorage.removeItem('access_token');
    localStorage.removeItem('provider');
    localStorage.removeItem('preference');
}
function updatePreference(actl_id, item, action){
    if(item==='like'){item='liked';}
    if(item==='join'){item='joined';}
    let pref = JSON.parse(localStorage.getItem('preference'));
    if(action==='add'){pref[item].push(actl_id)}
    else if(action==='delete'){pref[item] = pref[item].filter(p=>p!=actl_id)}
    localStorage.setItem('preference', JSON.stringify(pref));
}

// -- Listeners -- //
function enterListener(event){
    if(event.keyCode===13){
        if(event.target.id==="sign-in-password"){signin();}
        if(event.target.id==="sign-up-password-2"){signup();}
    }
}
function addKeydownResetListener(selector){
    // Reset items when pressing 'tab', 'esc', or 'enter'
    document.addEventListener('keydown', resetItems);
    function resetItems(event){
        if(event.keyCode===13 || event.keyCode===9 || event.keyCode===27){
            removeChildOf(selector);
        }
        document.removeEventListener('keydown', resetItems)
    }
}
function addClickResetListener(selector){
    // Reset items when click anywhere on the screen
    document.addEventListener('click', resetItems);
    function resetItems(event){
        removeChildOf(selector);
        document.removeEventListener('click', resetItems)
    }
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
    let finalYMD = finalArr.join('-');
    finalArr = [];
    if(hmsFormat.includes('h')) finalArr.push(hms[0]);
    if(hmsFormat.includes('m')) finalArr.push(hms[1]);
    if(hmsFormat.includes('s')) finalArr.push(hms[2]);
    let finalHMS = finalArr.join(':');

    return finalYMD+' '+finalHMS;
}
function clearValue(selectorArr){
    selectorArr.forEach(s=>getElement(s).value="");
}
function triggerStatusChange(){
    renderMainView('all', getFilters());
}
function alertBox(message, showCancel){
    getElement('#alert-cancel').removeEventListener('click', closeAlert);
    getElement('#alert-confirm').removeEventListener('click', closeAlert);
    getElement('#close-alert').removeEventListener('click', closeAlert);

    return new Promise(function(resolve, reject){
        misc.enterListener = window.addEventListener('keyup', function(event){
            if(event.keyCode===13||event.keyCode===27){
                this.removeEventListener('keyup', misc.enterListener);
                closeAlert();
                if(event.keyCode===13){resolve(true);}
                if(event.keyCode===27){resolve(false);}
            }
        })
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
            switchElementView('#alert-cancel', 'flex');
            getElement('#alert-cancel').addEventListener('click', function(){
                closeAlert();
                resolve(false);
            });
        }else{
            switchElementView('#alert-cancel', 'none');
        }
    });
}
function randomNoGen(upper){
	return Math.floor(Math.random()*parseInt(upper));
}
function activateCardAnimation(event){
    let actl_id = event.target.id.split('-')[1];
    if(actl_id){
        getElement(`#card-${actl_id}`).classList.add('active');
        window.setTimeout(function(){
            getElement(`#card-${actl_id}`).classList.remove('active')
        }, 3000);
    }
}