/**
 * WEBGL-BACKGROUND.JS
 * High-performance Three.js interactive 3D particle constellation & neural warp.
 * Features mouse gravity, scroll depth parallax, and auto-pause when inactive.
 */

class WebGLBackground {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas || typeof THREE === 'undefined') {
      console.warn('Three.js or Canvas element not found.');
      return;
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particles = null;
    this.lineMesh = null;

    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
    this.particleCount = isMobile ? 42 : (isTablet ? 85 : 160);
    this.particlePositions = null;
    this.particleVelocities = [];
    this.maxDistance = isMobile ? 105 : 140;

    this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    this.scrollProgress = 0;
    this.targetScrollProgress = 0;
    this.isRunning = true;
    this.wasRunningBeforeHidden = false;
    this.animationFrameId = null;

    this.init();
  }

  init() {
    const isMobile = window.innerWidth < 768;

    // 1. Scene & Camera setup
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      1,
      2000
    );
    this.camera.position.z = 650;

    // 2. WebGL Renderer with alpha transparency & antialiasing
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));

    // 3. Create Particle Field
    this.createParticles();

    // 4. Bind events
    this.bindEvents();

    // 5. Start Render Loop
    this.render();
  }

  createParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);

    // Cyan, Neon Purple, and White color palette
    const colorChoices = [
      new THREE.Color(0x00f0ff), // Cyber Cyan
      new THREE.Color(0x8b5cf6), // Neon Purple
      new THREE.Color(0xec4899), // Plasma Pink
      new THREE.Color(0xffffff)  // Pure White
    ];

    const bounds = 800;
    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * bounds * 1.5;
      positions[i3 + 1] = (Math.random() - 0.5) * bounds;
      positions[i3 + 2] = (Math.random() - 0.5) * bounds;

      // Random velocities
      this.particleVelocities.push({
        x: (Math.random() - 0.5) * 0.45,
        y: (Math.random() - 0.5) * 0.45,
        z: (Math.random() - 0.5) * 0.45
      });

      // Assign subtle cyber color
      const chosenColor = colorChoices[Math.floor(Math.random() * colorChoices.length)];
      colors[i3] = chosenColor.r;
      colors[i3 + 1] = chosenColor.g;
      colors[i3 + 2] = chosenColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.particlePositions = positions;

    // Glowing particle texture using custom canvas shader texture
    const particleTexture = this.generateParticleTexture();

    const particleMaterial = new THREE.PointsMaterial({
      size: 4.5,
      map: particleTexture,
      transparent: true,
      opacity: 0.85,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particles = new THREE.Points(geometry, particleMaterial);
    this.scene.add(this.particles);

    // Dynamic Line Mesh connecting nearby nodes
    const lineGeometry = new THREE.BufferGeometry();
    const maxLineSegments = (this.particleCount * (this.particleCount - 1)) / 2;
    const linePositions = new Float32Array(maxLineSegments * 6);
    const lineColors = new Float32Array(maxLineSegments * 6);

    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage));

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.lineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    this.scene.add(this.lineMesh);
  }

  generateParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(0, 240, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.25)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  bindEvents() {
    window.addEventListener('resize', () => this.onResize(), { passive: true });

    window.addEventListener('mousemove', (e) => {
      this.mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      this.mouse.targetY = -(e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    // Touch interaction for mobile devices
    window.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) {
        this.mouse.targetX = (e.touches[0].clientX / window.innerWidth - 0.5) * 1.8;
        this.mouse.targetY = -(e.touches[0].clientY / window.innerHeight - 0.5) * 1.8;
      }
    }, { passive: true });

    window.addEventListener('scroll', () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      this.targetScrollProgress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    }, { passive: true });

    // Pause WebGL rendering when tab is hidden or phone screen is locked to save battery
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.isRunning) {
          this.wasRunningBeforeHidden = true;
          this.pause();
        }
      } else if (this.wasRunningBeforeHidden) {
        this.wasRunningBeforeHidden = false;
        this.resume();
      }
    });
  }

  onResize() {
    if (!this.camera || !this.renderer) return;
    const isMobile = window.innerWidth < 768;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  }

  render() {
    if (!this.isRunning) return;

    // Autonomous subtle harmonic drift so field breathes on mobile when idle
    const time = performance.now() * 0.0006;
    const autoX = Math.sin(time) * 0.15;
    const autoY = Math.cos(time * 0.8) * 0.12;

    // Smooth lerp mouse & scroll
    this.mouse.x += (this.mouse.targetX + autoX - this.mouse.x) * 0.05;
    this.mouse.y += (this.mouse.targetY + autoY - this.mouse.y) * 0.05;
    this.scrollProgress += (this.targetScrollProgress - this.scrollProgress) * 0.08;

    // Subtle camera drift based on mouse & scroll depth
    this.camera.position.x = this.mouse.x * 60;
    this.camera.position.y = this.mouse.y * 60;
    this.camera.position.z = 650 - this.scrollProgress * 250;
    this.camera.lookAt(this.scene.position);

    // Particle update and connection calculation
    if (this.particles && this.lineMesh) {
      const positions = this.particles.geometry.attributes.position.array;
      const linePositions = this.lineMesh.geometry.attributes.position.array;
      const lineColors = this.lineMesh.geometry.attributes.color.array;

      let lineVertexCount = 0;
      const bounds = 800;

      for (let i = 0; i < this.particleCount; i++) {
        const i3 = i * 3;

        // Apply velocity
        positions[i3] += this.particleVelocities[i].x;
        positions[i3 + 1] += this.particleVelocities[i].y;
        positions[i3 + 2] += this.particleVelocities[i].z;

        // Bounce back if out of bounds
        if (Math.abs(positions[i3]) > bounds * 0.8) this.particleVelocities[i].x *= -1;
        if (Math.abs(positions[i3 + 1]) > bounds * 0.5) this.particleVelocities[i].y *= -1;
        if (Math.abs(positions[i3 + 2]) > bounds * 0.5) this.particleVelocities[i].z *= -1;

        // Connect lines between nearby nodes
        for (let j = i + 1; j < this.particleCount; j++) {
          const j3 = j * 3;
          const dx = positions[i3] - positions[j3];
          const dy = positions[i3 + 1] - positions[j3 + 1];
          const dz = positions[i3 + 2] - positions[j3 + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < this.maxDistance) {
            const alpha = (1.0 - dist / this.maxDistance) * 0.4;

            linePositions[lineVertexCount * 3] = positions[i3];
            linePositions[lineVertexCount * 3 + 1] = positions[i3 + 1];
            linePositions[lineVertexCount * 3 + 2] = positions[i3 + 2];

            lineColors[lineVertexCount * 3] = 0.0;
            lineColors[lineVertexCount * 3 + 1] = 0.94;
            lineColors[lineVertexCount * 3 + 2] = 1.0;
            lineVertexCount++;

            linePositions[lineVertexCount * 3] = positions[j3];
            linePositions[lineVertexCount * 3 + 1] = positions[j3 + 1];
            linePositions[lineVertexCount * 3 + 2] = positions[j3 + 2];

            lineColors[lineVertexCount * 3] = 0.55;
            lineColors[lineVertexCount * 3 + 1] = 0.36;
            lineColors[lineVertexCount * 3 + 2] = 0.96;
            lineVertexCount++;
          }
        }
      }

      this.particles.geometry.attributes.position.needsUpdate = true;
      this.lineMesh.geometry.setDrawRange(0, lineVertexCount);
      this.lineMesh.geometry.attributes.position.needsUpdate = true;
      this.lineMesh.geometry.attributes.color.needsUpdate = true;

      // Slow orbital rotation
      this.particles.rotation.y += 0.0006;
      this.lineMesh.rotation.y += 0.0006;
    }

    this.renderer.render(this.scene, this.camera);
    this.animationFrameId = requestAnimationFrame(() => this.render());
  }

  pause() {
    this.isRunning = false;
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.canvas) this.canvas.style.display = 'none';
  }

  resume() {
    if (this.isRunning) return;
    this.isRunning = true;
    if (this.canvas) this.canvas.style.display = 'block';
    this.render();
  }
}

// Global initialization helper
window.initWebGLBackground = function() {
  return new WebGLBackground('three-canvas');
};
