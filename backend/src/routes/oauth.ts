/* Copyright Contributors to the Open Cluster Management project */
import { createHash } from 'crypto'
import { IncomingMessage } from 'http'
import { Http2ServerRequest, Http2ServerResponse } from 'http2'
import { Agent, request } from 'https'
import { encode as stringifyQuery, parse as parseQueryString } from 'querystring'
import { deleteCookie, parseCookies } from '../lib/cookies'
import { jsonRequest } from '../lib/json-request'
import { logger } from '../lib/logger'
import { redirect, respondInternalServerError, unauthorized } from '../lib/respond'
import { setDead } from './liveness'

type OAuthInfo = { authorization_endpoint: string; token_endpoint: string }
export const oauthInfoPromise = jsonRequest<OAuthInfo>(
    `${process.env.CLUSTER_API_URL}/.well-known/oauth-authorization-server`
).catch((err: Error) => {
    logger.error({ msg: 'oauth-authorization-server error', error: err.message })
    setDead()
    return {
        authorization_endpoint: '',
        token_endpoint: '',
    }
})

export async function login(_req: Http2ServerRequest, res: Http2ServerResponse): Promise<void> {
    const oauthInfo = await oauthInfoPromise
    const queryString = stringifyQuery({
        response_type: `code`,
        client_id: process.env.OAUTH2_CLIENT_ID,
        redirect_uri: `${process.env.BACKEND_URL}/login/callback`,
        scope: `user:full`,
        state: '',
    })
    return redirect(res, `${oauthInfo.authorization_endpoint}?${queryString}`)
}

export async function loginCallback(req: Http2ServerRequest, res: Http2ServerResponse): Promise<void> {
    const url = req.url
    if (url.includes('?')) {
        const oauthInfo = await oauthInfoPromise
        const queryString = url.substr(url.indexOf('?') + 1)
        const query = parseQueryString(queryString)
        const code = query.code as string
        // const state = query.state
        const requestQuery: Record<string, string> = {
            grant_type: `authorization_code`,
            code: code,
            redirect_uri: `${process.env.BACKEND_URL}/login/callback`,
            client_id: process.env.OAUTH2_CLIENT_ID,
            client_secret: process.env.OAUTH2_CLIENT_SECRET,
        }
        const requestQueryString = stringifyQuery(requestQuery)
        const body = await jsonRequest<{ access_token: string }>(oauthInfo.token_endpoint + '?' + requestQueryString)
        if (body.access_token) {
            const headers = {
                'Set-Cookie': `openshift-session-token=${body.access_token}; ${
                    process.env.NODE_ENV === 'production' ? 'Secure; ' : ''
                } HttpOnly; Path=/`,
                location: process.env.FRONTEND_URL,
            }
            return res.writeHead(302, headers).end()
        } else {
            return respondInternalServerError(req, res)
        }
    } else {
        return respondInternalServerError(req, res)
    }
}

export function logout(req: Http2ServerRequest, res: Http2ServerResponse): void {
    const token = parseCookies(req)['openshift-session-token']
    if (!token) return unauthorized(req, res)

    let tokenName = token
    const sha256Prefix = 'sha256~'
    if (tokenName.startsWith(sha256Prefix)) {
        tokenName = `sha256~${createHash('sha256')
            .update(token.substring(sha256Prefix.length))
            .digest('base64')
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')}`
    }

    const clientRequest = request(
        process.env.CLUSTER_API_URL + `/apis/oauth.openshift.io/v1/oauthaccesstokens/${tokenName}?gracePeriodSeconds=0`,
        {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
            agent: new Agent({ rejectUnauthorized: false }),
        },
        (response: IncomingMessage) => {
            deleteCookie(res, 'openshift-session-token')
            res.writeHead(response.statusCode).end()
        }
    )
    clientRequest.on('error', (err) => {
        respondInternalServerError(req, res)
    })
    clientRequest.end()
}
