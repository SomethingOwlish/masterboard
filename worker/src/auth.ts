/**
 * Cloudflare Access puts a signed JWT in `Cf-Access-Jwt-Assertion` for every
 * request that passed its login (decision I2). The Worker verifies the
 * signature against the team's public keys and the application audience,
 * then trusts the `email` claim.
 */

export interface AuthEnv {
  /** e.g. `masterboard.cloudflareaccess.com` */
  ACCESS_TEAM_DOMAIN?: string
  /** Application Audience (AUD) tag from the Access application. */
  ACCESS_AUD?: string
  /** Local development only: acts as this email when Access is not configured. */
  DEV_USER_EMAIL?: string
}

export class AuthError extends Error { constructor(message: string) { super(message); this.name = 'AuthError' } }

interface Jwk { kid: string; kty: string; n: string; e: string; alg?: string }

const b64url = (value: string) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')), (char) => char.charCodeAt(0))
const decodeJson = <T>(part: string): T => JSON.parse(new TextDecoder().decode(b64url(part))) as T

let cachedKeys: { domain: string; at: number; keys: Jwk[] } | null = null

async function teamKeys(domain: string, fetcher: typeof fetch): Promise<Jwk[]> {
  if (cachedKeys && cachedKeys.domain === domain && Date.now() - cachedKeys.at < 10 * 60_000) return cachedKeys.keys
  const response = await fetcher(`https://${domain}/cdn-cgi/access/certs`)
  if (!response.ok) throw new AuthError('Не удалось получить ключи Cloudflare Access')
  const { keys } = await response.json() as { keys: Jwk[] }
  cachedKeys = { domain, at: Date.now(), keys }
  return keys
}

export async function verifyAccessJwt(token: string, env: Required<Pick<AuthEnv, 'ACCESS_TEAM_DOMAIN' | 'ACCESS_AUD'>>, fetcher: typeof fetch = fetch, now = Date.now()): Promise<string> {
  const [headerPart, payloadPart, signaturePart] = token.split('.')
  if (!headerPart || !payloadPart || !signaturePart) throw new AuthError('Некорректный токен входа')
  const header = decodeJson<{ kid: string; alg: string }>(headerPart)
  if (header.alg !== 'RS256') throw new AuthError('Неподдерживаемая подпись токена')
  const jwk = (await teamKeys(env.ACCESS_TEAM_DOMAIN, fetcher)).find((key) => key.kid === header.kid)
  if (!jwk) throw new AuthError('Неизвестный ключ подписи')
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(signaturePart), new TextEncoder().encode(`${headerPart}.${payloadPart}`))
  if (!valid) throw new AuthError('Подпись токена не прошла проверку')
  const payload = decodeJson<{ aud: string | string[]; exp: number; iss: string; email?: string }>(payloadPart)
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!audiences.includes(env.ACCESS_AUD)) throw new AuthError('Токен выдан для другого приложения')
  if (payload.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) throw new AuthError('Токен выдан другой командой')
  if (payload.exp * 1000 < now) throw new AuthError('Срок входа истёк, войдите снова')
  if (!payload.email) throw new AuthError('В токене нет почты')
  return payload.email.toLocaleLowerCase()
}

/** Resolves the signed-in master's email for a request. */
export async function requestEmail(request: Request, env: AuthEnv, fetcher: typeof fetch = fetch): Promise<string> {
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    const token = request.headers.get('Cf-Access-Jwt-Assertion')
    if (!token) throw new AuthError('Нужно войти через Cloudflare Access')
    return verifyAccessJwt(token, { ACCESS_TEAM_DOMAIN: env.ACCESS_TEAM_DOMAIN, ACCESS_AUD: env.ACCESS_AUD }, fetcher)
  }
  if (env.DEV_USER_EMAIL) return env.DEV_USER_EMAIL.toLocaleLowerCase()
  throw new AuthError('Вход не настроен: задайте ACCESS_TEAM_DOMAIN и ACCESS_AUD')
}

export function resetKeyCache() { cachedKeys = null }
