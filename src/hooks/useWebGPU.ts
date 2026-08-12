import { useRef, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export interface WebGPUParticleConfig {
  count: number;           // up to 1,000,000
  colorPrimary: [number, number, number]; // RGB 0-1
  colorAccent: [number, number, number];
  turbulence: number;      // 0-1
  speed: number;           // multiplier
}

export interface WebGPUState {
  supported: boolean;
  active: boolean;
  particleCount: number;
  computeTime: number;     // ms per frame
  adapterInfo: string;
}

const SIMULATION_WGSL = `
struct Particle {
  pos: vec2f,
  vel: vec2f,
  life: f32,
  maxLife: f32,
  hue: f32,
  size: f32,
}

struct Uniforms {
  deltaTime: f32,
  time: f32,
  bassLevel: f32,
  midLevel: f32,
  highLevel: f32,
  spectralFlux: f32,
  turbulence: f32,
  speed: f32,
  width: f32,
  height: f32,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

// Curl noise helper — creates divergence-free vector field for fluid dynamics
fn hash(p: vec2f) -> f32 {
  var q = fract(p * vec2f(127.1, 311.7));
  q += dot(q, q + 19.19);
  return fract(q.x * q.y);
}

fn noise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f); // smoothstep
  return mix(
    mix(hash(i), hash(i + vec2f(1.0, 0.0)), u.x),
    mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), u.x),
    u.y
  ) * 2.0 - 1.0;
}

// Curl noise: perpendicular gradient of scalar noise field
// This gives fluid-like, divergence-free motion — no particles "pile up"
fn curlNoise(p: vec2f, scale: f32) -> vec2f {
  let eps = 0.001;
  let n1 = noise(p * scale + vec2f(0.0, eps));
  let n2 = noise(p * scale - vec2f(0.0, eps));
  let n3 = noise(p * scale + vec2f(eps, 0.0));
  let n4 = noise(p * scale - vec2f(eps, 0.0));
  // Curl: dFy/dx - dFx/dy
  let curl = vec2f(
    (n1 - n2) / (2.0 * eps),
    -(n3 - n4) / (2.0 * eps)
  );
  return normalize(curl + vec2f(0.001)); // avoid zero vector
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&particles)) { return; }

  var p = particles[i];
  let dt = uniforms.deltaTime;
  let t = uniforms.time;

  // Normalized position for noise sampling
  let normPos = p.pos / vec2f(uniforms.width, uniforms.height);

  // --- Fluid dynamics via curl noise ---
  let curlScale = 2.0 + uniforms.turbulence * 3.0;
  let curlForce = curlNoise(normPos + vec2f(t * 0.05), curlScale);

  // --- Audio-reactive forces ---
  // Bass: radial explosion from center
  let center = vec2f(uniforms.width * 0.5, uniforms.height * 0.5);
  let toCenter = center - p.pos;
  let dist = length(toCenter);
  let radialDir = normalize(p.pos - center + vec2f(0.001));
  let bassExplosion = radialDir * uniforms.bassLevel * uniforms.spectralFlux * 180.0;

  // Mid: vortex rotation around center
  let vortexDir = vec2f(-toCenter.y, toCenter.x) / max(dist, 1.0);
  let midVortex = vortexDir * uniforms.midLevel * 40.0;

  // High: high-frequency shimmer (random-ish per particle using hue as seed)
  let shimmerAngle = p.hue * 6.283 + t * 8.0;
  let shimmer = vec2f(cos(shimmerAngle), sin(shimmerAngle)) * uniforms.highLevel * 20.0;

  // --- Accumulate forces ---
  let curlVelocity = curlForce * uniforms.turbulence * 60.0;
  p.vel += (curlVelocity + bassExplosion + midVortex + shimmer) * dt;

  // Velocity damping (fluid viscosity)
  let damping = 0.92 - uniforms.spectralFlux * 0.06;
  p.vel *= damping;

  // Speed limit
  let maxSpeed = 200.0 * uniforms.speed;
  let spd = length(p.vel);
  if (spd > maxSpeed) {
    p.vel = normalize(p.vel) * maxSpeed;
  }

  // --- Position integration ---
  p.pos += p.vel * dt * uniforms.speed;

  // --- Toroidal wrap (seamless boundaries) ---
  if (p.pos.x < -20.0) { p.pos.x = uniforms.width + 20.0; }
  if (p.pos.x > uniforms.width + 20.0) { p.pos.x = -20.0; }
  if (p.pos.y < -20.0) { p.pos.y = uniforms.height + 20.0; }
  if (p.pos.y > uniforms.height + 20.0) { p.pos.y = -20.0; }

  // --- Lifecycle ---
  p.life += dt;
  if (p.life > p.maxLife) {
    // Respawn at random position
    let seed = hash(vec2f(f32(i), t));
    let seed2 = hash(vec2f(t, f32(i)));
    p.pos = vec2f(seed * uniforms.width, seed2 * uniforms.height);
    p.vel = vec2f(0.0);
    p.life = 0.0;
    p.maxLife = 4.0 + hash(vec2f(f32(i) * 1.3, t * 0.7)) * 8.0;
  }

  particles[i] = p;
}
`;

export function useWebGPU() {
  const [gpuState, setGpuState] = useState<WebGPUState>({
    supported: false,
    active: false,
    particleCount: 0,
    computeTime: 0,
    adapterInfo: '',
  });

  const deviceRef = useRef<GPUDevice | null>(null);
  const particleBufferRef = useRef<GPUBuffer | null>(null);
  const uniformBufferRef = useRef<GPUBuffer | null>(null);
  const computePipelineRef = useRef<GPUComputePipeline | null>(null);
  const bindGroupRef = useRef<GPUBindGroup | null>(null);
  const particleCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  const init = useCallback(async (config: WebGPUParticleConfig): Promise<boolean> => {
    if (!navigator.gpu) {
      console.warn('[WebGPU] navigator.gpu not available. Requires Chrome 113+ with WebGPU enabled.');
      setGpuState(prev => ({ ...prev, supported: false }));
      return false;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance', // Force discrete GPU (NVIDIA/AMD) over integrated
      });

      if (!adapter) {
        console.warn('[WebGPU] No suitable GPU adapter found.');
        return false;
      }

      // Get adapter info for display
      let adapterName = 'Unknown GPU';
      try {
        const info = await adapter.requestAdapterInfo();
        adapterName = info.device || info.vendor || 'GPU';
        console.log('[WebGPU] Adapter:', info);
      } catch {
        adapterName = 'WebGPU GPU';
      }

      const device = await adapter.requestDevice({
        requiredLimits: {
          maxComputeWorkgroupsPerDimension: 65535,
          maxStorageBufferBindingSize: Math.min(
            adapter.limits.maxStorageBufferBindingSize,
            config.count * 32 * 4, // 32 floats per particle × 4 bytes
          ),
        },
      });

      device.lost.then((info) => {
        console.warn('[WebGPU] Device lost:', info.reason, info.message);
        setGpuState(prev => ({ ...prev, active: false }));
      });

      deviceRef.current = device;
      particleCountRef.current = config.count;

      // --- Initialize particle data ---
      // Each particle: pos(2) + vel(2) + life(1) + maxLife(1) + hue(1) + size(1) = 8 floats = 32 bytes
      const FLOATS_PER_PARTICLE = 8;
      const particleData = new Float32Array(config.count * FLOATS_PER_PARTICLE);
      for (let i = 0; i < config.count; i++) {
        const base = i * FLOATS_PER_PARTICLE;
        particleData[base + 0] = Math.random() * 1920;  // x
        particleData[base + 1] = Math.random() * 1080;  // y
        particleData[base + 2] = (Math.random() - 0.5) * 40; // vx
        particleData[base + 3] = (Math.random() - 0.5) * 40; // vy
        particleData[base + 4] = Math.random() * 8;     // life
        particleData[base + 5] = 4 + Math.random() * 8; // maxLife
        particleData[base + 6] = Math.random();          // hue (0-1)
        particleData[base + 7] = 0.5 + Math.random() * 2; // size
      }

      particleBufferRef.current = device.createBuffer({
        size: particleData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });
      new Float32Array(particleBufferRef.current.getMappedRange()).set(particleData);
      particleBufferRef.current.unmap();

      // Uniform buffer: 10 f32 values = 40 bytes (padded to 48)
      uniformBufferRef.current = device.createBuffer({
        size: 48,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Compile compute shader
      const shaderModule = device.createShaderModule({ code: SIMULATION_WGSL });
      const shaderInfo = await shaderModule.getCompilationInfo();
      const errors = shaderInfo.messages.filter(m => m.type === 'error');
      if (errors.length > 0) {
        console.error('[WebGPU] Shader compilation errors:', errors);
        return false;
      }

      computePipelineRef.current = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module: shaderModule, entryPoint: 'main' },
      });

      bindGroupRef.current = device.createBindGroup({
        layout: computePipelineRef.current.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: particleBufferRef.current } },
          { binding: 1, resource: { buffer: uniformBufferRef.current } },
        ],
      });

      setGpuState({
        supported: true,
        active: true,
        particleCount: config.count,
        computeTime: 0,
        adapterInfo: adapterName,
      });

      console.log(`[WebGPU] Initialized: ${config.count.toLocaleString()} particles on ${adapterName}`);
      toast.success('WebGPU Compute Active', {
        description: `${config.count.toLocaleString()} particles · ${adapterName} · Curl Noise fluid dynamics`,
      });

      return true;
    } catch (err) {
      console.error('[WebGPU] Initialization failed:', err);
      setGpuState(prev => ({ ...prev, supported: false }));
      return false;
    }
  }, []);

  /**
   * Run one compute pass on the GPU.
   * Updates all particle positions/velocities using audio-reactive curl noise.
   * Returns the updated particle data as a Float32Array for canvas rendering.
   */
  const compute = useCallback(async (audioData: {
    bassLevel: number;
    midLevel: number;
    highLevel: number;
    spectralFlux: number;
  }, canvasWidth: number, canvasHeight: number): Promise<Float32Array | null> => {
    const device = deviceRef.current;
    const particleBuffer = particleBufferRef.current;
    const uniformBuffer = uniformBufferRef.current;
    const pipeline = computePipelineRef.current;
    const bindGroup = bindGroupRef.current;

    if (!device || !particleBuffer || !uniformBuffer || !pipeline || !bindGroup) return null;

    const now = performance.now();
    const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05); // cap at 50ms
    lastTimeRef.current = now;

    // Write uniforms
    const uniforms = new Float32Array([
      dt,
      now / 1000,
      audioData.bassLevel,
      audioData.midLevel,
      audioData.highLevel,
      audioData.spectralFlux,
      0.6,  // turbulence (could be style-driven)
      1.0,  // speed
      canvasWidth,
      canvasHeight,
    ]);
    device.queue.writeBuffer(uniformBuffer, 0, uniforms);

    // Dispatch compute shader
    const t0 = performance.now();
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    // workgroups = ceil(count / workgroup_size(256))
    const workgroups = Math.ceil(particleCountRef.current / 256);
    passEncoder.dispatchWorkgroups(workgroups);
    passEncoder.end();

    // Read back particle positions for canvas rendering
    const BYTES_PER_PARTICLE = 8 * 4;
    const readbackBuffer = device.createBuffer({
      size: particleCountRef.current * BYTES_PER_PARTICLE,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    commandEncoder.copyBufferToBuffer(
      particleBuffer, 0,
      readbackBuffer, 0,
      particleCountRef.current * BYTES_PER_PARTICLE
    );

    device.queue.submit([commandEncoder.finish()]);

    await readbackBuffer.mapAsync(GPUMapMode.READ);
    const result = new Float32Array(readbackBuffer.getMappedRange().slice(0));
    readbackBuffer.unmap();
    readbackBuffer.destroy();

    const computeMs = performance.now() - t0;
    setGpuState(prev => ({ ...prev, computeTime: computeMs }));

    return result;
  }, []);

  const destroy = useCallback(() => {
    particleBufferRef.current?.destroy();
    uniformBufferRef.current?.destroy();
    deviceRef.current?.destroy();
    deviceRef.current = null;
    particleBufferRef.current = null;
    uniformBufferRef.current = null;
    computePipelineRef.current = null;
    bindGroupRef.current = null;
    setGpuState(prev => ({ ...prev, active: false }));
  }, []);

  useEffect(() => {
    return () => destroy();
  }, [destroy]);

  return { gpuState, init, compute, destroy };
}
