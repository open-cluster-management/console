import { Http2ServerResponse, constants, Http2ServerRequest } from 'http2'

const {
    HTTP_STATUS_OK,
    HTTP_STATUS_CREATED,
    // HTTP_STATUS_METHOD_NOT_ALLOWED,
    // HTTP_STATUS_NO_CONTENT,
    // HTTP_STATUS_NOT_MODIFIED,
    HTTP_STATUS_BAD_REQUEST,
    HTTP_STATUS_UNAUTHORIZED,
    HTTP_STATUS_NOT_FOUND,
    HTTP_STATUS_CONFLICT,
    HTTP_STATUS_INTERNAL_SERVER_ERROR,
} = constants

export function respond(res: Http2ServerResponse, data: unknown): void {
    let jsonString: string
    if (typeof data === 'string') {
        jsonString = data
    } else if (data instanceof Buffer) {
        jsonString = data.toString()
    } else {
        jsonString = JSON.stringify(data)
    }

    if (jsonString.length > 1000) {
        // TODO COMPrESSION
    }
    // TODO ETAG
    // CONteNT LENGTH
    res.writeHead(HTTP_STATUS_OK, { 'content-type': 'application/json' }).end(jsonString)
}

export function respondOK(req: Http2ServerRequest, res: Http2ServerResponse): void {
    res.writeHead(HTTP_STATUS_OK).end()
}

export function respondCreated(res: Http2ServerResponse, data: Record<string, unknown>): void {
    if (data) {
        res.writeHead(HTTP_STATUS_CREATED, { 'content-type': 'application/json' }).end(JSON.stringify(data))
    } else {
        res.writeHead(HTTP_STATUS_CREATED).end()
    }
}

export function respondBadRequest(req: Http2ServerRequest, res: Http2ServerResponse): void {
    res.writeHead(HTTP_STATUS_BAD_REQUEST).end()
}

export function respondUnauthorized(req: Http2ServerRequest, res: Http2ServerResponse): void {
    res.writeHead(HTTP_STATUS_UNAUTHORIZED).end()
}

export function respondNotFound(req: Http2ServerRequest, res: Http2ServerResponse): void {
    res.writeHead(HTTP_STATUS_NOT_FOUND).end()
}

export function respondConflict(req: Http2ServerRequest, res: Http2ServerResponse): void {
    res.writeHead(HTTP_STATUS_CONFLICT).end()
}

export function respondInternalServerError(req: Http2ServerRequest, res: Http2ServerResponse): void {
    res.writeHead(HTTP_STATUS_INTERNAL_SERVER_ERROR).end()
}
