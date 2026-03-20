import jwt, { SignOptions , JwtPayload} from "jsonwebtoken";

const createToken = (payload: JwtPayload, secret: string, { expiresIn }: SignOptions) => {
    const token = jwt.sign(payload, secret, {
        expiresIn: expiresIn
    })
    return token;
}

const verifyToken = (token: string, secret: string) => {
    try {
        const decoded = jwt.verify(token, secret) as JwtPayload;
        return {
            success: true,
            message: 'Token verified successfully',
            decoded: decoded
        }
    } catch (error : any) {
        return {
            success: false,
            message: error.message,
            error: error
        };
    }
}

const decodeToken = (token: string ) => {
    const decoded = jwt.decode(token) as JwtPayload;
    return decoded;
}


export const jwtUtils = {
    createToken,
    verifyToken,
    decodeToken
}
