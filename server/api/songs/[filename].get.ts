import { getSongContent } from '../../utils/songManager'

export default defineEventHandler(async (event) => {
  const filenameParam = getRouterParam(event, 'filename')
  
  if (!filenameParam) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Filename is required'
    })
  }

  const filename = decodeURIComponent(filenameParam)
  const content = await getSongContent(filename)

  if (!content) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Song not found'
    })
  }

  return content
})
