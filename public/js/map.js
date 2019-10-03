function loadMap(){
    // Map options
    main.currentLocation = main.defaultCenter;
    // New map
    main.map = new google.maps.Map(document.getElementById('map'), mapOptions);
    main.bounds = new google.maps.LatLngBounds();

    // Initialize markers on the map
    main.listener = setMapListener(main);
}
function initMap(){
    clearAllMarkers();
    main.map.panTo(new google.maps.LatLng(main.defaultCenter));
}
function setMapListener(mainMapObj, options){
    mainMapObj.dynMarker = new google.maps.Marker({
        position: mainMapObj.currentLocation,
        map: mainMapObj.map,
    });
    google.maps.event.addListener(mainMapObj.map, 'click', function(event){
        if(mainMapObj.dynMarker){mainMapObj.dynMarker.setMap(null);}
        mainMapObj.dynMarker = new google.maps.Marker({
            position: event.latLng,
            map: mainMapObj.map,
        });
        mainMapObj.currentLocation.lat = event.latLng.lat();
        mainMapObj.currentLocation.lng = event.latLng.lng();
        mainMapObj.map.panTo(event.latLng);

        if(options && options.filters==='on'){renderMainView('all', getFilters());}
    });
}
function getUserLocation(){
    return new Promise(function(resolve, reject){
        let infoWindow = new google.maps.InfoWindow;
        navigator.geolocation.watchPosition(function(position) {
            console.log("i'm tracking you!");
          },
          function(error) {
            if (error.code == error.PERMISSION_DENIED)
              console.log("you denied me :-(");
          });
        if(navigator.geolocation){
            navigator.geolocation.getCurrentPosition(function(p){
                main.currentLocation.lat = p.coords.latitude;
                main.currentLocation.lng = p.coords.longitude;
                infoWindow.setPosition(main.currentLocation);
                infoWindow.setContent('<div style="font-weight: 600;">Start!</div>');
                infoWindow.open(main.map);
                
                resolve(main.currentLocation);
            }), function(){
                handleLocationError('Geolocation service failed.', main.map.center());
                console.log('not allowed here')
            }
        }else{
            handleLocationError('No geolocation available.', main.map.center());
            console.log('not allowed')
        }
    });
    function handleLocationError(content, position){
        infoWindow.setPosition(position);
        infoWindow.setContent(content);
        infoWindow.open(main.map);
    }
}
function initModalMap(){
    let options = {
        zoom: 14,
        center: (main.currentLocation.lat) ? main.currentLocation: main.defaultCenter
    };
    modal.map = new google.maps.Map(getElement('#map-modal'), options);
    google.maps.event.addListener(modal.map, 'click', function(event){
        if(!modal.marker){
            modal.marker = new google.maps.Marker({
                position: event.latLng,
                map: modal.map,
            });
        }else{
            modal.marker.setPosition(event.latLng)
        }
        modal.location.lat = event.latLng.lat();
        modal.location.lng = event.latLng.lng();
        modal.map.panTo(new google.maps.LatLng(modal.location.lat, modal.location.lng));
        getElement('#actl-u-place').value = showLatLng(event.latLng, 4);
    });
    modal.opened = true;
}
function switchMapMode(){
    let modalMap = document.querySelector('.modal-map');
    let hint = document.querySelector('#mode-hint');
    let input = document.querySelector('#actl-u-place');
    input.value = "";
    if(modal.opened){
        modalMap.style.display = 'none';
        modal.opened = false;
        hint.innerHTML = "輸入地點:";
        input.readOnly = false;
        input.style.background = 'white';
        input.placeholder = "Full address";
        input.className = "input-effect input-mode";
    }else{
        modalMap.style.display = 'flex';
        modal.opened = true;
        hint.innerHTML = "選擇地點:"
        input.readOnly = true;
        input.style.background = '#ccc';
        input.placeholder = "Choose on map";
        input.className = "input-effect choose-mode";
    }
}
function showLatLng(latLng, digits){
    return `${latLng.lat().toFixed(digits)}, ${latLng.lng().toFixed(digits)}`;
}
function renderMarkers(result){
    clearAllMarkers();
    if(result.data.length===0){return;}
    main.bounds = new google.maps.LatLngBounds();
    let markers = result.data.filter(function(d){
        return d.lat;
    }).map(function(d){
        main.bounds.extend({lat: d.lat, lng: d.lng});
        return new google.maps.Marker({
            position: {lat: d.lat, lng: d.lng},
            icon: iconPicker(d),
            id: d.actl_id,
            title: d.title,
            map: main.map
        });
    });
    main.map.fitBounds(main.bounds);
    
    zoomLevel = main.map.getZoom();
    main.map.setZoom(zoomLevel > 16 ? 16: zoomLevel); 
    return markers;
}
function clearAllMarkers(){
    if(main.pointerMarker){main.pointerMarker.setMap(null);}
    if(main.markers){main.markers.forEach(function(m){m.setMap(null);});}
}
function addInfoWindow(markers, result){
    if(!markers){return;}
    for(let i=0; i<markers.length; i++){
        let info = new google.maps.InfoWindow({
            content: decorateInfoWindow(result.data[i])
        });
        markers[i].addListener('click', function(){
            info.open(main.map, markers[i]);
        });
    }  
}
function decorateInfoWindow(data){
    return `
    <div style="max-width: 300px;">
        <div style="font-weight: 600; text-align: center; margin-bottom: 3px;">${data.title}</div>
        <div class="flex-r-ed">
            <img id="show-${data.actl_id}" class="icon-24" src="../img/show.png" style="cursor: pointer;" onclick="showActivityContent(event)">
            <a href="#card-${data.actl_id}"><img id="go-${data.actl_id}" class="icon-24" src="../img/enter.png" style="cursor: pointer;" onclick="activateCardAnimation(event)"></a>
        </div>
    </div>
    `
}
function iconPicker(data){
    let url = '';
    let scaledSize, origin, anchor;
    if(!data.scaledSize){
        scaledSize = new google.maps.Size(25, 25);
    }else{
        scaledSize = new google.maps.Size(data.scaledSize.width, data.scaledSize.height);
    }
    if(!data.origin){
        origin = new google.maps.Point(0, 0);
    }else{
        origin = new google.maps.Point(data.origin.x, data.origin.y);
    }
    if(!data.anchor){
        anchor = new google.maps.Point(0, 0);
    }else{
        anchor = new google.maps.Point(data.anchor.x, data.anchor.y);
    }

    switch(data.category){
        case 'official':
            url = `../img/${data.owner}.png`;
            break;
        case 'custom':
            url = `../img/user_default.png`;
            break;
        default:
            url = `../img/default_actl.png`;
            break;
    }
    if(data.setIcon){
        url = `../img/${data.setIcon}`;
    }
    return {
        url: url,
        scaledSize: scaledSize,
        origin: origin,
        anchor: anchor
    }
}
function panToLocation(latLng){
    if(main.dynMarker){main.dynMarker.setMap(null);}
    main.dynMarker = new google.maps.Marker({
        position: latLng,
        map: main.map,
    });

    main.currentLocation.lat = latLng.lat;
    main.currentLocation.lng = latLng.lng;
    main.map.panTo(latLng);
    main.bounds.extend(latLng);
    main.map.fitBounds(main.bounds);

    zoomLevel = main.map.getZoom();
    main.map.setZoom(zoomLevel > 16 ? 16: zoomLevel); 
}
function indicateLocation(event){
    if(event.target.id){
        let location = {
            lat: parseFloat(event.target.id.split(',')[0]),
            lng: parseFloat(event.target.id.split(',')[1])
        }
        let data = {setIcon: 'arrow.png', anchor:{x:0, y:30}}
        main.map.panTo(new google.maps.LatLng(location.lat, location.lng));
        if(!main.pointerMarker){
            main.pointerMarker = new google.maps.Marker({
                map: main.map,
                position: location,
                icon: iconPicker(data),
                animation: google.maps.Animation.BOUNCE
            });
        }else{
            main.pointerMarker.setPosition(new google.maps.LatLng(location.lat, location.lng))
        }
    }else{
        // error handling
    }
}
const mapStyle = [
    {
        elementType: "geometry",
        stylers: [{color: "#ebe3cd"}]
    },
    {
        elementType: "labels.text.fill",
        stylers: [{color: "#523735"}]
    },
    {
        elementType: "labels.text.stroke",
        stylers: [{color: "#f5f1e6"}]
    },
    {
        featureType: "administrative",
        elementType: "geometry.stroke",
        stylers: [{color: "#c9b2a6"}]
    },
    {
        featureType: "administrative.land_parcel",
        elementType: "geometry.stroke",
        stylers: [{color: "#dcd2be"}]
    },
    {
        featureType: "administrative.land_parcel",
        elementType: "labels.text.fill",
        stylers: [{color: "#ae9e90"}]
    },
    {
        featureType: "landscape.natural",
        elementType: "geometry",
        stylers: [{color: "#dfd2ae"}]
    },
    {
        featureType: "poi",
        elementType: "geometry",
        stylers: [{color: "#dfd2ae"}]
    },
    {
        featureType: "poi",
        elementType: "labels.text",
        stylers: [{"visibility": "off"}]
    },
    {
        featureType: "poi",
        elementType: "labels.text.fill",
        stylers: [{color: "#93817c"}]
    },
    {
        featureType: "poi.business",
        stylers: [{"visibility": "off"}]
    },
    {
        featureType: "poi.park",
        elementType: "geometry.fill",
        stylers: [{color: "#a5b076"}]
    },
    {
        featureType: "poi.park",
        elementType: "labels.text.fill",
        stylers: [{color: "#447530"}]
    },
    {
        featureType: "road",
        elementType: "geometry",
        stylers: [{color: "#f5f1e6"}]
    },
    {
        featureType: "road",
        elementType: "labels.icon",
        stylers: [{"visibility": "off"}]
    },
    {
        featureType: "road.arterial",
        elementType: "geometry",
        stylers: [{color: "#fdfcf8"}]
    },
    {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{color: "#f8c967"}]
    },
    {
        featureType: "road.highway",
        elementType: "geometry.stroke",
        stylers: [{color: "#e9bc62"}]
    },
    {
        featureType: "road.highway.controlled_access",
        elementType: "geometry",
        stylers: [{color: "#e98d58"}]
    },
    {
        featureType: "road.highway.controlled_access",
        elementType: "geometry.stroke",
        stylers: [{color: "#db8555"}]
    },
    {
        featureType: "road.local",
        elementType: "labels.text.fill",
        stylers: [{color: "#806b63"}]
    },
    {
        featureType: "transit",
        stylers: [{"visibility": "off"}]
    },
    {
        featureType: "transit.line",
        elementType: "geometry",
        stylers: [{color: "#dfd2ae"}]
    },
    {
        featureType: "transit.line",
        elementType: "labels.text.fill",
        stylers: [{color: "#8f7d77"}]
    },
    {
        featureType: "transit.line",
        elementType: "labels.text.stroke",
        stylers: [{color: "#ebe3cd"}]
    },
    {
        featureType: "transit.station",
        elementType: "geometry",
        stylers: [{color: "#dfd2ae"}]
    },
    {
        featureType: "water",
        elementType: "geometry.fill",
        stylers: [{color: "#b9d3c2"}]
    },
    {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{color: "#92998d"}]
    }
];

const mapOptions = {
    zoom: 15,
    center: main.defaultCenter,
    styles: mapStyle
};
exports={
    mapStyle: mapStyle,
    mapOptions: mapOptions
}