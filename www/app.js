const screens = [...document.querySelectorAll('.screen')];
const navItems = [...document.querySelectorAll('.nav-item')];
const toast = document.getElementById('toast');
const todayDate = document.getElementById('todayDate');
const cfg = window.CORVEX_CONFIG || {};

let deferredPrompt = null;
let selectedJobId = null;
let currentTrackingJobId = null;
let liveWatchId = null;
let lastPublishAt = 0;
let supabaseClient = null;
let realtimeChannel = null;
let channel = null;

let maps = {};
let markers = {};
let routeLines = {};

const seedJobs = [
  {
    id: 'CVX-2401',
    pickup: 'West Metro Pharmacy',
    dropoff: 'Lakeside Care Center',
    service: 'STAT',
    handling: 'Signature required',
    status: 'Assigned',
    driver: 'Jordan M.',
    pickupLat: 44.9557,
    pickupLng: -93.3912,
    dropoffLat: 44.9443,
    dropoffLng: -93.3556,
    trackingPin: '4827'
  },
  {
    id: 'CVX-2402',
    pickup: 'North Clinic',
    dropoff: 'Central Lab',
    service: 'Same-day',
    handling: 'Temperature-sensitive',
    status: 'Pending',
    driver: 'Unassigned',
    pickupLat: 44.9760,
    pickupLng: -93.3441,
    dropoffLat: 44.9612,
    dropoffLng: -93.3043,
    trackingPin: '7314'
  },
  {
    id: 'CVX-2398',
    pickup: 'Community Pharmacy',
    dropoff: 'Oakview Residence',
    service: 'Routine',
    handling: 'Standard',
    status: 'Delivered',
    driver: 'Taylor R.',
    pickupLat: 44.9328,
    pickupLng: -93.3726,
    dropoffLat: 44.9197,
    dropoffLng: -93.3333,
    trackingPin: '1846'
  }
];

function getJobs() {
  const raw = localStorage.getItem('corvex-demo-jobs');

  if (!raw) {
    localStorage.setItem(
      'corvex-demo-jobs',
      JSON.stringify(seedJobs)
    );

    return JSON.parse(JSON.stringify(seedJobs));
  }

  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(JSON.stringify(seedJobs));
  }
}

function saveJobs(jobs) {
  localStorage.setItem(
    'corvex-demo-jobs',
    JSON.stringify(jobs)
  );

  renderAll();
}

