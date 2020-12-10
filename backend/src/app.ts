// TODO Rquest Queue
// TODO ETag Support
// TODO Compression Support

/* istanbul ignore file */
import { IncomingHttpHeaders, IncomingMessage, request as httpRequest, RequestOptions, ServerResponse } from 'http'
import { Agent, get } from 'https'
import { parse as parseUrl } from 'url'
import { parse as parseQueryString, encode as stringifyQuery } from 'querystring'
import { createReadStream } from 'fs'
import { extname } from 'path'
import { info, Log, Logs } from './logger'

const agent = new Agent({ rejectUnauthorized: false })

export async function requestHandler(req: IncomingMessage, res: ServerResponse): Promise<unknown> {
    try {
        let url = req.url

        const logs: Logs = []
        ;((req as unknown) as { logs: Logs }).logs = logs

        // CORS Headers
        if (process.env.NODE_ENV !== 'production') {
            if (req.headers['origin']) {
                res.setHeader('Access-Control-Allow-Origin', req.headers['origin'])
                res.setHeader('Vary', 'Origin')
            }
            res.setHeader('Access-Control-Allow-Credentials', 'true')
            switch (req.method) {
                case 'OPTIONS':
                    res.setHeader('Vary', 'Origin, Access-Control-Allow-Origin')
                    res.setHeader('Access-Control-Allow-Origin', req.headers['origin'])
                    res.setHeader('Access-Control-Allow-Methods', req.headers['access-control-request-method'])
                    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'])
                    return res.writeHead(200).end()
            }
        }

        if (url.startsWith('/cluster-management')) {
            url = url.substr('/cluster-management'.length)
        }

        if (url.startsWith('/namespaced')) {
            url = url.substr('/namespaced'.length)
        }

        if (url.startsWith('/proxy')) {
            url = url.substr('/proxy'.length)
        }

        // Kubernetes Proxy
        if (url.startsWith('/api')) {
            const token = getToken(req)
            if (!token) return res.writeHead(401).end()

            let data: string
            switch (req.method) {
                case 'PUT':
                case 'POST':
                case 'PATCH':
                    data = await parseBody(req)
                    break
                default:
                    break
            }

            const headers = req.headers
            headers.authorization = `Bearer ${token}`
            const response = await request(req.method, process.env.CLUSTER_API_URL + url, headers, data, logs)
            res.writeHead(response.statusCode, response.headers)
            return response.pipe(res)

            // const options: RequestOptions = parseUrl(process.env.CLUSTER_API_URL + url)
            // options.method = req.method
            // options.headers = req.headers
            // options.headers.authorization = `Bearer ${token}`
            // options.agent = agent

            // return req.pipe(
            //     httpRequest(options, (response) => {
            //         // if (req.method === 'GET' && response.statusCode === 403 && !url.includes('/namespaces/')) {
            //         //     request(
            //         //         'GET',
            //         //         `${process.env.CLUSTER_API_URL}/apis/project.openshift.io/v1/projects`,
            //         //         { authorization: `Bearer ${token}`, accept: 'application/json' },
            //         //         logs
            //         //     )
            //         //         .then(async (response) => {
            //         //             const data = await parseJsonBody<{ items: { metadata: { name: string } }[] }>(response)
            //         //             const projects = data.items as { metadata: { name: string } }[]
            //         //             let items: unknown[] = []
            //         //             await Promise.all(
            //         //                 projects.map((project) => {
            //         //                     let namespacedUrl = url
            //         //                     const parts = namespacedUrl.split('/')
            //         //                     namespacedUrl = parts.slice(0, parts.length - 1).join('/')
            //         //                     namespacedUrl += `/namespaces/${project.metadata.name}/`
            //         //                     namespacedUrl += parts[parts.length - 1]
            //         //                     const projectOptions: RequestOptions = {
            //         //                         ...parseUrl(process.env.CLUSTER_API_URL + namespacedUrl),
            //         //                         ...{
            //         //                             method: 'GET',
            //         //                             headers: {
            //         //                                 authorization: `Bearer ${token}`,
            //         //                                 accept: 'application/json',
            //         //                             },
            //         //                             agent,
            //         //                         },
            //         //                     }
            //         //                     return request(projectOptions)
            //         //                         .then((data) => {
            //         //                             const dataItems = data.items as unknown[]
            //         //                             if (dataItems) {
            //         //                                 items = [...items, ...dataItems]
            //         //                             }
            //         //                         })
            //         //                         .catch((err) => console.error)
            //         //                 })
            //         //             )
            //         //                 .then(() => {
            //         //                     res.writeHead(200, { 'content-type': 'application/json' }).end(
            //         //                         JSON.stringify({
            //         //                             items,
            //         //                         })
            //         //                     )
            //         //                 })
            //         //                 .catch(() => {
            //         //                     res.writeHead(200, { 'content-type': 'application/json' }).end('[]')
            //         //                 })
            //         //         })
            //         //         .catch(() => res.writeHead(200).end('[]'))
            //         // } else {
            //         res.writeHead(response.statusCode, response.headers)
            //         response.pipe(res, { end: true })
            //         // }
            //     }),
            //     { end: true }
            // )
        }

        // OAuth Login
        if (url === '/login') {
            const oauthInfo = await oauthInfoPromise
            const queryString = stringifyQuery({
                response_type: `code`,
                client_id: process.env.OAUTH2_CLIENT_ID,
                redirect_uri: `http://localhost:4000/cluster-management/login/callback`,
                scope: `user:full`,
                state: '',
            })
            return res.writeHead(302, { location: `${oauthInfo.authorization_endpoint}?${queryString}` }).end()
        }

        if (url.startsWith('/login/callback') || url.startsWith('/cluster-management/login/callback')) {
            const oauthInfo = await oauthInfoPromise
            if (url.includes('?')) {
                const queryString = url.substr(url.indexOf('?') + 1)
                const query = parseQueryString(queryString)
                const code = query.code as string
                const state = query.state

                const requestQuery: Record<string, string> = {
                    grant_type: `authorization_code`,
                    code: code,
                    redirect_uri: `http://localhost:4000/cluster-management/login/callback`,
                    client_id: process.env.OAUTH2_CLIENT_ID,
                    client_secret: process.env.OAUTH2_CLIENT_SECRET,
                }
                const requestQueryString = stringifyQuery(requestQuery)
                return get(
                    oauthInfo.token_endpoint + '?' + requestQueryString,
                    { agent, headers: { Accept: 'application/json' } },
                    (response) => {
                        parseJsonBody<{ access_token: string }>(response)
                            .then((body) => {
                                const headers = {
                                    'Set-Cookie': `acm-access-token-cookie=${body.access_token}; ${
                                        process.env.NODE_ENV === 'production' ? 'Secure; ' : ''
                                    } HttpOnly; Path=/`,
                                    location: `http://localhost:3000`,
                                }
                                return res.writeHead(302, headers).end()
                            })
                            .catch((err) => {
                                console.error(err)
                                return res.writeHead(500).end()
                            })
                    }
                ).on('error', (err) => {
                    return res.writeHead(500).end()
                })
            } else {
                return res.writeHead(500).end()
            }

            // const query =
            // TODO get code...
        }

        // Console Header
        if (process.env.NODE_ENV === 'development') {
            const token = getToken(req)
            if (!token) return res.writeHead(401).end()

            const acmUrl = process.env.CLUSTER_API_URL.replace('api', 'multicloud-console.apps').replace(':6443', '')

            let headerUrl: string
            if (url.startsWith('/multicloud/header/')) {
                headerUrl = `${acmUrl}${url}`
            } else if (url == '/header') {
                const isDevelopment = process.env.NODE_ENV === 'development' ? 'true' : 'false'
                headerUrl = `${acmUrl}/multicloud/header/api/v1/header?serviceId=mcm-ui&dev=${isDevelopment}`
            }

            const headers = req.headers
            headers.authorization = `Bearer ${token}`
            headers.host = parseUrl(process.env.CLUSTER_API_URL).host
            const response = await request(req.method, headerUrl, headers, undefined, logs)
            return response.pipe(res.writeHead(response.statusCode, response.headers))
        }

        if (url === '/livenessProbe') return res.writeHead(200).end()
        if (url === '/readinessProbe') return res.writeHead(200).end()

        // Send frontend files
        try {
            let ext = extname(url)
            if (ext === '') {
                ext = '.html'
                url = '/index.html'
            }
            const readStream = createReadStream('./public' + url, { autoClose: true })
            if (readStream) {
                readStream
                    .on('open', () => {
                        const contentType = contentTypes[ext]
                        res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': cacheControl })
                    })
                    .on('error', (err) => {
                        // if (ext === '.json') {
                        //     return res.writeHead(200, { 'Cache-Control': 'public, max-age=604800' }).end()
                        // } else {
                        return res.writeHead(404).end()
                        // }
                    })
                    .pipe(res, { end: true })
            }
            return
        } catch (err) {
            return res.writeHead(404).end()
        }
    } catch (err) {
        console.error(err)
        if (!res.headersSent) res.writeHead(500)
        return res.end()
    }
}

