// --- Three.js Scene Setup ---
let scene, camera, renderer, controls, clock;
let planets = [], planetData = [], planetOrbits = [], planetLabels = [];
let sun, stars;
let isPaused = false;
let focusedPlanet = null;
let defaultCameraPos = { x: 0, y: 30, z: 60 };
let tooltip = document.getElementById('tooltip');
let panelCollapsed = false;
let SCALE = 1.0; // Default scale
let PLANETS = [];

// Texture URLs for planets (CORS-friendly from Wikimedia Commons)
const PLANET_TEXTURES = {
  Sun: 'textures/2k_sun.jpg',
  Mercury: 'textures/2k_mercury.jpg',
  Venus: 'textures/2k_venus_surface.jpg',
  Earth: 'textures/2k_earth_daymap.jpg',
  EarthClouds: 'textures/2k_earth_clouds.jpg',
  Mars: 'textures/2k_mars.jpg',
  Jupiter: 'textures/2k_jupiter.jpg',
  Saturn: 'textures/2k_saturn.jpg',
  SaturnRing: 'textures/2k_saturn_ring_alpha.png',
  Uranus: 'textures/2k_uranus.jpg',
  Neptune: 'textures/2k_neptune.jpg',
};

// Add this near the top
const PLANET_INFO = {
  Sun: {
    description: 'The Sun is the star at the center of the Solar System. It is a nearly perfect sphere of hot plasma.',
    diameter: '1,391,016 km',
    type: 'G-type main-sequence star (G2V)'
  },
  Mercury: {
    description: 'Mercury is the closest planet to the Sun and the smallest in the Solar System.',
    diameter: '4,880 km',
    type: 'Terrestrial'
  },
  Venus: {
    description: 'Venus is the second planet from the Sun. It has a thick, toxic atmosphere.',
    diameter: '12,104 km',
    type: 'Terrestrial'
  },
  Earth: {
    description: 'Earth is the third planet from the Sun and the only astronomical object known to harbor life.',
    diameter: '12,742 km',
    type: 'Terrestrial'
  },
  Mars: {
    description: 'Mars is the fourth planet from the Sun and is often called the "Red Planet".',
    diameter: '6,779 km',
    type: 'Terrestrial'
  },
  Jupiter: {
    description: 'Jupiter is the largest planet in the Solar System and is known for its Great Red Spot.',
    diameter: '139,820 km',
    type: 'Gas giant'
  },
  Saturn: {
    description: 'Saturn is the sixth planet from the Sun and is famous for its prominent ring system.',
    diameter: '116,460 km',
    type: 'Gas giant'
  },
  Uranus: {
    description: 'Uranus is the seventh planet from the Sun. It has a blue-green color due to methane in its atmosphere.',
    diameter: '50,724 km',
    type: 'Ice giant'
  },
  Neptune: {
    description: 'Neptune is the eighth and farthest known planet from the Sun in the Solar System.',
    diameter: '49,244 km',
    type: 'Ice giant'
  }
};

function getPlanets(scale) {
  const ORBIT_SPACING = 1.5;
  return [
    { name: 'Mercury', color: 0xaaaaaa, size: 1 * scale, distance: 7 * scale * ORBIT_SPACING, speed: 0.047 },
    { name: 'Venus', color: 0xffcc99, size: 1.6 * scale, distance: 9 * scale * ORBIT_SPACING, speed: 0.035 },
    { name: 'Earth', color: 0x3399ff, size: 2 * scale, distance: 12 * scale * ORBIT_SPACING, speed: 0.03 },
    { name: 'Mars', color: 0xff3300, size: 1.8 * scale, distance: 15 * scale * ORBIT_SPACING, speed: 0.024 },
    { name: 'Jupiter', color: 0xff9966, size: 5 * scale, distance: 20 * scale * ORBIT_SPACING, speed: 0.013 },
    { name: 'Saturn', color: 0xffff99, size: 4.4 * scale, distance: 26 * scale * ORBIT_SPACING, speed: 0.0097 },
    { name: 'Uranus', color: 0x66ffff, size: 3 * scale, distance: 32 * scale * ORBIT_SPACING, speed: 0.0068 },
    { name: 'Neptune', color: 0x3366ff, size: 3 * scale, distance: 38 * scale * ORBIT_SPACING, speed: 0.0054 },
  ];
}