function esc(value = '') {
  return String(value).replace(
    /[&<>'"]/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[c])
  );
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');

  clearTimeout(showToast.t);

  showToast.t = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

function go(screen) {
  screens.forEach(s => {
    s.classList.toggle(
      'active',
      s.dataset.screen === screen
    );
  });

  navItems.forEach(n => {
    n.classList.toggle(
      'active',
      n.dataset.go === screen
    );
  });

  history.replaceState(
    null,
    '',
    `#${screen}`
  );

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });

  document
    .getElementById('app')
    .focus({
      preventScroll: 
}

setTimeout(() => {
  if (screen === 'driver') {
    const jobs = getJobs();

    const delivery =
      jobs.find(job => job.status === 'En route') ||
      jobs.find(job => job.status === 'Picked up') ||
      jobs.find(job => job.status === 'Assigned') ||
      jobs.find(job => job.status !== 'Delivered');

    if (delivery) {
      refreshDriverRouteMap(delivery);
    }
  }

  if (screen === 'dispatch') {
    refreshDispatchMap();
  }

  if (screen === 'tracking') {
    maps.customerLiveMap?.invalidateSize();
  }

  maps[`${screen}LiveMap`]?.invalidateSize();
}, 150);
document.addEventListener('click', e => {
  const button = e.target.closest('[data-go]');

  if (button) {
    go(button.dataset.go);
  }
});

window.addEventListener('hashchange', () => {
  const screen = location.hash.slice(1);

  if (
    screens.some(
      item => item.dataset.screen === screen
    )
  ) {
    go(screen);
  }
});

todayDate.textContent =
  new Intl.DateTimeFormat(
    undefined,
    {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }
  ).format(new Date());

function badge(status, service) {
  const cls =
    status === 'Delivered'
      ? 'delivered'
      : service === 'STAT'
        ? 'stat'
        : '';

  return `
    <span class="job-status ${cls}">
      ${esc(status)}
    </span>
  `;
}

function jobHtml(job, assignable = false) {
  const canTrack =
    job.status !== 'Delivered';

  return `
    <article class="job-card">

      <button
        class="job-main"
        ${
          assignable
            ? `data-assign="${esc(job.id)}"`
            : ''
        }
        type="button"
      >

        <div class="job-id">
          ${esc(job.id)} · ${esc(job.service)}
        </div>

        <div class="job-route">
          ${esc(job.pickup)} → ${esc(job.dropoff)}
        </div>

        <div class="job-meta">
          ${esc(job.handling)}
          ${
            job.driver
              ? ` · ${esc(job.driver)}`
              : ''
          }
        </div>

      </button>

      <div class="job-actions">

        ${badge(
          job.status,
          job.service
        )}

        ${
          canTrack
            ? `
              <button
                class="track-btn"
                data-track="${esc(job.id)}"
                type="button"
              >
                Track live
              </button>
            `
            : ''
        }

      </div>

    </article>
  `;
}

function renderAll() {
  const jobs = getJobs();

  document
    .getElementById('customerJobs')
    .innerHTML =
    jobs
      .map(job => jobHtml(job))
      .join('');

  document
    .getElementById('dispatchJobs')
    .innerHTML =
    jobs
      .map(job => jobHtml(job, true))
      .join('');

  const active =
    jobs.filter(
      job => job.status !== 'Delivered'
    ).length;

  const delivered =
    jobs.filter(
      job => job.status === 'Delivered'
    ).length;

  const pending =
    jobs.filter(
      job => job.status === 'Pending'
    ).length;

  document
    .getElementById('metricActive')
    .textContent = active;

  document
    .getElementById('metricDelivered')
    .textContent = delivered;

  document
    .getElementById('metricPending')
    .textContent = pending;

  document
    .getElementById('dispatchOpen')
    .textContent = active;

  const delivery =
    jobs.find(
      job => job.status === 'En route'
    ) ||
    jobs.find(
      job => job.status === 'Picked up'
    ) ||
    jobs.find(
      job => job.status === 'Assigned'
    ) ||
    jobs.find(
      job => job.status !== 'Delivered'
    ) ||
    jobs[0];

  if (delivery) {
    document
      .getElementById('driverJobId')
      .textContent = delivery.id;

    document
      .getElementById('driverPriority')
      .textContent = delivery.service;

    document
      .getElementById('driverPickup')
      .textContent = delivery.pickup;

    document
      .getElementById('driverDropoff')
      .textContent = delivery.dropoff;

    document
      .getElementById('driverHandling')
      .textContent =
      delivery.handling.replace(
        ' required',
        ''
      );


  }

  
}

renderAll();
document
  .getElementById('deliveryForm')
  .addEventListener('submit', e => {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);
    const jobs = getJobs();

    const id =
      `CVX-${String(
        2403 + Math.floor(Math.random() * 700)
      ).padStart(4, '0')}`;

    const pin =
      String(
        Math.floor(
          1000 + Math.random() * 9000
        )
      );

    jobs.unshift({
      id,
      pickup: fd.get('pickup'),
      dropoff: fd.get('dropoff'),
      service: fd.get('service'),
      handling: fd.get('handling'),
      status: 'Pending',
      driver: 'Unassigned',
      notes: fd.get('notes'),
      trackingPin: pin
    });

    saveJobs(jobs);

    e.currentTarget.reset();

    showToast(
      `${id} created in demo mode`
    );
  });


document
  .getElementById('clearDemo')
  .addEventListener('click', () => {
    localStorage.setItem(
      'corvex-demo-jobs',
      JSON.stringify(seedJobs)
    );

    renderAll();

    showToast(
      'Demo data reset'
    );
  });


document
  .getElementById('dispatchJobs')
  .addEventListener('click', e => {
    const track =
      e.target.closest(
        '[data-track]'
      );

    if (track) {
      openTracking(
        track.dataset.track
      );

      return;
    }

    const btn =
      e.target.closest(
        '[data-assign]'
      );

    if (!btn) {
      return;
    }

    selectedJobId =
      btn.dataset.assign;

    document
      .getElementById(
        'assignJobTitle'
      )
      .textContent =
      `Assign ${selectedJobId}`;

    document
      .getElementById(
        'assignDialog'
      )
      .showModal();
  });


document
  .getElementById('customerJobs')
  .addEventListener('click', e => {
    const btn =
      e.target.closest(
        '[data-track]'
      );

    if (btn) {
      openTracking(
        btn.dataset.track
      );
    }
  });


document
  .getElementById('confirmAssign')
  .addEventListener('click', () => {
    const jobs = getJobs();

    const driver =
      document
        .getElementById(
          'driverSelect'
        )
        .value;

    const job =
      jobs.find(
        item =>
          item.id === selectedJobId
      );

    if (job) {
      job.driver = driver;

      job.status =
        driver === 'Unassigned'
          ? 'Pending'
          : 'Assigned';

      saveJobs(jobs);

      showToast(
        `${job.id} assigned to ${driver}`
      );
    }

    document
      .getElementById(
        'assignDialog'
      )
      .close();
  });


document
  .querySelectorAll(
    '[data-status]'
  )
  .forEach(btn => {
    btn.addEventListener(
      'click',
      () => {
        document
          .querySelectorAll(
            '[data-status]'
          )
          .forEach(button => {
            button.classList.remove(
              'active'
            );
          });

        btn.classList.add(
          'active'
        );

        const status =
          btn.dataset.status;

        document
          .getElementById(
            'driverStatus'
          )
          .textContent =
          `Status updated: ${status}`;

        const jobs = getJobs();

        const id =
          document
            .getElementById(
              'driverJobId'
            )
            .textContent;

        const job =
          jobs.find(
            item =>
              item.id === id
          );

        if (job) {
          job.status = status;

          saveJobs(jobs);

          publishStatus(
            job,
            status
          );
        }

        showToast(
          `Driver status: ${status}`
        );
      }
    );
  });


document
  .getElementById('podBtn')
  .addEventListener('click', () => {
    const stamp =
      new Date()
        .toLocaleString();

    document
      .getElementById(
        'podResult'
      )
      .textContent =
      `Demo POD captured • ${stamp}`;

    showToast(
      'Demo proof captured'
    );
  });


document
  .getElementById('locationBtn')
  .addEventListener('click', () => {
    const out =
      document
        .getElementById(
          'podResult'
        );

    if (!navigator.geolocation) {
      out.textContent =
        'Location is not supported on this device.';

      return;
    }

    out.textContent =
      'Requesting location permission…';

    navigator
      .geolocation
      .getCurrentPosition(
        pos => {
          const lat =
            pos.coords.latitude
              .toFixed(4);

          const lng =
            pos.coords.longitude
              .toFixed(4);

          out.textContent =
            `Location captured for demo: ${lat}, ${lng} • accuracy ±${Math.round(pos.coords.accuracy)}m`;

          showToast(
            'Location captured'
          );
        },

        () => {
          out.textContent =
            'Location permission was not granted.';
        },

        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
  });


function makeMap(
  id,
  center = [44.95, -93.36],
  zoom = 13
) {
  if (!window.L) {
    return null;
  }

  if (maps[id]) {
    return maps[id];
  }

  const map =
    L.map(
      id,
      {
        zoomControl: false,
        attributionControl: true
      }
    )
    .setView(
      center,
      zoom
    );

  L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }
  ).addTo(map);

  L.control
    .zoom({
      position: 'bottomright'
    })
    .addTo(map);

  maps[id] = map;

  return map;
}


