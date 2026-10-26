export function noStore(_request, response, next) {
  response.set('Cache-Control', 'no-store')
  next()
}