// At top-level scope
function showPlanetInfo(name) {
  const infoCard = document.getElementById('planetInfoCard');
  const infoName = document.getElementById('infoName');
  const infoDetails = document.getElementById('infoDetails');
  const info = PLANET_INFO[name];
  infoName.textContent = name;
  if (info) {
    infoDetails.innerHTML = `<div style='margin-bottom:8px;'>${info.description}</div><div><b>Diameter:</b> ${info.diameter}</div><div><b>Type:</b> ${info.type}</div>`;
  } else {
    infoDetails.innerHTML = '<em>No data available.</em>';
  }
  infoCard.style.display = 'flex';
}

function onPointerClick(event) {
  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  const hoverTargets = [window.sun, ...(window.planets || [])];
  const intersects = raycaster.intersectObjects(hoverTargets, true);
  if (intersects.length > 0) {
    let obj = intersects[0].object;
    while (obj && !obj.userData.name && obj.parent) {
      obj = obj.parent;
    }
    if (obj && obj.userData.name) {
      showPlanetInfo(obj.userData.name);
      if (obj !== window.sun) {
        focusOnPlanet(obj);
      }
    }
  }
}

function init() {
  scene = new THREE.Scene();

  // --- Responsive Camera Setup ---
  let aspect = window.innerWidth / window.innerHeight;
  let fov = 45;
  let camZ = 60;
  let camY = 45; // Always raise camera for all devices
  if (window.innerWidth < 600) {
    fov = 60;
    camZ = 90;
    camY = 45;
    SCALE = 0.8;
  } else {
    camY = 45;
    SCALE = 0.6;
  }
  camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
  camera.position.set(0, camY, camZ);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  // --- Lighting ---
  const ambient = new THREE.AmbientLight(0xffffff, 0.18);
  scene.add(ambient);
  const sunLight = new THREE.PointLight(0xffffff, 2.2, 200);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  const textureLoader = new THREE.TextureLoader();

  // --- Sun ---
  const sunTexture = textureLoader.load(PLANET_TEXTURES.Sun);
  const sunMat = new THREE.MeshBasicMaterial({ map: sunTexture });
  const sunGeo = new THREE.SphereGeometry(6 * SCALE, 48, 48);
  sun = new THREE.Mesh(sunGeo, sunMat);
scene.add(sun);
  // Sun glow
  const sunGlowMat = new THREE.MeshBasicMaterial({ color: 0xfff200, transparent: true, opacity: 0.18 });
  const sunGlowGeo = new THREE.SphereGeometry(8.5 * SCALE, 48, 48);
  const sunGlow = new THREE.Mesh(sunGlowGeo, sunGlowMat);
  scene.add(sunGlow);

  // --- Stars Background ---
  const starGeo = new THREE.BufferGeometry();
  const starVerts = [];
  for (let i = 0; i < 1800; i++) {
    const r = 200 + Math.random() * 400;
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    starVerts.push(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    );
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.1 });
  stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // --- Planets ---
  PLANETS = getPlanets(SCALE);
  planets = [];
  planetData = [];
  planetOrbits = [];
  PLANETS.forEach((data, i) => {
    const geo = new THREE.SphereGeometry(data.size, 32, 32);
    let mat;
    let planet;
    if (data.name === 'Earth') {
      // Earth: day texture
      const earthTexture = textureLoader.load(PLANET_TEXTURES.Earth);
      mat = new THREE.MeshBasicMaterial({ map: earthTexture });
      planet = new THREE.Mesh(geo, mat);
      // Add clouds as a slightly larger transparent sphere
      const cloudGeo = new THREE.SphereGeometry(data.size * 1.01, 32, 32);
      const cloudTex = textureLoader.load(PLANET_TEXTURES.EarthClouds);
      const cloudMat = new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0.8 });
      const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
      planet.add(cloudMesh);
    } else if (data.name === 'Saturn') {
      // Saturn: surface texture
      const saturnTexture = textureLoader.load(PLANET_TEXTURES.Saturn);
      mat = new THREE.MeshBasicMaterial({ map: saturnTexture });
      planet = new THREE.Mesh(geo, mat);
      // Add ring
      const ringGeo = new THREE.RingGeometry(data.size * 1.2, data.size * 2.2, 64);
      const ringTex = textureLoader.load(PLANET_TEXTURES.SaturnRing);
      const ringMat = new THREE.MeshBasicMaterial({ map: ringTex, side: THREE.DoubleSide, transparent: true });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      planet.add(ringMesh);
    } else {
      // All other planets
      const texUrl = PLANET_TEXTURES[data.name];
      if (texUrl) {
        const tex = textureLoader.load(texUrl);
        mat = new THREE.MeshBasicMaterial({ map: tex });
      } else {
        mat = new THREE.MeshBasicMaterial({ color: data.color });
      }
      planet = new THREE.Mesh(geo, mat);
    }
    planet.userData = { ...data, angle: Math.random() * Math.PI * 2 };
    planets.push(planet);
    planetData.push({ ...data });
    scene.add(planet);
    // Orbit ring
    const orbitGeo = new THREE.RingGeometry(data.distance - 0.01, data.distance + 0.01, 128);
    const orbitMat = new THREE.MeshBasicMaterial({ color: 0xccccff, opacity: 0.28, transparent: true, side: THREE.DoubleSide });
    const orbit = new THREE.Mesh(orbitGeo, orbitMat);
    orbit.rotation.x = Math.PI / 2;
    scene.add(orbit);
    planetOrbits.push(orbit);
  });

  // --- Event Listeners ---
  window.addEventListener('resize', onWindowResize);
  renderer.domElement.addEventListener('mousemove', onPointerMove);
  renderer.domElement.addEventListener('click', onPointerClick);
  document.getElementById('pauseResume').addEventListener('click', togglePause);
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.body.addEventListener('click', (e) => {
    if (focusedPlanet && e.target === renderer.domElement) {
      resetCamera();
    }
  });

  // --- Collapsible Panel ---
  const controlPanel = document.getElementById('controlPanel');
  const collapseBtn = document.createElement('button');
  collapseBtn.id = 'collapsePanel';
  collapseBtn.title = 'Collapse/Expand Panel';
  collapseBtn.innerHTML = '&#9776;'; // Hamburger icon
  collapseBtn.style.marginLeft = '10px';
  collapseBtn.style.fontSize = '1.2rem';
  collapseBtn.style.background = 'none';
  collapseBtn.style.border = 'none';
  collapseBtn.style.cursor = 'pointer';
  collapseBtn.style.color = 'inherit';
  document.querySelector('.panel-header').appendChild(collapseBtn);

  collapseBtn.addEventListener('click', () => {
    panelCollapsed = !panelCollapsed;
    if (panelCollapsed) {
      controlPanel.classList.add('collapsed');
    } else {
      controlPanel.classList.remove('collapsed');
    }
  });

  // --- Control Panel Sliders ---
  const slidersDiv = document.getElementById('sliders');
  slidersDiv.innerHTML = '';
  PLANETS.forEach((data, idx) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'slider-group';
    const label = document.createElement('label');
    label.innerHTML = `<span>${data.name}</span><span id="speedVal${idx}">${data.speed.toFixed(3)}</span>`;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0.001';
    slider.max = '0.08';
    slider.step = '0.001';
    slider.value = data.speed;
    slider.addEventListener('input', () => {
      planets[idx].userData.speed = parseFloat(slider.value);
      document.getElementById(`speedVal${idx}`).textContent = parseFloat(slider.value).toFixed(3);
    });
    wrapper.appendChild(label);
    wrapper.appendChild(slider);
    slidersDiv.appendChild(wrapper);
  });

  // --- Theme ---
  document.body.classList.add('dark');
  document.getElementById('themeToggle').textContent = '🌙';

  // --- Collapse panel by default ---
  panelCollapsed = true;
  controlPanel.classList.add('collapsed');

  // --- Animation ---
  clock = new THREE.Clock();
  animate();

  // Add this in init() after scene = new THREE.Scene();
  const starBgTexture = new THREE.TextureLoader().load('textures/stars.jpg');
  const starBgGeo = new THREE.SphereGeometry(500, 64, 64);
  const starBgMat = new THREE.MeshBasicMaterial({ map: starBgTexture, side: THREE.BackSide });
  const starBgField = new THREE.Mesh(starBgGeo, starBgMat);
  scene.add(starBgField);

  // In init(), after creating the sun:
  sun.userData = { name: 'Sun' };

  // Info card setup
  const infoCard = document.getElementById('planetInfoCard');
  const closeInfoCard = document.getElementById('closeInfoCard');
  closeInfoCard.onclick = () => { infoCard.style.display = 'none'; };

  // Remove and re-add click event listener to avoid duplicates
  renderer.domElement.removeEventListener('click', onPointerClick);
  renderer.domElement.addEventListener('click', onPointerClick);

  // ... sun and planets creation ...
  window.sun = sun;
  window.planets = planets;
}

