/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_HIGHSCORE_URL?: string;
  readonly VITE_LOOSE_SPRITES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