function divIcon(
  type,
  emoji
) {
  return L.divIcon({
    className: '',

    html:
      `<div class="${type}">
        ${emoji}
      </div>`,

    iconSize: [42, 42],
    iconAnchor: [21, 21]
  });
}


function upsertMarker(
  key,
  map,
  lat,
  lng,
  type,
  emoji
) {
  if (
    !map ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return;
  }

  if (markers[key]) {
    markers[key]
      .setLatLng(
        [lat, lng]
      );
  } else {
    markers[key] =
      L.marker(
        [lat, lng],
        {
          icon: divIcon(
            type,
            emoji
          )
        }
      )
      .addTo(map);
  }
}


function line(
  key,
  map,
  points,
  opts = {}
) {
  if (
    !map ||
    points.length < 2
  ) {
    return;
  }

  if (routeLines[key]) {
    routeLines[key]
      .setLatLngs(points);
  } else {
    routeLines[key] =
      L.polyline(
        points,
        {
          weight: 5,
          opacity: .85,
          ...opts
        }
      )
      .addTo(map);
  }
}
function refreshDriverRouteMap(job) {
  const map = makeMap(
    'driverLiveMap',
    [
      job.pickupLat || 44.95,
      job.pickupLng || -93.36
    ],
    13
  );

  if (!map) {
    return;
  }

  if (job.pickupLat) {
    upsertMarker(
      'driverPickup',
      map,
      job.pickupLat,
      job.pickupLng,
      'pickup-map-marker',
      'P'
    );
  }

  if (job.dropoffLat) {
    upsertMarker(
      'driverDropoff',
      map,
      job.dropoffLat,
      job.dropoffLng,
      'destination-map-marker',
      '⌂'
    );
  }

  if (
    job.pickupLat &&
    job.dropoffLat
  ) {
    line(
      'driverRoute',
      map,
      [
        [
          job.pickupLat,
          job.pickupLng
        ],
        [
          job.dropoffLat,
          job.dropoffLng
        ]
      ]
    );

    map.fitBounds(
      [
        [
          job.pickupLat,
          job.pickupLng
        ],
        [
          job.dropoffLat,
          job.dropoffLng
        ]
      ],
      {
        padding: [35, 35]
      }
    );
  }

  const location =
    getStoredLocation(job.id);

  if (location) {
    updateDriverMapPosition(
      location
    );
  }
}


