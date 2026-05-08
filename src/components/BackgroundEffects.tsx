import { useEffect, useRef } from 'react'

export function BackgroundEffects() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mouseGlowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mouseGlow = mouseGlowRef.current
    if (!mouseGlow) return

    const handleMouseMove = (event: MouseEvent) => {
      mouseGlow.style.left = `${event.clientX}px`
      mouseGlow.style.top = `${event.clientY}px`
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => document.removeEventListener('mousemove', handleMouseMove)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    interface Particle {
      x: number
      y: number
      size: number
      speedX: number
      speedY: number
      color: string
    }

    let animationFrameId = 0
    let particles: Particle[] = []
    const numParticles = 100

    const createParticle = (): Particle => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 1,
      speedX: Math.random() * 3 - 1.5,
      speedY: Math.random() * 3 - 1.5,
      color: `hsl(${Math.random() * 140 + 200}, 100%, 70%)`,
    })

    const initBackground = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      particles = Array.from({ length: numParticles }, createParticle)
    }

    const animateBackground = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      particles = particles.map((particle) => {
        const next = {
          ...particle,
          x: particle.x + particle.speedX,
          y: particle.y + particle.speedY,
          size: particle.size > 0.2 ? particle.size - 0.1 : particle.size,
        }

        if (next.size <= 0.2) return createParticle()

        ctx.fillStyle = next.color
        ctx.beginPath()
        ctx.arc(next.x, next.y, next.size, 0, Math.PI * 2)
        ctx.fill()

        return next
      })

      animationFrameId = requestAnimationFrame(animateBackground)
    }

    initBackground()
    animateBackground()
    window.addEventListener('resize', initBackground)

    return () => {
      window.removeEventListener('resize', initBackground)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <>
      <canvas id="background-animation-canvas" ref={canvasRef} />
      <div id="mouse-glow" ref={mouseGlowRef} />
    </>
  )
}