const screens = [...document.querySelectorAll('.screen')];
const navItems = [...document.querySelectorAll('.nav-item')];
const toast = document.getElementById('toast');
const todayDate = document.getElementById('todayDate');

let deferredPrompt = null;
let selectedJobId = null;

const seedJobs = [
  {
    id: 'CVX-2401',
    pickup: 'West Metro Pharmacy',
    dropoff: 'Lakeside Care Center',
    service: 'STAT',
    handling: 'Signature required',
    status: 'Assigned',
    driver: 'Jordan M.'
  },
  {
    id: 'CVX-2402',
    pickup: 'North Clinic',
    dropoff: 'Central Lab',
    service: 'Same-day',
    handling: 'Temperature-sensitive',
    status: 'Pending',
    driver: 'Unassigned'
  },
  {
    id: 'CVX-2398',
    pickup: 'Community Pharmacy',
    dropoff: 'Oakview Residence',
    service: 'Routine',
    handling: 'Standard',
    status: 'Delivered',
    driver: 'Taylor R.'
  }
];

function getJobs() {
  const raw = localStorage.getItem('corvex-demo-jobs');

  if (!raw) {
    localStorage.setItem(
      'corvex-demo-jobs',
      JSON.stringify(seedJobs)
    );

    return [...seedJobs];
  }

  try {
    return JSON.parse(raw);
  } catch {
    return [...seedJobs];
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
    character =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      })[character]
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
  screens.forEach(item => {
    item.classList.toggle(
      'active',
      item.dataset.screen === screen
    );
  });

  navItems.forEach(item => {
    item.classList.toggle(
      'active',
      item.dataset.go === screen
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
    .focus({ preventScroll: true });
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-go]');

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
  new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(new Date());

function badge(status, service) {
  const className =
    status === 'Delivered'
      ? 'delivered'
      : service === 'STAT'
      ? 'stat'
      : '';

  return `
    <span class="job-status ${className}">
      ${esc(status)}
    </span>
  `;
}

function jobHtml(job, assignable = false) {
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
          ${esc(job.pickup)}
          →
          ${esc(job.dropoff)}
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

      ${badge(job.status, job.service)}

    </article>
  `;
}

function renderAll() {
  const jobs = getJobs();

  document.getElementById(
    'customerJobs'
  ).innerHTML = jobs
    .map(job => jobHtml(job))
    .join('');

  document.getElementById(
    'dispatchJobs'
  ).innerHTML = jobs
    .map(job => jobHtml(job, true))
    .join('');

  const active = jobs.filter(
    job => job.status !== 'Delivered'
  ).length;

  const delivered = jobs.filter(
    job => job.status === 'Delivered'
  ).length;

  const pending = jobs.filter(
    job => job.status === 'Pending'
  ).length;

  document.getElementById(
    'metricActive'
  ).textContent = active;

  document.getElementById(
    'metricDelivered'
  ).textContent = delivered;

  document.getElementById(
    'metricPending'
  ).textContent = pending;

  document.getElementById(
    'dispatchOpen'
  ).textContent = active;

  const driverJob =
    jobs.find(
      job => job.status === 'Assigned'
    ) ||
    jobs.find(
      job => job.status !== 'Delivered'
    ) ||
    jobs[0];

  if (driverJob) {
    document.getElementById(
      'driverJobId'
    ).textContent = driverJob.id;

    document.getElementById(
      'driverPriority'
    ).textContent = driverJob.service;

    document.getElementById(
      'driverPickup'
    ).textContent = driverJob.pickup;

    document.getElementById(
      'driverDropoff'
    ).textContent = driverJob.dropoff;

    document.getElementById(
      'driverHandling'
    ).textContent =
      driverJob.handling.replace(
        ' required',
        ''
      );
  }
}

renderAll();

document
  .getElementById('deliveryForm')
  .addEventListener('submit', event => {
    event.preventDefault();

    const formData =
      new FormData(event.currentTarget);

    const jobs = getJobs();

    const id =
      `CVX-${String(
        2403 +
        Math.floor(Math.random() * 700)
      ).padStart(4, '0')}`;

    jobs.unshift({
      id,
      pickup: formData.get('pickup'),
      dropoff: formData.get('dropoff'),
      service: formData.get('service'),
      handling: formData.get('handling'),
      status: 'Pending',
      driver: 'Unassigned',
      notes: formData.get('notes')
    });

    saveJobs(jobs);

    event.currentTarget.reset();

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

    showToast('Demo data reset');
  });

document
  .getElementById('dispatchJobs')
  .addEventListener('click', event => {
    const button =
      event.target.closest(
        '[data-assign]'
      );

    if (!button) return;

    selectedJobId =
      button.dataset.assign;

    document.getElementById(
      'assignJobTitle'
    ).textContent =
      `Assign ${selectedJobId}`;

    document
      .getElementById('assignDialog')
      .showModal();
  });

document
  .getElementById('confirmAssign')
  .addEventListener('click', () => {
    const jobs = getJobs();

    const driver =
      document.getElementById(
        'driverSelect'
      ).value;

    const job = jobs.find(
      item => item.id === selectedJobId
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
      .getElementById('assignDialog')
      .close();
  });

document
  .querySelectorAll('[data-status]')
  .forEach(button => {
    button.addEventListener(
      'click',
      () => {
        document
          .querySelectorAll(
            '[data-status]'
          )
          .forEach(item =>
            item.classList.remove(
              'active'
            )
          );

        button.classList.add(
          'active'
        );

        const status =
          button.dataset.status;

        document.getElementById(
          'driverStatus'
        ).textContent =
          `Status updated: ${status}`;

        if (status === 'Delivered') {
          const jobs = getJobs();

          const id =
            document.getElementById(
              'driverJobId'
            ).textContent;

          const job = jobs.find(
            item => item.id === id
          );

          if (job) {
            job.status = 'Delivered';
            saveJobs(jobs);
          }
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
    const timestamp =
      new Date().toLocaleString();

    document.getElementById(
      'podResult'
    ).textContent =
      `Demo POD captured • ${timestamp}`;

    showToast(
      'Demo proof captured'
    );
  });

document
  .getElementById('locationBtn')
  .addEventListener('click', () => {
    const output =
      document.getElementById(
        'podResult'
      );

    if (!navigator.geolocation) {
      output.textContent =
        'Location is not supported on this device.';

      return;
    }

    output.textContent =
      'Requesting location permission…';

    navigator.geolocation
      .getCurrentPosition(
        position => {
          const latitude =
            position.coords.latitude
              .toFixed(4);

          const longitude =
            position.coords.longitude
              .toFixed(4);

          const accuracy =
            Math.round(
              position.coords.accuracy
            );

          output.textContent =
            `Location captured for demo: ${latitude}, ${longitude} • accuracy ±${accuracy}m`;

          showToast(
            'Location captured'
          );
        },

        () => {
          output.textContent =
            'Location permission was not granted.';
        },

        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 0
        }
      );
  });

function updateNetwork() {
  const online =
    navigator.onLine;

  const badge =
    document.getElementById(
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

    deferredPrompt = event;

    document.getElementById(
      'installBtn'
    ).hidden = false;
  }
);

async function install() {
  if (deferredPrompt) {
    deferredPrompt.prompt();

    await deferredPrompt.userChoice;

    deferredPrompt = null;

    document.getElementById(
      'installBtn'
    ).hidden = true;

    return;
  }

  const isIOS =
    /iphone|ipad|ipod/i.test(
      navigator.userAgent
    );

  showToast(
    isIOS
      ? 'Safari: Share → Add to Home Screen'
      : 'Use your browser menu → Install app / Add to Home screen'
  );
}

document
  .getElementById('installBtn')
  .addEventListener(
    'click',
    install
  );

document
  .getElementById('installBtn2')
  .addEventListener(
    'click',
    install
  );

window.addEventListener(
  'appinstalled',
  () => {
    showToast(
      'Corvex installed'
    );
  }
);

if (
  'serviceWorker' in navigator
) {
  window.addEventListener(
    'load',
    () => {
      navigator.serviceWorker
        .register('./sw.js')
        .catch(() => {});
    }
  );
}

const startingScreen =
  location.hash.slice(1);

if (
  startingScreen &&
  screens.some(
    item =>
      item.dataset.screen ===
      startingScreen
  )
) {
  go(startingScreen);
}
