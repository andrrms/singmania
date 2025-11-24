export default defineEventHandler(async (event) => {
  const storage = useStorage('assets:songs')
  const keys = await storage.getKeys()
  const mountPoints = useStorage().getMounts()
  
  return {
    keys,
    mountPoints: mountPoints.map(m => ({ base: m.base, driver: m.driver }))
  }
})