function refreshDispatchMap() {
  const map = makeMap(
    'dispatchMap',
    [44.95, -93.35],
    11
  );

  if (!map) {
    return;
  }

  getJobs()
    .filter(
      job =>
        job.status !== 'Delivered' &&
        job.dropoffLat
    )
    .forEach(
      (job, index) => {
        upsertMarker(
          `dispatchDest-${job.id}`,
          map,
          job.dropoffLat,
          job.dropoffLng,
          'destination-map-marker',
          String(index + 1)
        );
      }
    );

  const active =
    getJobs()
      .find(
        job =>
          job.status !== 'Delivered'
      );

  if (active) {
    const location =
      getStoredLocation(
        active.id
      );

    if (location) {
      upsertMarker(
        'dispatchDriver',
        map,
        location.lat,
        location.lng,
        'driver-map-marker',
        '🚗'
      );
    }
  }
}


function haversineKm(
  aLat,
  aLng,
  bLat,
  bLng
) {
  const R = 6371;

  const toRad =
    degrees =>
      degrees *
      Math.PI /
      180;

  const dLat =
    toRad(
      bLat - aLat
    );

  const dLng =
    toRad(
      bLng - aLng
    );

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) *
    Math.cos(toRad(bLat)) *
    Math.sin(dLng / 2) ** 2;

  return (
    2 *
    R *
    Math.asin(
      Math.sqrt(x)
    )
  );
}


function etaFromLocation(
  job,
  location
) {
  if (
    !job?.dropoffLat ||
    !location
  ) {
    return null;
  }

  const km =
    haversineKm(
      location.lat,
      location.lng,
      job.dropoffLat,
      job.dropoffLng
    );

  const speedKmh =
    Math.max(
      22,
      Math.min(
        65,
        (location.speed || 0) *
          3.6 ||
        38
      )
    );

  return Math.max(
    2,
    Math.round(
      (km / speedKmh) *
      60
    )
  );
}


function etaWindow(minutes) {
  if (!minutes) {
    return 'Calculating ETA…';
  }

  const low =
    Math.max(
      1,
      minutes - 2
    );

  const high =
    minutes + 4;

  return `${low}–${high} min`;
}


function getStoredLocation(jobId) {
  try {
    return JSON.parse(
      localStorage.getItem(
        `corvex-location-${jobId}`
      ) || 'null'
    );
  } catch {
    return null;
  }
}


function storeLocation(
  jobId,
  location
) {
  localStorage.setItem(
    `corvex-location-${jobId}`,
    JSON.stringify(location)
  );

  channel?.postMessage({
    type: 'location',
    jobId,
    loc: location
  });
}


