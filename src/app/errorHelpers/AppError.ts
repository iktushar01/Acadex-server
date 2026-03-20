class AppError extends Error {
    public statusCode: number;
    constructor(
        statusCode: number,
        message: string,
        stack: string = ""
    ) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.stack = stack;
    }
}

export default AppError;