const cacheControl = process.env.NODE_ENV === 'production' ? 'public, max-age=604800' : 'no-store'

type OAuthInfo = { authorization_endpoint: string; token_endpoint: string }
const oauthInfoPromise = jsonRequest<OAuthInfo>(
    'GET',
    `${process.env.CLUSTER_API_URL}/.well-known/oauth-authorization-server`,
    { accept: 'application/json' },
    undefined,
    []
)

function getToken(req: IncomingMessage) {
    let cookies: Record<string, string>
    if (req.headers.cookie) {
        cookies = req.headers.cookie.split('; ').reduce((cookies, value) => {
            const parts = value.split('=')
            if (parts.length === 2) cookies[parts[0]] = parts[1]
            return cookies
        }, {} as Record<string, string>)
    }
    return cookies?.['acm-access-token-cookie']
}

async function request(
    method: string,
    url: string,
    headers: IncomingHttpHeaders,
    data: unknown,
    logs: Logs
): Promise<IncomingMessage> {
    const response = await requestRetry(method, url, headers, data, logs)
    // if (response.statusCode === 403 && method === 'GET' && isClusterScope(url)) {
    //     // TODO HANDLE PROJECTS
    //     const projects = await jsonRequest<{ items: { metadata: { name: string } }[] }>(
    //         'GET',
    //         `${process.env.CLUSTER_API_URL}/apis/project.openshift.io/v1/projects`,
    //         { authorization: headers.authorization, accept: 'application/json' },
    //         undefined,
    //         logs
    //     )
    //     const items: unknown[] = []
    //     await Promise.all(
    //         projects.items.map((project) => {
    //             const namespacedUrl = addNamespace(url, project.metadata.name)
    //             return request(method, namespacedUrl, headers, data, logs)
    //         })
    //     )
    //     items
    // }
    return response
}

