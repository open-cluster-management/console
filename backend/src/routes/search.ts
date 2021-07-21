/* Copyright Contributors to the Open Cluster Management project */
import { Http2ServerRequest, Http2ServerResponse } from 'http2'
import { request, RequestOptions } from 'https'
import { pipeline } from 'stream'
import { URL } from 'url'
import { parseCookies } from '../lib/cookies'
import { logger } from '../lib/logger'
import { notFound, unauthorized } from '../lib/respond'

export function search(req: Http2ServerRequest, res: Http2ServerResponse): void {
    const token = parseCookies(req)['openshift-session-token']
    if (!token) return unauthorized(req, res)

    const searchUrl = process.env.SEARCH_API_URL || 'https://search-search-api:4010'
    const url = new URL(searchUrl + '/searchapi/graphql')
    const headers = req.headers
    headers.authorization = `Bearer ${token}`
    headers.host = url.hostname
    const options: RequestOptions = {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: req.method,
        headers,
        rejectUnauthorized: false,
    }

    pipeline(
        req,
        request(options, (response) => {
            if (!response) return notFound(req, res)
            res.writeHead(response.statusCode, response.headers)
            pipeline(response, res as unknown as NodeJS.WritableStream, () => logger.error)
        }),
        () => logger.error
    )
}
