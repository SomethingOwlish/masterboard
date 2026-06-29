/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * tldraw license key. tldraw disables its editor on production deployments
   * (https + non-localhost) unless a key is provided — see SessionPlanner. Get a
   * free, watermarked key at https://tldraw.dev. The key is domain-scoped and is
   * meant to ship in the client bundle, so it's safe to set as a public build
   * variable. Leave unset for local (localhost) development.
   */
  readonly VITE_TLDRAW_LICENSE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
