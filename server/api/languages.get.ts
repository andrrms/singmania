import { getAvailableLanguages } from '../utils/songManager'

export default defineEventHandler(async (event) => {
	return await getAvailableLanguages()
})
