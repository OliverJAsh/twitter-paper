import * as either from 'fp-ts/lib/Either';
import * as option from 'fp-ts/lib/Option';
import * as taskEither from 'fp-ts/lib/TaskEither';
import * as t from 'io-ts';
import * as TwitterApiTypes from 'twitter-api-ts/target/types';

import { PublicationWarning } from './publication';
import { ErrorResponse } from './types/error-response';

import Option = option.Option;
import Either = either.Either;
import TaskEither = taskEither.TaskEither;

//
// Responses
//

export type PublicationResponse = {
    tweets: TwitterApiTypes.TweetT[];
    warning: Option<PublicationWarning>;
};

//
// Full responses (either success or error)
//

export type OrErrorResponse<T> = Either<ErrorResponse, T>;
export type OrErrorResponseAsync<T> = TaskEitherFromEither<OrErrorResponse<T>>;

export type FullPublicationResponse = OrErrorResponse<PublicationResponse>;

//
// Other
//

export type TaskEitherFromEither<T extends Either<{}, {}>> = TaskEither<T['_L'], T['_A']>;

export const UserTwitterCredentials = t.interface({
    oauthAccessToken: t.string,
    oauthAccessTokenSecret: t.string,
});
export type UserTwitterCredentialsT = t.TypeOf<typeof UserTwitterCredentials>;