function updateDriverMapPosition(
  location
) {
  const map =
    maps.driverLiveMap;

  if (!map) {
    return;
  }

  upsertMarker(
    'driverLive',
    map,
    location.lat,
    location.lng,
    'driver-map-marker',
    '🚗'
  );

  const job =
    getJobs()
      .find(
        item =>
          item.id ===
          document
            .getElementById(
              'driverJobId'
            )
            .textContent
      );

  if (job?.dropoffLat) {
    line(
      'driverCurrentRoute',
      map,
      [
        [
          location.lat,
          location.lng
        ],
        [
          job.dropoffLat,
          job.dropoffLng
        ]
      ],
      {
        dashArray: '10 8'
      }
    );

    const eta =
      etaFromLocation(
        job,
        location
      );

    document
      .getElementById(
        'driverEta'
      )
      .textContent =
      eta
        ? etaWindow(eta)
        : '—';
  }

  refreshDispatchMap();
}


async function startLiveTracking() {
  const jobId =
    document
      .getElementById(
        'driverJobId'
      )
      .textContent;

  if (!navigator.geolocation) {
    showToast(
      'Geolocation is not supported'
    );

    return;
  }

  if (liveWatchId !== null) {
    return;
  }

  document
    .getElementById(
      'driverGpsStatus'
    )
    .textContent =
    'Requesting precise location permission…';

  liveWatchId =
    navigator
      .geolocation
      .watchPosition(
        async position => {
          const location = {
            jobId,

            lat:
              position.coords.latitude,

            lng:
              position.coords.longitude,

            accuracy:
              position.coords.accuracy,

            heading:
              position.coords.heading,

            speed:
              position.coords.speed,

            updatedAt:
              new Date()
                .toISOString(),

            status:
              getJobs()
                .find(
                  job =>
                    job.id === jobId
                )
                ?.status ||
              'En route'
          };

          storeLocation(
            jobId,
            location
          );

          updateDriverMapPosition(
            location
          );

          document
            .getElementById(
              'driverGpsStatus'
            )
            .textContent =
            `Broadcasting live • accuracy ±${Math.round(location.accuracy)}m • ${new Date(location.updatedAt).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
              second: '2-digit'
            })}`;

          document
            .getElementById(
              'driverLivePill'
            )
            .textContent =
            'GPS live';

          document
            .getElementById(
              'driverLivePill'
            )
            .classList
            .add('live');

          const now =
            Date.now();

          if (
            now - lastPublishAt >
            Number(
              cfg.publishEveryMs ||
              4000
            )
          ) {
            lastPublishAt = now;

            await publishLocation(
              location
            );
          }
        },

        error => {
          document
            .getElementById(
              'driverGpsStatus'
            )
            .textContent =
            error.code === 1
              ? 'Location permission was denied. Enable location access for Corvex in browser/app settings.'
              : `GPS error: ${error.message}`;

          stopLiveTracking(
            false
          );
        },

        {
          enableHighAccuracy: true,
          maximumAge: 1500,
          timeout: 15000
        }
      );

  document
    .getElementById(
      'startLiveTracking'
    )
    .disabled = true;

  document
    .getElementById(
      'stopLiveTracking'
    )
    .disabled = false;
}


function stopLiveTracking(
  show = true
) {
  if (liveWatchId !== null) {
    navigator
      .geolocation
      .clearWatch(
        liveWatchId
      );

    liveWatchId = null;
  }

  document
    .getElementById(
      'startLiveTracking'
    )
    .disabled = false;

  document
    .getElementById(
      'stopLiveTracking'
    )
    .disabled = true;

  document
    .getElementById(
      'driverLivePill'
    )
    .textContent =
    'GPS off';

  document
    .getElementById(
      'driverLivePill'
    )
    .classList
    .remove('live');

  if (show) {
    document
      .getElementById(
        'driverGpsStatus'
      )
      .textContent =
      'Live GPS stopped.';

    showToast(
      'Live GPS stopped'
    );
  }
}


document
  .getElementById(
    'startLiveTracking'
  )
  .addEventListener(
    'click',
    startLiveTracking
  );


