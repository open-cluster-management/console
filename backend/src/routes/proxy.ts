/* Copyright Contributors to the Open Cluster Management project */
import { constants, Http2ServerRequest, Http2ServerResponse, OutgoingHttpHeaders } from 'http2'
import { request, RequestOptions } from 'https'
import { pipeline } from 'stream'
import { URL } from 'url'
import { parseCookies } from '../lib/cookies'
import { logger } from '../lib/logger'
import { notFound, unauthorized } from '../lib/respond'

const proxyHeaders = [
    constants.HTTP2_HEADER_ACCEPT,
    constants.HTTP2_HEADER_ACCEPT_ENCODING,
    constants.HTTP2_HEADER_CONTENT_ENCODING,
    constants.HTTP2_HEADER_CONTENT_LENGTH,
    constants.HTTP2_HEADER_CONTENT_TYPE,
]
const proxyResponseHeaders = [
    constants.HTTP2_HEADER_CACHE_CONTROL,
    constants.HTTP2_HEADER_CONTENT_TYPE,
    constants.HTTP2_HEADER_CONTENT_LENGTH,
    constants.HTTP2_HEADER_CONTENT_ENCODING,
    constants.HTTP2_HEADER_ETAG,
]

export function proxy(req: Http2ServerRequest, res: Http2ServerResponse): void {
    const token = parseCookies(req)['openshift-session-token']
    if (!token) return unauthorized(req, res)

    const url = req.url

    const headers: OutgoingHttpHeaders = { authorization: `Bearer ${token}` }
    for (const header of proxyHeaders) {
        if (req.headers[header]) headers[header] = req.headers[header]
    }

    const clusterUrl = new URL(process.env.CLUSTER_API_URL)
    const options: RequestOptions = {
        protocol: clusterUrl.protocol,
        hostname: clusterUrl.hostname,
        port: clusterUrl.port,
        path: url,
        method: req.method,
        headers,
        rejectUnauthorized: false,
    }
    pipeline(
        req,
        request(options, (response) => {
            if (!response) return notFound(req, res)
            const responseHeaders: OutgoingHttpHeaders = {}
            for (const header of proxyResponseHeaders) {
                if (response.headers[header]) responseHeaders[header] = response.headers[header]
            }
            res.writeHead(response.statusCode ?? 500, responseHeaders)
            pipeline(response, (res as unknown) as NodeJS.WritableStream, () => logger.error)
        }),
        (err) => {
            if (err) logger.error(err)
        }
    )
}
