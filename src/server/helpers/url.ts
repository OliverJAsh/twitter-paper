import { pipe } from 'fp-ts/lib/function';
import * as urlHelpers from 'url';

type ParsedUrlQuery = { [key: string]: string | string[] };
const addQueryToParsedUrl = (
    parsedUrl: urlHelpers.UrlWithParsedQuery,
    queryToAppend: {},
): urlHelpers.UrlObject => {
    const { protocol, host, hash, pathname } = parsedUrl;
    const existingQuery = parsedUrl.query;
    const newQuery: ParsedUrlQuery = { ...existingQuery, ...queryToAppend };
    // We omit some formatted values (e.g. `search`) as they take precendence over the parsed
    // equivalents (e.g. `query`).
    const newParsedUrl = {
        protocol,
        host,
        hash,
        pathname,
        query: newQuery,
    };
    return newParsedUrl;
};

const parseUrlWithQueryString = (url: string) =>
    urlHelpers.parse(
        url,
        // Parse the query string
        true,
    );

export const addQueryToUrl = (query: {}) =>
    pipe(
        parseUrlWithQueryString,
        parsedUrl => addQueryToParsedUrl(parsedUrl, query),
        urlHelpers.format,
    );
