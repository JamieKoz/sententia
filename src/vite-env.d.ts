/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AMAZON_ASSOCIATE_TAG?: string;
  readonly VITE_AMAZON_TAG_US?: string;
  readonly VITE_AMAZON_TAG_AU?: string;
  readonly VITE_AMAZON_TAG_GB?: string;
  readonly VITE_AMAZON_TAG_CA?: string;
  readonly VITE_AMAZON_TAG_DE?: string;
  readonly VITE_AMAZON_TAG_FR?: string;
  readonly VITE_AMAZON_TAG_NZ?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
