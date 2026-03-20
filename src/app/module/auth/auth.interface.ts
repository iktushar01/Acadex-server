export interface IRegisterStudent {
    name: string;
    email: string;
    password: string;
}



export interface ILoginUser {
    email: string;
    password: string;
}


export interface IRequestUser {
    userId: string;
    role: string;
    email: string;
    iat: number;
    exp: number;
}


export interface IChangePassWordPayload {
    currentPassword: string;
    newPassword: string;
}