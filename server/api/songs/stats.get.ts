import { getLibraryStats } from '../../utils/songManager'

export default defineEventHandler(async (event) => {
  return await getLibraryStats()
})
