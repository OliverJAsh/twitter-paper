import { JsonDecodeError } from 'decode-ts/target/types';
import * as array from 'fp-ts/lib/Array';
import { formatValidationError } from 'io-ts-reporters';
import { ErrorResponse as TwitterApiErrorResponse } from 'twitter-api-ts/target/types';

import { PublicationResponse } from './types';
import { ErrorResponse } from './types/error-response';

const renderJsonDecodeError = JsonDecodeError.match({
    ValidationErrors: ({ validationErrors }) => {
        const formattedValidationErrors = array.catOptions(
            validationErrors.map(formatValidationError),
        );
        return [
            'Validation errors:',
            '<ul>',
            ...formattedValidationErrors.map(error => `<li>${error}</li>`),
            '</ul>',
        ].join('');
    },
    ParsingError: ({ errorMessage }) => `Parsing error: ${errorMessage}`,
});

const renderTwitterApiErrorResponse = (
    twitterApiErrorResponse: TwitterApiErrorResponse,
): string => {
    const messageHeader = 'Twitter API';
    const messageBody = TwitterApiErrorResponse.match({
        DecodeError: ({ decodeError }) => renderJsonDecodeError(decodeError),
        APIErrorResponse: ({ apiErrorResponse }) =>
            [
                'API errors:',
                '<ul>',
                ...apiErrorResponse.errors.map(
                    // https://github.com/gcanti/io-ts/tree/1786946db7eea09b951a3efc46cdf668fe3299c0#known-issues
                    // https://github.com/Microsoft/TypeScript/issues/14041
                    // tslint:disable-next-line no-unsafe-any
                    error => `<li>${error.code}: ${error.message}</li>`,
                ),
                '</ul>',
            ].join(''),
        JavaScriptError: ({ error }) => `JavaScript error: ${error.stack}`,
    })(twitterApiErrorResponse);

    return `${messageHeader}: ${messageBody}`;
};

const renderRequestValidationErrors = (
    errorResponse: typeof ErrorResponse._Record.RequestValidation,
): string => {
    const formattedValidationErrors = array.catOptions(
        errorResponse.validationErrors.map(formatValidationError),
    );
    return [
        `Request validation errors for ${errorResponse.context}:`,
        '<ul>',
        ...formattedValidationErrors.map(error => `<li>${error}</li>`),
        '</ul>',
    ].join('');
};

export const renderErrorResponse = ErrorResponse.match({
    Simple: ({ message }) => message,
    JsonDecode: ({ decodeError, context }) =>
        `JSON decode errors for ${context}: ${renderJsonDecodeError(decodeError)}`,
    RequestValidation: renderRequestValidationErrors,
    TwitterApi: ({ errorResponse }) => renderTwitterApiErrorResponse(errorResponse),
    Unauthenticated: () => 'Not authenticated',
});

export const renderPublication = (publication: PublicationResponse): string =>
    [
        ...publication.warning.map(message => [`Warning: ${message}`]).getOrElse([]),
        `<ol>${publication.tweets
            .map(
                tweet =>
                    // https://github.com/gcanti/io-ts/tree/1786946db7eea09b951a3efc46cdf668fe3299c0#known-issues
                    // https://github.com/Microsoft/TypeScript/issues/14041
                    // tslint:disable-next-line no-unsafe-any
                    `<li>${tweet.id_str} ${tweet.created_at} @${tweet.user.screen_name}: ${
                        tweet.text
                    }</li>`,
            )
            .join('')}</ol>`,
    ].join('');
