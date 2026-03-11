export interface loginData {
    username?: string;
    email?: string;
    password: string;
    recaptchaResponse: string;
}

export interface loginResponse {
    message: string;
}

export interface registerData {
    username: string;
    password: string;
    type: string;
    // email: string;
    action: string;
}

export interface registerResponse {
    message: string;
}