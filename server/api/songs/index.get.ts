
import { getSongs } from '../../utils/songManager'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Number(query.page) || 1
  const limit = Number(query.limit) || 50
  const search = (query.search as string || '').toLowerCase()
  const sort = (query.sort as string || 'title')
  const type = (query.type as string || 'all')
  const language = (query.language as string || 'all')

  const { data, total } = await getSongs({
    page,
    limit,
    search,
    sort,
    type,
    language
  })

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  }
})
