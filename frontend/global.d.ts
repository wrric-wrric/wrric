export {};

declare global {
  interface Window {
    grecaptcha: any;
    onRecaptchaLoadCallback?: () => void;
    __setRecaptchaToken?: (token: string) => void;
  }
}