document
  .getElementById(
    'stopLiveTracking'
  )
  .addEventListener(
    'click',
    () =>
      stopLiveTracking(true)
  );


function statusStage(status) {
  return ({
    Pending: 0,
    Assigned: 1,
    Arrived: 1,
    'Picked up': 2,
    'En route': 2,
    Delivered: 4
  })[status] ?? 1;
}
function renderTracking(
  job,
  location
) {
  document
    .getElementById(
      'trackingJobId'
    )
    .textContent =
    job.id;

  document
    .getElementById(
      'trackingService'
    )
    .textContent =
    job.service;

  document
    .getElementById(
      'trackingDriver'
    )
    .textContent =
    job.driver ||
    'Corvex Driver';

  document
    .getElementById(
      'trackingPin'
    )
    .textContent =
    '••••';

  document
    .getElementById(
      'revealPinBtn'
    )
    .dataset.revealed =
    'false';

  const stage =
    statusStage(
      job.status
    );

  const pill =
    document
      .getElementById(
        'trackingStatusPill'
      );

  pill.textContent =
    job.status === 'Assigned'
      ? 'Preparing'
      : job.status;

  document
    .getElementById(
      'trackingHeading'
    )
    .textContent =
    job.status === 'Delivered'
      ? 'Delivered'
      : stage >= 2
        ? 'Heading to delivery'
        : 'Driver preparing pickup';

  document
    .getElementById(
      'trackingMessage'
    )
    .textContent =
    job.status === 'Delivered'
      ? 'Delivery completed and recorded.'
      : stage >= 2
        ? 'Your Corvex driver is heading to the delivery location.'
        : 'Your Corvex driver is preparing the delivery.';

  const eta =
    etaFromLocation(
      job,
      location
    );

  document
    .getElementById(
      'trackingEta'
    )
    .textContent =
    job.status === 'Delivered'
      ? 'Completed'
      : etaWindow(eta);

  document
    .getElementById(
      'trackingUpdated'
    )
    .textContent =
    location?.updatedAt
      ? `Location updated ${new Date(location.updatedAt).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit'
        })}`
      : 'Waiting for driver location…';

  document
    .getElementById(
      'progressNode3'
    )
    .classList
    .toggle(
      'done',
      stage >= 3
    );

  document
    .getElementById(
      'progressLeg3'
    )
    .classList
    .toggle(
      'done',
      stage >= 3
    );

  document
    .getElementById(
      'progressNode4'
    )
    .classList
    .toggle(
      'done',
      stage >= 4
    );

  document
    .getElementById(
      'progressLeg4'
    )
    .classList
    .toggle(
      'done',
      stage >= 4
    );

  renderTrackingMap(
    job,
    location
  );
}


function renderTrackingMap(
  job,
  location
) {
  const center =
    location
      ? [
          location.lat,
          location.lng
        ]
      : [
          job.pickupLat || 44.95,
          job.pickupLng || -93.36
        ];

  const map =
    makeMap(
      'customerLiveMap',
      center,
      13
    );

  if (!map) {
    return;
  }

  if (job.pickupLat) {
    upsertMarker(
      'trackPickup',
      map,
      job.pickupLat,
      job.pickupLng,
      'pickup-map-marker',
      'P'
    );
  }

  if (job.dropoffLat) {
    upsertMarker(
      'trackDropoff',
      map,
      job.dropoffLat,
      job.dropoffLng,
      'destination-map-marker',
      '⌂'
    );
  }

  if (location) {
    upsertMarker(
      'trackDriver',
      map,
      location.lat,
      location.lng,
      'driver-map-marker',
      '🚗'
    );
  }

  const points = [];

  if (job.pickupLat) {
    points.push([
      job.pickupLat,
      job.pickupLng
    ]);
  }

  if (location) {
    points.push([
      location.lat,
      location.lng
    ]);
  }

  if (job.dropoffLat) {
    points.push([
      job.dropoffLat,
      job.dropoffLng
    ]);
  }

  if (points.length >= 2) {
    line(
      'trackRoute',
      map,
      points
    );

    map.fitBounds(
      points,
      {
        padding: [45, 45]
      }
    );
  }

  document
    .getElementById(
      'trackingMapState'
    )
    .textContent =
    location
      ? 'LIVE'
      : 'WAITING';
}


