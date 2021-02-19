import { constants, Http2ServerRequest, Http2ServerResponse } from 'http2'
import * as rawBody from 'raw-body'
import { Readable } from 'stream'
import { createBrotliDecompress, createDeflate, createGunzip } from 'zlib'

export const APPLICATION_JSON = 'application/json'

export function getDecodeStream(stream: Readable, contentEncoding?: string | string[]): Readable {
    switch (contentEncoding) {
        case undefined:
        case 'identity':
            return stream
        case 'deflate':
            return stream.pipe(createDeflate())
        case 'br':
            return stream.pipe(createBrotliDecompress())
        case 'gzip':
            return stream.pipe(createGunzip())
        default:
            throw new Error('Unknown content encoding')
    }
}

export async function parseRequestJsonBody<T = Promise<Record<string, unknown>>>(req: Http2ServerRequest): Promise<T> {
    const contentType = req.headers[constants.HTTP2_HEADER_CONTENT_TYPE]
    if (typeof contentType === 'string') {
        if (contentType.includes(':')) {
            const found = contentType.split(':').find((part) => part === APPLICATION_JSON)
            if (!found) throw new Error('Content type header not set to application/json')
        } else {
            if (contentType !== APPLICATION_JSON) throw new Error('Content type header not set to application/json')
        }
    } else {
        throw new Error('Content type header not set')
    }

    const bodyString = await rawBody(getDecodeStream(req, req.headers[constants.HTTP2_HEADER_CONTENT_ENCODING]), {
        length: req.headers['content-length'],
        limit: 1 * 1024 * 1024,
        encoding: true,
    })

    return JSON.parse(bodyString) as T
}

export async function parseReponseJsonBody<T = Promise<Record<string, unknown>>>(r: Http2ServerResponse): Promise<T> {
    const contentType = r.getHeader(constants.HTTP2_HEADER_CONTENT_TYPE)
    if (typeof contentType === 'string') {
        if (contentType.includes(':')) {
            const found = contentType.split(':').find((part) => part === APPLICATION_JSON)
            if (!found) throw new Error('Content type header not set to application/json')
        } else {
            if (contentType !== APPLICATION_JSON) throw new Error('Content type header not set to application/json')
        }
    } else {
        throw new Error('Content type header not set')
    }

    const bodyString = await rawBody(getDecodeStream(r.stream, r.getHeader(constants.HTTP2_HEADER_CONTENT_ENCODING)), {
        length: r.getHeader('content-length'),
        limit: 1 * 1024 * 1024,
        encoding: true,
    })
    return JSON.parse(bodyString) as T
}
