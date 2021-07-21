/* Copyright Contributors to the Open Cluster Management project */
import { constants, Http2ServerRequest, Http2ServerResponse } from 'http2'
import { Agent } from 'https'
import { parseCookies } from '../lib/cookies'
import { fetchRetry } from '../lib/fetch-retry'
import { logger } from '../lib/logger'
import { respondInternalServerError, unauthorized } from '../lib/respond'

const { HTTP2_HEADER_AUTHORIZATION } = constants
const agent = new Agent({ rejectUnauthorized: false })

export async function authenticated(req: Http2ServerRequest, res: Http2ServerResponse): Promise<void> {
    const token = parseCookies(req)['openshift-session-token']
    if (!token) return unauthorized(req, res)
    try {
        const response = await fetchRetry(process.env.CLUSTER_API_URL + '/apis', {
            headers: { [HTTP2_HEADER_AUTHORIZATION]: `Bearer ${token}` },
            agent,
        })
        res.writeHead(response.status).end()
        void response.blob()
    } catch (err) {
        logger.error(err)
        respondInternalServerError(req, res)
    }
}
