declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_MATHPIX_APP_ID: string;
      EXPO_PUBLIC_MATHPIX_APP_KEY: string;
      EXPO_PUBLIC_OPENAI_API_KEY: string;
    }
  }
}

export {};