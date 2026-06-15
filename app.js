// Updated version placeholder with requested changes to be integrated.
const BUS_NUMBER =
    localStorage.getItem(
        "busNumber"
    ) || "Unknown";
import {
    db,
    ref,
    set,
    get,
    onValue
} from "./firebase.js";

/* ---------------- GLOBALS ---------------- */

let map;
let trafficLayer;
let busMarker;
let routeLine;

let isDriver = false;
let sessionId =
    localStorage.getItem("sessionId") ||
    crypto.randomUUID();

localStorage.setItem(
    "sessionId",
    sessionId
);

/* ---------------- UI ---------------- */

const roleStatus =
    document.getElementById("roleStatus");

const distanceEl =
    document.getElementById("distance");

const speedEl =
    document.getElementById("speed");

const durationEl =
    document.getElementById("duration");

const stopCountEl =
    document.getElementById("stopCount");

const startBtn =
    document.getElementById("startBtn");

const stopBtn =
    document.getElementById("stopBtn");

const stopList =
    document.getElementById("stopList");

const tripHistory =
    document.getElementById("tripHistory");

/* ---------------- MAP ---------------- */

async function initMap() {

    console.log("MAP LOADED");

    map = new google.maps.Map(
        document.getElementById("map"),
        {
            center:{
                lat:17.3850,
                lng:78.4867
            },
            zoom:13
        }
    );

    trafficLayer =
        new google.maps.TrafficLayer();

    trafficLayer.setMap(map);

    routeLine =
        new google.maps.Polyline({
            map:map,
            path:[],
            strokeColor:"#2563eb",
            strokeWeight:5
        });

    busMarker =
        new google.maps.Marker({
            map:map,
            position:{
                lat:17.3850,
                lng:78.4867
            },
            title:"College Bus"
        });

    await assignRole();

    listenLiveLocation();

    loadTripHistory();

    onValue(
        ref(db, "currentTrip/route"),
        snapshot => {

            if (isDriver) return;

            const data = snapshot.val();

            if (!data || !routeLine) return;

            const points = Array.isArray(data)
                ? data
                : Object.values(data);

            routeLine.setPath(points);

            if (points.length > 0) {
                map.panTo(points[points.length - 1]);
            }
        }
    );
};

/* ---------------- DRIVER / VIEWER ---------------- */


async function assignRole(){

    const driverRef = ref(db,"activeDriver");

    try{

        const snapshot = await get(driverRef);
        const activeDriver = snapshot.val();

        if(!activeDriver){

            await set(driverRef, sessionId);

            isDriver = true;

            roleStatus.innerHTML =
                '<span class="role-driver">Driver</span>';

            return;
        }

        if(activeDriver === sessionId){

            isDriver = true;

            roleStatus.innerHTML =
                '<span class="role-driver">Driver</span>';

            return;
        }

        isDriver = false;

        roleStatus.innerHTML =
            '<span class="role-viewer">Viewer</span>';

        startBtn.disabled = true;
        stopBtn.disabled = true;

    }catch(err){

        console.error(err);

        isDriver = true;

        roleStatus.innerHTML =
            '<span class="role-driver">Driver</span>';
    }
}

/* ---------------- LIVE LOCATION ---------------- */

function listenLiveLocation(){

    onValue(

        ref(
            db,
            "liveLocation"
        ),

        snapshot=>{

            const data =
                snapshot.val();

            if(!data)
                return;

            const point = {
                lat:data.lat,
                lng:data.lng
            };

            busMarker.setPosition(
                point
            );

            speedEl.textContent =
                data.speed || 0;

            map.panTo(point);
        }
    );
}

/* ---------------- TRACKING GLOBALS ---------------- */

let watchId = null;
let tripStartTime = null;

let routePoints = [];
let stopMarkers = [];

let totalDistance = 0;
let stopCount = 0;

let stopStart = null;

/* ---------------- DISTANCE ---------------- */

function haversine(
    lat1,
    lon1,
    lat2,
    lon2
){

    const R = 6371;

    const dLat =
        (lat2-lat1) *
        Math.PI / 180;

    const dLon =
        (lon2-lon1) *
        Math.PI / 180;

    const a =
        Math.sin(dLat/2) *
        Math.sin(dLat/2) +

        Math.cos(
            lat1*Math.PI/180
        ) *

        Math.cos(
            lat2*Math.PI/180
        ) *

        Math.sin(dLon/2) *
        Math.sin(dLon/2);

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1-a)
        );

    return R * c;
}

