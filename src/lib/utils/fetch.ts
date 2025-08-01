import fetch, { RequestInit, Response } from 'node-fetch';

/**
 * A wrapper around node-fetch to provide a consistent interface
 * and avoid the experimental fetch warning in Node.js 18
 */
export { fetch, RequestInit, Response };
export type { RequestInit as FetchRequestInit, Response as FetchResponse };
