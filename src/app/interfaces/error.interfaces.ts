export interface TypeErrorSource {
    path: string;
    message: string;
}

export interface TypeErrorResponse {
    success: boolean;
    statusCode: number;
    message: string;
    errorSources: TypeErrorSource[];
    error?: any;
    stack?: string;
}

export type TErrorSource = TypeErrorSource;
export type TErrorResponse = TypeErrorResponse;