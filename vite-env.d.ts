interface ImportMetaEnv {
  readonly VITE_PAPEROID_BUILD_ID?: string;
  readonly VITE_PAPEROID_GIT_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
