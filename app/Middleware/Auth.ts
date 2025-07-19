import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class Auth {
  public async handle(ctx: HttpContextContract, next: () => Promise<void>) {
    // code for middleware goes here. ABOVE THE NEXT CALL
    const APIKEY = ctx.request.header("API_KEY") ?? ""
    if (APIKEY !== process.env.API_KEY) {
      ctx.response.unauthorized({ status: 401, message: "unauthenticated" })
      return
    }
    await next()
  }
}
