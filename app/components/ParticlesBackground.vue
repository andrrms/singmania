<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationId: number

interface Particle {
	x: number
	y: number
	size: number
	speedX: number
	speedY: number
	color: string
	opacity: number
}

const particles: Particle[] = []
const colors = ['#8b5cf6', '#3b82f6', '#ec4899'] // Violet, Blue, Pink

const createParticle = (width: number, height: number): Particle => {
	return {
		x: Math.random() * width,
		y: Math.random() * height,
		size: Math.random() * 3 + 1,
		speedX: (Math.random() - 0.5) * 0.5,
		speedY: (Math.random() - 0.5) * 0.5,
		color: colors[Math.floor(Math.random() * colors.length)],
		opacity: Math.random() * 0.5 + 0.1
	}
}

const initParticles = (width: number, height: number) => {
	particles.length = 0
	const particleCount = Math.min(Math.floor((width * height) / 15000), 100) // Responsive count
	for (let i = 0; i < particleCount; i++) {
		particles.push(createParticle(width, height))
	}
}

const animate = () => {
	const canvas = canvasRef.value
	if (!canvas) return
	const ctx = canvas.getContext('2d')
	if (!ctx) return

	ctx.clearRect(0, 0, canvas.width, canvas.height)

	particles.forEach((p) => {
		p.x += p.speedX
		p.y += p.speedY

		// Wrap around
		if (p.x < 0) p.x = canvas.width
		if (p.x > canvas.width) p.x = 0
		if (p.y < 0) p.y = canvas.height
		if (p.y > canvas.height) p.y = 0

		ctx.beginPath()
		ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
		ctx.fillStyle = p.color
		ctx.globalAlpha = p.opacity
		ctx.fill()
	})

	// Draw connections
	ctx.globalAlpha = 0.05
	ctx.strokeStyle = '#ffffff'
	ctx.lineWidth = 0.5

	for (let i = 0; i < particles.length; i++) {
		for (let j = i + 1; j < particles.length; j++) {
			const dx = particles[i].x - particles[j].x
			const dy = particles[i].y - particles[j].y
			const distance = Math.sqrt(dx * dx + dy * dy)

			if (distance < 150) {
				ctx.beginPath()
				ctx.moveTo(particles[i].x, particles[i].y)
				ctx.lineTo(particles[j].x, particles[j].y)
				ctx.stroke()
			}
		}
	}

	animationId = requestAnimationFrame(animate)
}

const handleResize = () => {
	if (canvasRef.value) {
		canvasRef.value.width = window.innerWidth
		canvasRef.value.height = window.innerHeight
		initParticles(window.innerWidth, window.innerHeight)
	}
}

onMounted(() => {
	handleResize()
	window.addEventListener('resize', handleResize)
	animate()
})

onUnmounted(() => {
	window.removeEventListener('resize', handleResize)
	cancelAnimationFrame(animationId)
})
</script>

<template>
	<canvas ref="canvasRef" class="fixed inset-0 z-0 pointer-events-none"></canvas>
</template>