function requestRetry(
    method: string,
    url: string,
    headers: IncomingHttpHeaders,
    data: unknown,
    logs: Logs
): Promise<IncomingMessage> {
    const start = process.hrtime()
    const options: RequestOptions = { ...parseUrl(url), ...{ method, headers, agent } }
    return new Promise((resolve, reject) => {
        function attempt() {
            const log = optionsLog(options)
            logs?.push(log)
            httpRequest(options, (response) => {
                const diff = process.hrtime(start)
                const time = Math.round((diff[0] * 1e9 + diff[1]) / 1000000)
                log.unshift(`${time}ms`.padStart(6))
                log.unshift(response.statusCode)
                switch (response.statusCode) {
                    case 429:
                        setTimeout(attempt, 100)
                        break
                    default:
                        resolve(response)
                        break
                }
            })
                .on('error', (err) => {
                    reject(err)
                })
                .end()
        }
        attempt()
    })
}

async function jsonRequest<T>(
    method: string,
    url: string,
    headers: IncomingHttpHeaders,
    data: unknown,
    logs: Logs
): Promise<T> {
    return parseJsonBody<T>(await requestRetry(method, url, headers, data, logs))
}

function parseBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        let data = ''
        req.on('error', reject)
        req.on('data', (chunk) => (data += chunk))
        req.on('end', () => {
            resolve(data)
        })
    })
}

async function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
    const body = await parseBody(req)
    return JSON.parse(body) as T
}

function isClusterScope(url: string): boolean {
    if (url.startsWith('/api/')) {
        return url.split('/').length === 4
    } else if (url.startsWith('/apis/')) {
        return url.split('/').length === 5
    }
    return false
}

function isNamespaceScope(url: string): boolean {
    if (url.startsWith('/api/')) {
        return url.split('/').length === 6
    } else if (url.startsWith('/apis/')) {
        return url.split('/').length === 7
    }
    return false
}

function isNameScope(url: string): boolean {
    if (url.startsWith('/api/')) {
        return url.split('/').length === 7
    } else if (url.startsWith('/apis/')) {
        return url.split('/').length === 8
    }
    return false
}

function addNamespace(url: string, namespace: string): string {
    const parts = url.split('/')
    let namespacedUrl = parts.slice(0, parts.length - 1).join('/')
    namespacedUrl += `/namespaces/${namespace}/`
    namespacedUrl += parts[parts.length - 1]
    return namespacedUrl
}

function optionsLog(options: RequestOptions): Log {
    return [options.method.padStart(5), options.path]
}

const contentTypes: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.map': 'application/json; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
}
