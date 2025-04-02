import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Simulation Parameters ---
const WORLD_SIZE = 500;
const PARTICLE_COUNT_PER_GROUP = 1000;
const PARTICLE_VISUAL_SIZE = 2; 
const PARTICLE_TEXTURE_SIZE = 64; 
const DAMPING_FACTOR = 0.5

// --- Three.js Setup ---
let scene, camera, renderer, controls;
let particleGeometry, particleMaterial, particleSystem;
let positionAttribute, colorAttribute;

// --- Simulation Data ---
const particles = [];
const particleGroups = {
    yellow: [],
    red: [],
    green: [],
}
const colors = {
    yellow: new THREE.Color("yellow"),
    red: new THREE.Color("red"),
    green: new THREE.Color("green")
};

// --- Helper function to create a circle texture ---
function createCircleTexture(size, color = 'white') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.45; // Make circle slightly smaller than canvas bounds

    context.beginPath();
    context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
    context.fillStyle = color;
    context.fill();
    // The canvas background is transparent by default

    return new THREE.CanvasTexture(canvas); // Create Three.js texture from canvas
}

// --- Initialization ---
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 2000);
    camera.position.z = WORLD_SIZE * 0.8;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 100;
    controls.maxDistance = WORLD_SIZE * 2;
    controls.maxPolarAngle = Math.PI;

    // --- Particle System Setup ---
    particleGeometry = new THREE.BufferGeometry();
    const totalParticles = PARTICLE_COUNT_PER_GROUP * 3;

    const positions = new Float32Array(totalParticles * 3);
    const colorsAttrib = new Float32Array(totalParticles * 3);

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colorsAttrib, 3));

    positionAttribute = particleGeometry.getAttribute('position');
    colorAttribute = particleGeometry.getAttribute('color');

    // Create the circle texture
    const particleTexture = createCircleTexture(PARTICLE_TEXTURE_SIZE); // <-- Create texture

    // Material for the points
    particleMaterial = new THREE.PointsMaterial({
        size: PARTICLE_VISUAL_SIZE,
        vertexColors: true,
        sizeAttenuation: true,
        map: particleTexture,      // <-- Use the texture map
        transparent: true,         // <-- Enable transparency for the texture map
        alphaTest: 0.1,            // <-- Don't render pixels with low alpha (optional, helps edges)
        // Optional: blending: THREE.AdditiveBlending, // For a brighter/glowing look on overlap
        // Optional: depthWrite: false // Often used with transparent objects
    });

    // The Points object
    particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);

    // --- Create Particle Data ---
    createGroup(PARTICLE_COUNT_PER_GROUP, colors.yellow, 'yellow');
    createGroup(PARTICLE_COUNT_PER_GROUP, colors.red, 'red');
    createGroup(PARTICLE_COUNT_PER_GROUP, colors.green, 'green');

    updateGeometryAttributes(); // Initial population

    // --- Event Listeners ---
    window.addEventListener('resize', onWindowResize, false);

    // --- Start Animation ---
    animate();
}

// --- Particle Data Structure and Creation ---

function createParticle(x, y, z, color) {
    return { x: x, y: y, z: z, vx: 0, vy: 0, vz: 0, color: color };
}
function randomCoord() {
    return (Math.random() - 0.5) * WORLD_SIZE;
}
function createGroup(number, color, groupName) {
    // const group = [];
    for (let i = 0; i < number; i++) {
        const p = createParticle(randomCoord(), randomCoord(), randomCoord(), color);
        // group.push(p);
        particles.push(p);
        particleGroups[groupName].push(p);
    }
    // return group; // Not strictly needed 
}


// --- Simulation Logic ---
function applyRule(particles1, particles2, g) {
    const halfWorldSize = WORLD_SIZE / 2;
    for (let i = 0; i < particles1.length; i++) {
        let fx = 0, fy = 0, fz = 0;
        const p1 = particles1[i];
        for (let j = 0; j < particles2.length; j++) {
            const p2 = particles2[j];
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const dz = p1.z - p2.z;
            const distSq = dx * dx + dy * dy + dz * dz;
            if (distSq > 0.001 && distSq < 100 * 100) {
                const dist = Math.sqrt(distSq);
                 if (dist > 0) {
                    const F = g / dist;
                    fx += F * dx;
                    fy += F * dy;
                    fz += F * dz;
                }
            }
        }
        p1.vx = (p1.vx + fx) * DAMPING_FACTOR;
        p1.vy = (p1.vy + fy) * DAMPING_FACTOR;
        p1.vz = (p1.vz + fz) * DAMPING_FACTOR;
        p1.x += p1.vx;
        p1.y += p1.vy;
        p1.z += p1.vz;

        // Boundary Conditions
        if (p1.x <= -halfWorldSize || p1.x >= halfWorldSize) { p1.vx *= -1; p1.x = Math.max(-halfWorldSize, Math.min(halfWorldSize, p1.x)); }
        if (p1.y <= -halfWorldSize || p1.y >= halfWorldSize) { p1.vy *= -1; p1.y = Math.max(-halfWorldSize, Math.min(halfWorldSize, p1.y)); }
        if (p1.z <= -halfWorldSize || p1.z >= halfWorldSize) { p1.vz *= -1; p1.z = Math.max(-halfWorldSize, Math.min(halfWorldSize, p1.z)); }
    }
}

// --- Update Geometry ---

function updateGeometryAttributes() {
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const index = i * 3;
        positionAttribute.array[index] = p.x;
        positionAttribute.array[index + 1] = p.y;
        positionAttribute.array[index + 2] = p.z;
        colorAttribute.array[index] = p.color.r;
        colorAttribute.array[index + 1] = p.color.g;
        colorAttribute.array[index + 2] = p.color.b;
    }
    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
}

// --- Animation Loop ---

function animate() {
    requestAnimationFrame(animate);

    const yellowParticles = particleGroups.yellow;
    const redParticles = particleGroups.red;
    const greenParticles = particleGroups.green;

    applyRule(redParticles, redParticles, 0.1);
    applyRule(yellowParticles, redParticles, 0.15);
    applyRule(greenParticles, greenParticles, -0.7);
    applyRule(greenParticles, redParticles, -0.2);
    applyRule(redParticles, greenParticles, -0.1);
    applyRule(yellowParticles, yellowParticles, 0.1);

    updateGeometryAttributes();
    controls.update();
    renderer.render(scene, camera);
}

// --- Window Resize Handler ---

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Start ---
init();