// PAT (and any future secret) storage. The token is encrypted at rest with an
// AES-GCM key that is generated once and kept in IndexedDB as a NON-extractable
// CryptoKey: the raw key bytes never leave the browser and the ciphertext is
// useless without it. This is "encrypted in IndexedDB, never committed" per
// DESIGN.md §3 without forcing the GM to manage a passphrase.

import { STORE_SECRETS, idbDelete, idbGet, idbPut } from './idb'

const KEY_ID = 'crypto-key'
const TOKEN_ID = 'github-pat'

interface EncryptedBlob {
  iv: number[]
  data: number[]
}

async function getKey(): Promise<CryptoKey> {
  const existing = await idbGet<CryptoKey>(STORE_SECRETS, KEY_ID)
  if (existing) return existing
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ])
  await idbPut(STORE_SECRETS, KEY_ID, key)
  return key
}

export async function setToken(token: string): Promise<void> {
  if (!token) {
    await clearToken()
    return
  }
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(token)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const blob: EncryptedBlob = { iv: Array.from(iv), data: Array.from(new Uint8Array(cipher)) }
  await idbPut(STORE_SECRETS, TOKEN_ID, blob)
}

export async function getToken(): Promise<string | null> {
  const blob = await idbGet<EncryptedBlob>(STORE_SECRETS, TOKEN_ID)
  if (!blob) return null
  try {
    const key = await getKey()
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(blob.iv) },
      key,
      new Uint8Array(blob.data),
    )
    return new TextDecoder().decode(plain)
  } catch {
    return null // key rotated or blob corrupt — treat as no token
  }
}

export async function hasToken(): Promise<boolean> {
  return (await idbGet<EncryptedBlob>(STORE_SECRETS, TOKEN_ID)) != null
}

export async function clearToken(): Promise<void> {
  await idbDelete(STORE_SECRETS, TOKEN_ID)
}