async function openTracking(
  jobId
) {
  currentTrackingJobId =
    jobId;

  const job =
    getJobs()
      .find(
        item =>
          item.id === jobId
      );

  if (!job) {
    return;
  }

  go('tracking');

  const location =
    getStoredLocation(
      jobId
    );

  renderTracking(
    job,
    location
  );

  await subscribeRealtime(
    jobId
  );
}


function receiveLocation(
  jobId,
  location
) {
  if (
    jobId ===
    currentTrackingJobId
  ) {
    const job =
      getJobs()
        .find(
          item =>
            item.id === jobId
        );

    if (job) {
      renderTracking(
        job,
        location
      );
    }
  }

  if (
    jobId ===
    document
      .getElementById(
        'driverJobId'
      )
      .textContent
  ) {
    updateDriverMapPosition(
      location
    );
  }
}


window.addEventListener(
  'storage',
  event => {
    if (
      event.key?.startsWith(
        'corvex-location-'
      ) &&
      event.newValue
    ) {
      const jobId =
        event.key.replace(
          'corvex-location-',
          ''
        );

      try {
        receiveLocation(
          jobId,
          JSON.parse(
            event.newValue
          )
        );
      } catch {}
    }
  }
);


try {
  channel =
    new BroadcastChannel(
      'corvex-live-tracking'
    );

  channel.onmessage =
    event => {
      if (
        event.data?.type ===
        'location'
      ) {
        receiveLocation(
          event.data.jobId,
          event.data.loc
        );
      }
    };
} catch {}


document
  .getElementById(
    'revealPinBtn'
  )
  .addEventListener(
    'click',
    () => {
      const job =
        getJobs()
          .find(
            item =>
              item.id ===
              currentTrackingJobId
          );

      if (!job) {
        return;
      }

      const button =
        document
          .getElementById(
            'revealPinBtn'
          );

      const revealed =
        button.dataset.revealed ===
        'true';

      button.dataset.revealed =
        String(!revealed);

      document
        .getElementById(
          'trackingPin'
        )
        .textContent =
        revealed
          ? '••••'
          : job.trackingPin ||
            '0000';

      button.textContent =
        revealed
          ? 'Reveal PIN'
          : 'Hide PIN';
    }
  );


document
  .getElementById(
    'copyTrackingLink'
  )
  .addEventListener(
    'click',
    async () => {
      const url =
        `${location.origin}${location.pathname}#tracking?job=${encodeURIComponent(currentTrackingJobId || '')}`;

      try {
        await navigator
          .clipboard
          .writeText(url);

        showToast(
          'Tracking link copied'
        );
      } catch {
        showToast(
          'Copy unavailable on this browser'
        );
      }
    }
  );


function initSupabase() {
  const okay =
    cfg.supabaseUrl &&
    cfg.supabaseAnonKey &&
    window.supabase?.createClient;

  if (!okay) {
    document
      .getElementById(
        'liveBackendBadge'
      )
      .textContent =
      'Demo Live';

    return;
  }

  try {
    supabaseClient =
      window.supabase
        .createClient(
          cfg.supabaseUrl,
          cfg.supabaseAnonKey
        );

    document
      .getElementById(
        'liveBackendBadge'
      )
      .textContent =
      'Realtime ready';
  } catch {
    document
      .getElementById(
        'liveBackendBadge'
      )
      .textContent =
      'Demo Live';
  }
}


async function publishLocation(
  location
) {
  if (!supabaseClient) {
    return;
  }

  const payload = {
    delivery_id:
      location.jobId,

    driver_id:
      cfg.driverId ||
      'driver',

    lat:
      location.lat,

    lng:
      location.lng,

    accuracy_m:
      location.accuracy ?? null,

    heading:
      location.heading ?? null,

    speed_mps:
      location.speed ?? null,

    status:
      location.status ||
      'En route',

    updated_at:
      location.updatedAt
  };

  const { error } =
    await supabaseClient
      .from(
        cfg.locationTable ||
        'driver_locations'
      )
      .upsert(
        payload,
        {
          onConflict:
            'delivery_id'
        }
      );

  if (error) {
    console.warn(
      'Corvex realtime publish:',
      error.message
    );
  }
}


