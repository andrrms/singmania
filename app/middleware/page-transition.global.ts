export default defineNuxtRouteMiddleware((to, from) => {
	const getDepth = (path: string) => {
		if (path === '/') return 0
		if (path.startsWith('/library')) return 1
		if (path.startsWith('/search')) return 2
		if (path.startsWith('/settings')) return 3
		return 0
	}

	const toDepth = getDepth(to.path)
	const fromDepth = getDepth(from.path)

	if (toDepth > fromDepth) {
		to.meta.pageTransition = { name: 'slide-up', mode: 'out-in' }
		from.meta.pageTransition = { name: 'slide-up', mode: 'out-in' }
	} else if (toDepth < fromDepth) {
		to.meta.pageTransition = { name: 'slide-down', mode: 'out-in' }
		from.meta.pageTransition = { name: 'slide-down', mode: 'out-in' }
	} else {
		to.meta.pageTransition = { name: 'page', mode: 'out-in' }
		from.meta.pageTransition = { name: 'page', mode: 'out-in' }
	}
})
