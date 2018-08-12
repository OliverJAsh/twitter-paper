import { JsonDecodeError } from 'decode-ts/target/types';
import * as array from 'fp-ts/lib/Array';
import { pipe } from 'fp-ts/lib/function';
import { formatValidationError } from 'io-ts-reporters';
import * as luxon from 'luxon';
import { ErrorResponse as TwitterApiErrorResponse } from 'twitter-api-ts/target/types';

import { parseTwitterDate } from './helpers/twitter-date';
import { PublicationWarning } from './publication';
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
                ...apiErrorResponse.errors.map(error => `<li>${error.code}: ${error.message}</li>`),
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

// https://developer.twitter.com/en/docs/tweets/timelines/api-reference/get-statuses-home_timeline
const TIMELINE_MAX = 800;
const getWarningMessage = PublicationWarning.match({
    RangeStartPotentiallyUnreachable: () =>
        `No publication tweets were found. We were unable to find any tweets >= the publication end time. Note we can only access up to the last ${TIMELINE_MAX} tweets.`,
    RangeEndPotentiallyUnreachable: () =>
        `This publication is potentially incomplete. We were unable to find any tweets > the publication start time. Note we can only access up to the last ${TIMELINE_MAX} tweets.`,
});

const formatDateWithTimeZone = (timeZone: luxon.IANAZone) => (dateTime: luxon.DateTime): string =>
    dateTime.setZone(timeZone).toFormat('D TTT');
const formatTweetCreatedAt = (timeZone: luxon.IANAZone) =>
    pipe(
        parseTwitterDate,
        formatDateWithTimeZone(timeZone),
    );

export const renderPublication = (publication: PublicationResponse) => (
    timeZone: luxon.IANAZone,
) => (publicationDate: luxon.DateTime): string =>
    [
        ...publication.warning
            .map(getWarningMessage)
            .map(message => [`Warning: ${message}`])
            .getOrElse([]),
        `<p>Publication date: ${formatDateWithTimeZone(timeZone)(publicationDate)}</p>`,
        `<ol>${publication.tweets
            .map(
                tweet =>
                    `<li>${tweet.id_str} ${formatTweetCreatedAt(timeZone)(tweet.created_at)} @${
                        tweet.user.screen_name
                    }: ${tweet.text}</li>`,
            )
            .join('')}</ol>`,
    ].join('');
