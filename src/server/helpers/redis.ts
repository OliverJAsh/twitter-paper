import * as Decode from 'decode-ts';
import * as DecodeTypes from 'decode-ts/target/types';
import * as either from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/function';
import * as task from 'fp-ts/lib/Task';

import { redisClient } from '../redis-client';
import { UserTwitterCredentials, UserTwitterCredentialsT } from '../types';

import Task = task.Task;
import Either = either.Either;

const promiseRedisClient = {
    // We can't use the denodeify helper here, because we lose the binding to
    // the redis object (and .bind loses the type!).
    get: (key: string): Promise<string> =>
        new Promise((resolve, reject) => {
            redisClient.get(key, (error, result) => {
                if (error !== undefined && error !== null) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        }),
    mget: (keys: string[]): Promise<string[]> =>
        new Promise((resolve, reject) => {
            redisClient.mget(keys, (error, result) => {
                if (error !== undefined && error !== null) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        }),
    set: (key: string, value: string): Promise<void> =>
        new Promise((resolve, reject) => {
            redisClient.set(key, value, error => {
                if (error !== undefined && error !== null) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        }),
    keys: (pattern: string): Promise<string[]> =>
        new Promise((resolve, reject) => {
            redisClient.keys(pattern, (error, result) => {
                if (error !== undefined && error !== null) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        }),
};

const taskRedisClient = {
    set: (key: string, value: string): Task<void> =>
        new Task(() => promiseRedisClient.set(key, value)),
    get: (key: string): Task<string> => new Task(() => promiseRedisClient.get(key)),
    keys: (pattern: string): Task<string[]> => new Task(() => promiseRedisClient.keys(pattern)),
    mget: (keys: string[]): Task<string[]> => new Task(() => promiseRedisClient.mget(keys)),
};

const getFullKey = (table: string, key: string): string => `${table}:${key}`;

enum RedisTables {
    TwitterCredentials = 'twitter-credentials',
}

export const setUserTwitterCredentials = (userId: string) =>
    pipe(
        (credentials: UserTwitterCredentialsT) => JSON.stringify(credentials),
        str => taskRedisClient.set(getFullKey(RedisTables.TwitterCredentials, userId), str),
    );

export const getUserTwitterCredentialsFromId = (
    twitterUserId: string,
): Task<Either<DecodeTypes.JsonDecodeError, UserTwitterCredentialsT>> =>
    taskRedisClient
        .get(getFullKey(RedisTables.TwitterCredentials, twitterUserId))
        .map(Decode.jsonDecodeString(UserTwitterCredentials));
