// ===== Firebase config =====
const firebaseConfig = {
  apiKey: "AIzaSyDVncDccKuTtuFDtv1KL0gqdl1o6Lk1Qkg",
  authDomain: "bustrackerproject-b28b1.firebaseapp.com",
  databaseURL: "https://bustrackerproject-b28b1-default-rtdb.firebaseio.com",
  projectId: "bustrackerproject-b28b1",
  storageBucket: "bustrackerproject-b28b1.firebasestorage.app",
  messagingSenderId: "935163853454",
  appId: "1:935163853454:web:fb70d6238251c2a71167df"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ===== Initialize Map =====
const map = L.map('map').setView([12.9716, 77.5946], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

// ===== Store markers =====
const busMarkers = {};
const routeLines = {};

// ===== Firebase references =====
const busesRef = db.ref('buses');
const busStopsRef = db.ref('busStops');

// ===== Load bus stops =====
busStopsRef.on('value', snapshot => {
  const stops = snapshot.val();
  if (!stops) return;

  Object.keys(stops).forEach(stopId => {
    const stop = stops[stopId];
    L.circle([stop.lat, stop.lng], {
      color: 'blue',
      fillColor: 'lightblue',
      fillOpacity: 0.5,
      radius: 50
    }).addTo(map).bindPopup(`<b>${stop.name}</b>`);
  });
});

// ===== Load buses =====
busesRef.on('value', snapshot => {
  const buses = snapshot.val();
  if (!buses) return;

  Object.keys(buses).forEach(busId => {
    const bus = buses[busId];

    // Remove old marker if exists
    if (busMarkers[busId]) {
      map.removeLayer(busMarkers[busId]);
    }

    // Create marker
    const marker = L.marker([bus.lat, bus.lng]).addTo(map);

    // ===== UPDATED POPUP (ETA ADDED HERE) =====
    marker.bindPopup(`
      <b>${busId}</b><br>
      Seats: ${bus.seatsAvailable}<br>
      Location: ${bus.lat.toFixed(5)}, ${bus.lng.toFixed(5)}<br>
      Next Stop: ${getNextStopName(bus)}<br>
      ETA: ${bus.eta || "-"}
    `);

    // Zoom to bus on click
    marker.on('click', () => map.setView([bus.lat, bus.lng], 15));

    busMarkers[busId] = marker;
  });

  // ===== Update bus list in HTML =====
  const ul = document.getElementById('buses');
  ul.innerHTML = '';
  Object.keys(buses).forEach(busId => {
    const b = buses[busId];
    const li = document.createElement('li');

    // ===== UPDATED BUS LIST (ETA ADDED HERE) =====
    li.innerHTML = `<b>${busId}</b> — Seats: ${b.seatsAvailable} — Lat:${b.lat.toFixed(4)} Lng:${b.lng.toFixed(4)} — Next Stop: ${getNextStopName(b)} — ETA: ${b.eta || "-"}`;

    ul.appendChild(li);
  });
});

// ===== Simulate movement and seats =====
setInterval(() => {
  busesRef.once('value').then(snapshot => {
    const buses = snapshot.val();
    if (!buses) return;

    Object.keys(buses).forEach(busId => {
      const bus = buses[busId];

      const newLat = bus.lat + (Math.random() * 0.0005 - 0.00025);
      const newLng = bus.lng + (Math.random() * 0.0005 - 0.00025);
      let newSeats = bus.seatsAvailable - Math.floor(Math.random() * 2);
      if (newSeats < 0) newSeats = 0;

      busesRef.child(busId).update({ lat: newLat, lng: newLng, seatsAvailable: newSeats });
    });
  });
}, 5000);

// ===== Find user location and nearest stop =====
document.getElementById('locateBtn').addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Geolocation not available');

  navigator.geolocation.getCurrentPosition(pos => {
    const userLat = pos.coords.latitude;
    const userLng = pos.coords.longitude;

    L.marker([userLat, userLng]).addTo(map).bindPopup('You are here').openPopup();
    map.setView([userLat, userLng], 14);

    busStopsRef.once('value').then(snapshot => {
      const stops = snapshot.val();
      let nearestStop = null;
      let minDist = Infinity;

      Object.keys(stops).forEach(stopId => {
        const stop = stops[stopId];
        const dist = getDistance(userLat, userLng, stop.lat, stop.lng);

        if (dist < minDist) {
          minDist = dist;
          nearestStop = stop;
        }
      });

      if (nearestStop) {
        document.getElementById('nearestName').innerText = nearestStop.name;
        L.polyline([[userLat, userLng], [nearestStop.lat, nearestStop.lng]], { color: 'green', dashArray: '5,5' }).addTo(map);
      }
    });
  });
});

// ===== Helper functions =====
function getDistance(lat1, lon1, lat2, lon2) {
  return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lon1 - lon2, 2));
}

// ===== Get next stop dynamically =====
function getNextStopName(bus) {
  if (!bus.route || bus.route.length === 0) return "-";

  for (let i = 0; i < bus.route.length; i++) {
    if (
      Math.abs(bus.lat - bus.route[i].lat) < 0.0005 &&
      Math.abs(bus.lng - bus.route[i].lng) < 0.0005
    ) {
      return bus.route[i + 1] ? bus.route[i + 1].name : "End of route";
    }
  }

  // If between stops
  let closest = bus.route[0];
  let minDist = Math.sqrt(Math.pow(bus.lat - closest.lat, 2) + Math.pow(bus.lng - closest.lng, 2));

  for (let i = 1; i < bus.route.length; i++) {
    let dist = Math.sqrt(Math.pow(bus.lat - bus.route[i].lat, 2) + Math.pow(bus.lng - bus.route[i].lng, 2));
    if (dist < minDist) {
      minDist = dist;
      closest = bus.route[i];
    }
  }

  return closest.name;
}
