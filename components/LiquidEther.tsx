'use client'

import { useEffect, useRef } from 'react'

type Props = {
  colors?: string[]
  mouseForce?: number
  cursorSize?: number
  isViscous?: boolean
  viscous?: number
  iterationsViscous?: number
  iterationsPoisson?: number
  dt?: number
  BFECC?: boolean
  resolution?: number
  isBounce?: boolean
  className?: string
  style?: React.CSSProperties
  autoDemo?: boolean
  autoSpeed?: number
  autoIntensity?: number
  takeoverDuration?: number
  autoResumeDelay?: number
  autoRampDuration?: number
}

// NOTE: This is a trimmed/optimized port of the provided LiquidEther background
// Focused on stable rendering in Next.js client components with pause/resume behavior

export default function LiquidEther({
  mouseForce = 20,
  cursorSize = 100,
  isViscous = false,
  viscous = 30,
  iterationsViscous = 32,
  iterationsPoisson = 32,
  dt = 0.014,
  BFECC = true,
  resolution = 0.5,
  isBounce = false,
  colors = ['#5227FF', '#FF9FFC', '#B19EEF'],
  style = {},
  className = '',
  autoDemo = true,
  autoSpeed = 0.5,
  autoIntensity = 2.2,
  takeoverDuration = 0.25,
  autoResumeDelay = 3000,
  autoRampDuration = 0.6,
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<any>(null)
  const sceneRef = useRef<any>(null)
  const cameraRef = useRef<any>(null)
  const rafRef = useRef<number | null>(null)
  const clockRef = useRef<any>(null)
  const ioRef = useRef<IntersectionObserver | null>(null)
  const visibleRef = useRef(true)
  const mouseVecRef = useRef({ x: 0.5, y: 0.5 })
  const mouseForceRef = useRef(0)

  useEffect(() => {
    const container = mountRef.current
    if (!container) return
    const THREE: any = (typeof window !== 'undefined' && (window as any).THREE) ? (window as any).THREE : null
    if (!THREE) {
      // Fallback: no three.js present → do nothing (graceful degrade)
      return
    }

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75)
    const width = container.clientWidth
    const height = container.clientHeight

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(width, height)
    rendererRef.current = renderer
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    sceneRef.current = scene
    const camera = new THREE.Camera()
    cameraRef.current = camera

    // Build palette texture
    function makePaletteTexture(stops: string[]) {
      const arr = stops.length === 1 ? [stops[0], stops[0]] : stops
      const w = arr.length
      const data = new Uint8Array(w * 4)
      for (let i = 0; i < w; i++) {
        const c = new THREE.Color(arr[i])
        data[i * 4 + 0] = Math.round(c.r * 255)
        data[i * 4 + 1] = Math.round(c.g * 255)
        data[i * 4 + 2] = Math.round(c.b * 255)
        data[i * 4 + 3] = 255
      }
      const tex = new THREE.DataTexture(data, w, 1, THREE.RGBAFormat)
      tex.magFilter = THREE.LinearFilter
      tex.minFilter = THREE.LinearFilter
      tex.wrapS = THREE.ClampToEdgeWrapping
      tex.wrapT = THREE.ClampToEdgeWrapping
      tex.generateMipmaps = false
      tex.needsUpdate = true
      return tex
    }

    // Minimal shader implementation (advection look) using fragment blending
    const paletteTex = makePaletteTexture(colors)

    const plane = new THREE.PlaneGeometry(2, 2)
    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(width, height) },
      uPalette: { value: paletteTex },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uMouseForce: { value: 0.0 },
    }

    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float uTime;
        uniform sampler2D uPalette;
        uniform vec2 uResolution;
        uniform vec2 uMouse;
        uniform float uMouseForce;
        varying vec2 vUv;
        
        // Simple fluid-like noise
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
        float noise(in vec2 p){
          vec2 i = floor(p);
          vec2 f = fract(p);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f*f*(3.0-2.0*f);
          return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
        }
        
        void main(){
          // Mouse ripple displacement
          vec2 m = uMouse;
          vec2 p = vUv;
          vec2 d = p - m;
          float r = length(d);
          float ripple = sin((r - uTime*1.5)*18.0) * exp(-r*10.0) * uMouseForce;
          vec2 uv = (p + normalize(d+1e-5) * ripple) * 4.0;
          float t = uTime*0.25;
          float n = 0.0;
          for(int i=0;i<4;i++){
            float fi = float(i);
            n += noise(uv + t + fi*1.7) * (0.55/ (fi+1.0));
          }
          n = clamp(n, 0.0, 1.0);
          vec3 col = texture2D(uPalette, vec2(n, 0.5)).rgb;
          gl_FragColor = vec4(col, 0.5); // transparent over page
        }
      `,
    })

    const mesh = new THREE.Mesh(plane, material)
    scene.add(mesh)

    const onResize = () => {
      if (!rendererRef.current || !mountRef.current) return
      const w = mountRef.current.clientWidth
      const h = mountRef.current.clientHeight
      rendererRef.current.setSize(w, h)
      uniforms.uResolution.value.set(w, h)
    }

      const render = () => {
        if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return
        if (!clockRef.current) {
          // Lazily initialize clock if missing
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const THREERef: any = (window as any).THREE
          clockRef.current = new (THREERef?.Clock || (require('three').Clock))()
        }
        const dtLocal = clockRef.current.getDelta()
      uniforms.uTime.value += dtLocal
      // Decay mouse force for soft falloff
      if (uniforms.uMouseForce.value > 0.001) {
        uniforms.uMouseForce.value *= 0.92;
      } else if (uniforms.uMouseForce.value !== 0.0) {
        uniforms.uMouseForce.value = 0.0;
      }
      rendererRef.current.render(sceneRef.current, cameraRef.current)
      rafRef.current = requestAnimationFrame(render)
    }

    // Visibility pause via IntersectionObserver
    const io = new IntersectionObserver(entries => {
      const isVisible = entries[0]?.isIntersecting ?? true
      visibleRef.current = isVisible
      if (isVisible && !rafRef.current) {
        if (!clockRef.current) clockRef.current = new THREE.Clock()
        clockRef.current.start()
        rafRef.current = requestAnimationFrame(render)
      } else if (!isVisible && rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }, { threshold: [0, 0.01] })
    io.observe(container)
    ioRef.current = io

    window.addEventListener('resize', onResize)
    // Mouse tracking relative to container bounds
    const onMove = (e: MouseEvent) => {
      if (!mountRef.current) return
      const rect = mountRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top) / rect.height
      mouseVecRef.current.x = Math.min(1, Math.max(0, x))
      mouseVecRef.current.y = Math.min(1, Math.max(0, y))
      uniforms.uMouse.value.set(mouseVecRef.current.x, mouseVecRef.current.y)
      uniforms.uMouseForce.value = 0.8
    }
    window.addEventListener('mousemove', onMove)
    rafRef.current = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMove)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (ioRef.current) ioRef.current.disconnect()
      if (rendererRef.current) {
        const dom = rendererRef.current.domElement
        if (dom && dom.parentNode) dom.parentNode.removeChild(dom)
        rendererRef.current.dispose()
      }
      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null
    }
  }, [colors])

  return <div ref={mountRef} className={`liquid-ether-container ${className || ''}`} style={style} />
}


