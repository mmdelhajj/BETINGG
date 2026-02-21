declare module 'speakeasy' {
  interface GenerateSecretOptions {
    name?: string;
    issuer?: string;
    length?: number;
    symbols?: boolean;
    otpauth_url?: boolean;
    google_auth_qr?: boolean;
  }

  interface GeneratedSecret {
    ascii: string;
    hex: string;
    base32: string;
    otpauth_url?: string;
    google_auth_qr?: string;
  }

  interface TotpVerifyOptions {
    secret: string;
    encoding?: 'ascii' | 'hex' | 'base32';
    token: string;
    window?: number;
    step?: number;
    epoch?: number;
    counter?: number;
    digits?: number;
    algorithm?: string;
  }

  interface TotpTokenOptions {
    secret: string;
    encoding?: 'ascii' | 'hex' | 'base32';
    step?: number;
    epoch?: number;
    counter?: number;
    digits?: number;
    algorithm?: string;
    time?: number;
  }

  function generateSecret(options?: GenerateSecretOptions): GeneratedSecret;

  const totp: {
    verify(options: TotpVerifyOptions): boolean;
    generate(options: TotpTokenOptions): string;
  };

  const hotp: {
    verify(options: TotpVerifyOptions & { counter: number }): boolean;
    generate(options: TotpTokenOptions & { counter: number }): string;
  };

  export { generateSecret, totp, hotp };
  export type {
    GenerateSecretOptions,
    GeneratedSecret,
    TotpVerifyOptions,
    TotpTokenOptions,
  };
}