/* ---------------- BUTTONS ---------------- */

startBtn.addEventListener(
    "click",
    startTracking
);

stopBtn.addEventListener(
    "click",
    stopTracking
);

/* ---------------- START TRACKING ---------------- */

function startTracking(){

    if(!isDriver){

        alert(
            "Only driver can track."
        );

        return;
    }

    if(watchId){

        alert(
            "Tracking already running."
        );

        return;
    }

    routePoints = [];
    stopMarkers = [];

    totalDistance = 0;
    stopCount = 0;

    stopCountEl.textContent =
        "0";

    distanceEl.textContent =
        "0.00";

    tripStartTime =
        Date.now();

    routeLine.setPath([]);

    watchId =
        navigator.geolocation
        .watchPosition(

        async(position)=>{

            const lat =
                position.coords.latitude;

            const lng =
                position.coords.longitude;

            const speed =
                position.coords.speed
                ? (
                    position.coords.speed
                    * 3.6
                ).toFixed(1)
                : 0;

            const point = {
                lat,
                lng
            };

            routePoints.push(
                point
            );

            routeLine.setPath(
                routePoints
            );

            busMarker.setPosition(
                point
            );

            if(
                routePoints.length > 1
            ){

                const prev =
                    routePoints[
                        routePoints.length-2
                    ];

                const segment =
                    haversine(
                        prev.lat,
                        prev.lng,
                        lat,
                        lng
                    );

                if(
                    segment > 0.003
                ){

                    totalDistance +=
                        segment;
                }
            }

            distanceEl.textContent =
                totalDistance
                .toFixed(2);

            speedEl.textContent =
                speed;

            const minutes =
                (
                    Date.now()
                    -
                    tripStartTime
                )
                /
                60000;

            durationEl.textContent =
                minutes
                .toFixed(1);

            await set(

                ref(
                    db,
                    "liveLocation"
                ),

                {
                    lat,
                    lng,
                    speed,
                    distance:
                        totalDistance
                        .toFixed(2),

                    duration:
                        minutes
                        .toFixed(1),

                    timestamp:
                        Date.now()
                }
            );
            await set(
    ref(
        db,
        "currentTrip/route"
    ),
    routePoints
);

        },

        err=>{

            console.error(
                err
            );

            alert(
                "GPS Error"
            );
        },

        {
            enableHighAccuracy:
                true,

            maximumAge:0,

            timeout:10000
        }

    );

    console.log(
        "TRACKING STARTED"
    );
}

/* ---------------- STOP TRACKING ---------------- */

async function stopTracking(){

    if(!watchId)
        return;

    navigator
        .geolocation
        .clearWatch(
            watchId
        );

    watchId = null;

    await saveTrip();

    alert(
        "Trip Saved"
    );

    console.log(
        "TRACKING STOPPED"
    );
}
/* ---------------- STOP DETECTION ---------------- */

setInterval(()=>{

    if(
        !isDriver ||
        !watchId ||
        routePoints.length === 0
    ){
        return;
    }

    const currentSpeed =
        parseFloat(
            speedEl.textContent
        );

    if(currentSpeed < 1){

        if(!stopStart){

            stopStart =
                Date.now();
        }

    }else{

        if(stopStart){

            const stopDuration =
                (
                    Date.now()
                    -
                    stopStart
                ) / 1000;

            if(
                stopDuration >= 2
            ){

                createStop(
                    stopDuration
                );
            }

            stopStart = null;
        }
    }

},1000);

/* ---------------- CREATE STOP ---------------- */

function createStop(
    duration
){

    stopCount++;

    stopCountEl.textContent =
        stopCount;

    const point =
        routePoints[
            routePoints.length-1
        ];

    let color =
        "#facc15";

    let cssClass =
        "stop-short";

    if(duration > 10){

        color =
            "#fb923c";

        cssClass =
            "stop-medium";
    }

    if(duration > 30){

        color =
            "#ef4444";

        cssClass =
            "stop-long";
    }

    const marker =
        new google.maps.Marker({

        position: point,

        map: map,

        icon:{
            path:
            google.maps.SymbolPath
            .CIRCLE,

            scale:8,

            fillColor:
                color,

            fillOpacity:1,

            strokeColor:"#000",

            strokeWeight:1
        }
    });

    stopMarkers.push({

        lat:
            point.lat,

        lng:
            point.lng,

        duration,

        color
    });

    const div =
        document
        .createElement(
            "div"
        );

    div.className =
        `stop-item ${cssClass}`;

    div.innerHTML =
        `
        Stop ${stopCount}
        <br>
        Duration:
        ${duration.toFixed(1)}
        sec
        `;

    stopList.prepend(
        div
    );
}

