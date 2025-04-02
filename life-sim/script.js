import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Simulation Parameters ---
const WORLD_SIZE = 500;
const PARTICLE_COUNT_PER_GROUP = 1000;
const PARTICLE_VISUAL_SIZE = 2;
const PARTICLE_TEXTURE_SIZE = 64;

// --- Three.js Setup ---
let scene, camera, renderer, controls;
let particleGeometry, particleMaterial, particleSystem;
let positionAttribute, colorAttribute;

// --- Simulation Data ---
const particles = []; // Holds all particle data { x, y, vx, vy, color }
const colors = {
    yellow: new THREE.Color("yellow"),
    red: new THREE.Color("red"),
    green: new THREE.Color("green")
};

// --- Circle texture ---
function createCircleTexture(size, color = 'white') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.45;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
    context.fillStyle = color;
    context.fill();
    return new THREE.CanvasTexture(canvas);
}

// --- Initialization ---
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera - Switched to Orthographic for 2D
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = WORLD_SIZE * 1.1; // Make view slightly larger than world
    camera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2, // left
        frustumSize * aspect / 2,  // right
        frustumSize / 2,           // top
        frustumSize / -2,          // bottom
        1,                         // near clipping plane
        1000                       // far clipping plane
    );
    camera.position.z = 10; // Position the camera looking along the Z axis

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Controls - Adjusted for Orthographic Camera
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = false;      // Disable rotation for 2D view
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.screenSpacePanning = true;
    // controls.zoomSpeed = 1.2;

    // --- Particle System Setup (Geometry still needs Z component for Three.js) ---
    particleGeometry = new THREE.BufferGeometry();
    const totalParticles = PARTICLE_COUNT_PER_GROUP * 3;

    // Buffers still need 3 components (x, y, z) even if z is always 0
    const positions = new Float32Array(totalParticles * 3);
    const colorsAttrib = new Float32Array(totalParticles * 3);

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colorsAttrib, 3));

    positionAttribute = particleGeometry.getAttribute('position');
    colorAttribute = particleGeometry.getAttribute('color');

    // Create the circle texture
    const particleTexture = createCircleTexture(PARTICLE_TEXTURE_SIZE);

    // Material for the points
    particleMaterial = new THREE.PointsMaterial({
        size: PARTICLE_VISUAL_SIZE,
        vertexColors: true,
        sizeAttenuation: false, // Points stay same size regardless of distance in Ortho
        map: particleTexture,
        transparent: true,
        alphaTest: 0.1,
        // depthWrite: false // Usually needed for transparency, test if required
    });

    // The Points object
    particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem); // Particles will be added at Z=0 plane

    // --- Create Particle Data (2D) ---
    createGroup(PARTICLE_COUNT_PER_GROUP, colors.yellow);
    createGroup(PARTICLE_COUNT_PER_GROUP, colors.red);
    createGroup(PARTICLE_COUNT_PER_GROUP, colors.green);

    updateGeometryAttributes(); // Initial population

    // --- Event Listeners ---
    window.addEventListener('resize', onWindowResize, false);

    // --- Start Animation ---
    animate();
}

// --- Particle Data Structure and Creation (2D) ---
function createParticle(x, y, color) {
    return {
        x: x, y: y,       // Position (2D)
        vx: 0, vy: 0,     // Velocity (2D)
        color: color      // THREE.Color object
    };
}

function randomCoord() {
    // Distribute particles within the 2D plane centered at origin
    return (Math.random() - 0.5) * WORLD_SIZE;
}

function createGroup(number, color) {
    const group = []; // Keep track of particles in this specific group if needed elsewhere
    for (let i = 0; i < number; i++) {
        // Create particle with 2D coords
        const p = createParticle(randomCoord(), randomCoord(), color);
        // group.push(p); // Only if you need the 'group' array itself later
        particles.push(p); // Add to the global list
    }
    // return group; // Only if needed
}

// --- Simulation Logic (Purely 2D) ---
function applyRule(particles1, particles2, g) {
    const halfWorldSize = WORLD_SIZE / 2;

    for (let i = 0; i < particles1.length; i++) {
        let fx = 0;
        let fy = 0;
        // No Z component 

        const p1 = particles1[i];

        for (let j = 0; j < particles2.length; j++) {
            const p2 = particles2[j];

            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            // No dz

            const distSq = dx * dx + dy * dy; // 2D squared distance

            // Interaction range check (adjust 80 if needed)
            if (distSq > 0.001 && distSq < 80 * 80) {
                const dist = Math.sqrt(distSq);
                 if (dist > 0) {
                    const F = g / dist; // Force magnitude (inverse distance)
                    fx += F * dx;
                    fy += F * dy;
                    // No fz
                }
            }
        }

        // Update velocity with damping (2D)
        p1.vx = (p1.vx + fx) * 0.5;
        p1.vy = (p1.vy + fy) * 0.5;
        // No vz

        // Update position (2D)
        p1.x += p1.vx;
        p1.y += p1.vy;
        // No z update

        // Boundary Conditions (2D - Bounce off the edges of the centered square)
        if (p1.x <= -halfWorldSize || p1.x >= halfWorldSize) {
            p1.vx *= -1;
            p1.x = Math.max(-halfWorldSize, Math.min(halfWorldSize, p1.x)); // Clamp position
        }
        if (p1.y <= -halfWorldSize || p1.y >= halfWorldSize) {
            p1.vy *= -1;
            p1.y = Math.max(-halfWorldSize, Math.min(halfWorldSize, p1.y)); // Clamp position
        }
        // No z boundary check
    }
}

// --- Update Geometry (Set Z to 0) ---
function updateGeometryAttributes() {
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const index = i * 3;

        // Update position buffer (X, Y from simulation, Z always 0)
        positionAttribute.array[index] = p.x;
        positionAttribute.array[index + 1] = p.y;
        positionAttribute.array[index + 2] = 0; // <-- Set Z coordinate to 0

        // Update color buffer
        colorAttribute.array[index] = p.color.r;
        colorAttribute.array[index + 1] = p.color.g;
        colorAttribute.array[index + 2] = p.color.b;
    }
    // Mark attributes as needing update
    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
}


// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    // --- Run Simulation Rules (2D) ---
    const yellowParticles = particles.filter(p => p.color === colors.yellow);
    const redParticles = particles.filter(p => p.color === colors.red);
    const greenParticles = particles.filter(p => p.color === colors.green);

    applyRule(redParticles, redParticles, 0.1);
    applyRule(yellowParticles, redParticles, 0.15);
    applyRule(greenParticles, greenParticles, -0.7);
    applyRule(greenParticles, redParticles, -0.2);
    applyRule(redParticles, greenParticles, -0.1);
    applyRule(yellowParticles, yellowParticles, 0.1);

    // --- Update Particle Positions/Colors in Geometry ---
    updateGeometryAttributes(); // Will place all particles at Z=0

    // --- Update Controls ---
    controls.update(); // Required if damping is enabled

    // --- Render Scene ---
    renderer.render(scene, camera);
}

// --- Window Resize Handler (Update Orthographic Camera) ---
function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = WORLD_SIZE * 1.1; // Keep consistent with init

    camera.left = frustumSize * aspect / -2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = frustumSize / -2;

    camera.updateProjectionMatrix(); // Important after changing camera properties
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();