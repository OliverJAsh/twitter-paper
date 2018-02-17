import * as DecodeTypes from 'decode-ts/target/types';
import { ValidationError } from 'io-ts';
import * as TwitterApiTypes from 'twitter-api-ts/target/types';
import { ofType, unionize } from 'unionize';

export const ErrorResponse = unionize({
    Simple: ofType<{ statusCode: number; message: string }>(),
    JsonDecode: ofType<{
        statusCode: number;
        decodeError: DecodeTypes.JsonDecodeError;
        context: string;
    }>(),
    RequestValidation: ofType<{
        validationErrors: ValidationError[];
        context: string;
    }>(),
    TwitterApi: ofType<{
        errorResponse: TwitterApiTypes.ErrorResponse;
    }>(),
    Unauthenticated: ofType<{}>(),
});
export type ErrorResponse = typeof ErrorResponse._Union;