/* ---------------- SHOW OLD TRIP ---------------- */

function showTripOnMap(
    trip
){

    routeLine.setPath([]);

    const route =
        trip.route || [];

    routeLine.setPath(
        route
    );

    stopMarkers.forEach(
        marker=>{
            marker.setMap(null);
        }
    );

    stopMarkers = [];

    if(
        trip.stopMarkers
    ){

        trip.stopMarkers
        .forEach(stop=>{

            const marker =
                new google.maps.Marker({

                position:{
                    lat:stop.lat,
                    lng:stop.lng
                },

                map:map,

                icon:{
                    path:
                    google.maps.SymbolPath
                    .CIRCLE,

                    scale:8,

                    fillColor:
                        stop.color,

                    fillOpacity:1,

                    strokeColor:"#000",

                    strokeWeight:1
                }
            });

            stopMarkers.push(
                marker
            );
        });
    }

    if(route.length){

        map.panTo(
            route[0]
        );
    }
}

/* ---------------- UPDATE HISTORY CLICK ---------------- */

function loadTripHistory(){

    onValue(

        ref(
            db,
            "tripHistory"
        ),

        snapshot=>{

            const data =
                snapshot.val();

            if(!data)
                return;

            tripHistory.innerHTML =
                "";

            Object.keys(data)
            .reverse()
            .forEach(id=>{

                const trip =
                    data[id];

                const div =
                    document
                    .createElement(
                        "div"
                    );

                div.className =
                    "trip-card";

                div.innerHTML =
                `
                <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                ">

                <div>

                <b>${trip.date}</b>
                <br>

                Start:
                ${trip.startTime}
                <br>

                End:
                ${trip.endTime}
                <br>

                Distance:
                ${trip.distance} km
                <br>

                Stops:
                ${trip.stops}
                <br>

                Duration:
                ${trip.duration} min

                </div>

                <button
                class="delete-trip"
                data-id="${id}"
                style="
                background:red;
                color:white;
                border:none;
                padding:6px 10px;
                border-radius:5px;
                cursor:pointer;
                "
                >
                🗑️
                </button>

                </div>
                `;

                div.onclick =
                    ()=>{

                    showTripOnMap(
                        trip
                    );

                };

                tripHistory.appendChild(div);

                const deleteBtn =
                    div.querySelector(
                        ".delete-trip"
                    );

                deleteBtn.onclick =
                async (e)=>{

                    e.stopPropagation();

                    if(
                        !confirm(
                            "Delete this trip?"
                        )
                    ){
                        return;
                    }

                    await set(
                        ref(
                            db,
                            "tripHistory/" + id
                        ),
                        null
                    );
                };
            });
        }
    );
}

/* ---------------- NEW TRIP RESET ---------------- */

function resetTrip(){

    routePoints = [];

    stopMarkers = [];

    totalDistance = 0;

    stopCount = 0;

    stopCountEl.textContent =
        "0";

    distanceEl.textContent =
        "0.00";

    durationEl.textContent =
        "0";

    stopList.innerHTML =
        "";

    routeLine.setPath([]);
}

/* ---------------- DRIVER RELEASE ---------------- */

window.addEventListener(

    "beforeunload",

    async()=>{

        if(isDriver){

            await set(

                ref(
                    db,
                    "activeDriver"
                ),

                ""
            );
        }
    }
);

/* ---------------- SAVE START/END TIMES ---------------- */

async function saveTrip(){

    const endTime =
        new Date();

    const tripId =
        "trip_" +
        Date.now();

    const tripData = {
        busNumber:
            BUS_NUMBER,

        date:
            endTime
            .toLocaleDateString(),

        startTime:
            new Date(
                tripStartTime
            )
            .toLocaleTimeString(),

        endTime:
            endTime
            .toLocaleTimeString(),

        distance:
            totalDistance
            .toFixed(2),

        duration:
            durationEl
            .textContent,

        stops:
            stopCount,

        route:
            routePoints,

        stopMarkers:
            stopMarkers
    };

    await set(

        ref(
            db,
            "tripHistory/" +
            tripId
        ),

        tripData
    );
}
window.initMap = initMap;

if (typeof google !== "undefined" && google.maps) {
    initMap();
}