async function publishStatus(
  job,
  status
) {
  const location =
    getStoredLocation(
      job.id
    );

  if (location) {
    location.status =
      status;

    location.updatedAt =
      new Date()
        .toISOString();

    storeLocation(
      job.id,
      location
    );

    await publishLocation(
      location
    );
  }
}


async function subscribeRealtime(
  jobId
) {
  if (!supabaseClient) {
    return;
  }

  if (realtimeChannel) {
    await supabaseClient
      .removeChannel(
        realtimeChannel
      );

    realtimeChannel = null;
  }

  const table =
    cfg.locationTable ||
    'driver_locations';

  const {
    data,
    error
  } =
    await supabaseClient
      .from(table)
      .select('*')
      .eq(
        'delivery_id',
        jobId
      )
      .maybeSingle();

  if (
    !error &&
    data
  ) {
    receiveLocation(
      jobId,
      {
        jobId,

        lat:
          Number(
            data.lat
          ),

        lng:
          Number(
            data.lng
          ),

        accuracy:
          Number(
            data.accuracy_m || 0
          ),

        heading:
          data.heading,

        speed:
          data.speed_mps,

        status:
          data.status,

        updatedAt:
          data.updated_at
      }
    );
  }

  realtimeChannel =
    supabaseClient
      .channel(
        `delivery-${jobId}`
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter:
            `delivery_id=eq.${jobId}`
        },
        payload => {
          const data =
            payload.new;

          if (!data) {
            return;
          }

          receiveLocation(
            jobId,
            {
              jobId,

              lat:
                Number(
                  data.lat
                ),

              lng:
                Number(
                  data.lng
                ),

              accuracy:
                Number(
                  data.accuracy_m || 0
                ),

              heading:
                data.heading,

              speed:
                data.speed_mps,

              status:
                data.status,

              updatedAt:
                data.updated_at
            }
          );
        }
      )
      .subscribe();
}


initSupabase();


function updateNetwork() {
  const online =
    navigator.onLine;

  const badge =
    document
      .getElementById(
        'networkBadge'
      );

  badge.textContent =
    online
      ? 'Online'
      : 'Offline';

  badge.classList.toggle(
    'offline',
    !online
  );
}


window.addEventListener(
  'online',
  updateNetwork
);

window.addEventListener(
  'offline',
  updateNetwork
);

updateNetwork();


window.addEventListener(
  'beforeinstallprompt',
  event => {
    event.preventDefault();

    deferredPrompt =
      event;

    document
      .getElementById(
        'installBtn'
      )
      .hidden =
      false;
  }
);


async function install() {
  if (deferredPrompt) {
    deferredPrompt.prompt();

    await deferredPrompt
      .userChoice;

    deferredPrompt =
      null;

    document
      .getElementById(
        'installBtn'
      )
      .hidden =
      true;

    return;
  }

  const isIOS =
    /iphone|ipad|ipod/i
      .test(
        navigator.userAgent
      );

  showToast(
    isIOS
      ? 'Safari: Share → Add to Home Screen'
      : 'Use your browser menu → Install app / Add to Home screen'
  );
}


document
  .getElementById(
    'installBtn'
  )
  .addEventListener(
    'click',
    install
  );

document
  .getElementById(
    'installBtn2'
  )
  .addEventListener(
    'click',
    install
  );


window.addEventListener(
  'appinstalled',
  () =>
    showToast(
      'Corvex installed'
    )
);


if (
  'serviceWorker' in navigator
) {
  window.addEventListener(
    'load',
    () =>
      navigator
        .serviceWorker
        .register(
          './sw.js'
        )
        .catch(() => {})
  );
}


window.addEventListener(
  'load',
  () => {
    renderAll();

    const raw =
      location.hash.slice(1);

    if (
      raw.startsWith(
        'tracking?job='
      )
    ) {
      const id =
        decodeURIComponent(
          raw.split(
            'tracking?job='
          )[1] || ''
        );

      if (id) {
        openTracking(id);
      }

      return;
    }

    if (
      raw &&
      screens.some(
        item =>
          item.dataset.screen ===
          raw
      )
    ) {
      go(raw);
    }
  }
);