function onWindowResize() {
  let aspect = window.innerWidth / window.innerHeight;
  let fov = 45;
  let camZ = 60;
  let camY = 45; // Always raise camera for all devices
  let newScale = 1.0;
  if (window.innerWidth < 600) {
    fov = 60;
    camZ = 90;
    camY = 45;
    newScale = 0.8;
  } else {
    camY = 45;
    newScale = 0.6;
  }
  SCALE = newScale;
  camera.fov = fov;
  camera.aspect = aspect;
  camera.position.set(0, camY, camZ);
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  if (!isPaused) {
    const delta = clock.getDelta();
    planets.forEach((planet, i) => {
      planet.userData.angle += planet.userData.speed * delta * 60;
      planet.position.x = Math.cos(planet.userData.angle) * PLANETS[i].distance;
      planet.position.z = Math.sin(planet.userData.angle) * PLANETS[i].distance;
      planet.rotation.y += 0.01;
    });
  }
  renderer.render(scene, camera);
}

function togglePause() {
  isPaused = !isPaused;
  document.getElementById('pauseResume').textContent = isPaused ? 'Resume' : 'Pause';
  if (!isPaused) {
    // Reset the clock so planets don't jump forward after resuming
    clock.getDelta();
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  const btn = document.getElementById('themeToggle');
  btn.textContent = document.body.classList.contains('dark') ? '🌙' : '☀️';
}

// --- Tooltip on Hover ---
function onPointerMove(event) {
  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const hoverTargets = [sun, ...planets];
  const intersects = raycaster.intersectObjects(hoverTargets, true);
  if (intersects.length > 0) {
    // Find the first ancestor with userData.name
    let obj = intersects[0].object;
    while (obj && !obj.userData.name && obj.parent) {
      obj = obj.parent;
    }
    if (obj && obj.userData.name) {
      showTooltip(obj.userData.name, event.clientX, event.clientY);
      renderer.domElement.style.cursor = 'pointer';
    } else {
      hideTooltip();
      renderer.domElement.style.cursor = '';
    }
  } else {
    hideTooltip();
    renderer.domElement.style.cursor = '';
  }
}
function showTooltip(text, x, y) {
  if (text) {
    tooltip.textContent = text;
    tooltip.classList.add('visible');
    tooltip.style.left = x + 12 + 'px';
    tooltip.style.top = y - 8 + 'px';
  }
}
function hideTooltip() {
  tooltip.classList.remove('visible');
}

// --- Camera Focus on Planet Click ---
function focusOnPlanet(planet) {
  focusedPlanet = planet;
  // Animate camera to planet
  const target = planet.position.clone();
  const camTarget = target.clone().add(new THREE.Vector3(0, planet.userData.size * 2.5, planet.userData.size * 5));
  animateCameraTo(camTarget, target);
}
function resetCamera() {
  focusedPlanet = null;
  animateCameraTo(new THREE.Vector3(defaultCameraPos.x, defaultCameraPos.y, defaultCameraPos.z), new THREE.Vector3(0, 0, 0));
}
function animateCameraTo(pos, lookAt) {
  // Smooth camera animation
  const duration = 0.8; // seconds
  const startPos = camera.position.clone();
  const startLook = camera.getWorldDirection(new THREE.Vector3()).add(camera.position);
  let t = 0;
  function animateMove() {
    t += clock.getDelta() / duration;
    if (t > 1) t = 1;
    camera.position.lerpVectors(startPos, pos, t);
    camera.lookAt(
      startLook.clone().lerp(lookAt, t)
    );
    if (t < 1) {
      requestAnimationFrame(animateMove);
    }
  }
  animateMove();
}

// --- Start ---
window.addEventListener('DOMContentLoaded', init);
