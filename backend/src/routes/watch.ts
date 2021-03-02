import { readFileSync } from 'fs'
import { IncomingMessage } from 'http'
import { constants, Http2ServerRequest, Http2ServerResponse } from 'http2'
import { Agent, request } from 'https'
import { parseJsonBody } from '../lib/body-parser'
import { parseCookies } from '../lib/cookies'
import { jsonPost } from '../lib/json-request'
import { logger } from '../lib/logger'
import { unauthorized } from '../lib/respond'
import { ServerSideEvents } from '../lib/server-side-events'

const {
    HTTP2_HEADER_CONTENT_TYPE,
    HTTP2_HEADER_AUTHORIZATION,
    HTTP2_HEADER_ACCEPT,
    HTTP2_HEADER_ACCEPT_ENCODING,
} = constants

interface WatchEvent {
    type: 'ADDED' | 'DELETED' | 'MODIFIED'
    object: {
        kind: string
        apiVersion: string
        metadata: {
            name: string
            namespace: string
            resourceVersion?: string
            // creationTimestamp: string
            // labels: Record<string, string>
            // annotations: Record<string, string>
            // ownerReferences: unknown
            managedFields?: unknown
            selfLink?: string
        }
    }
}

function readToken() {
    try {
        return readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token').toString()
    } catch (err) {
        logger.error(err)
    }
}

let serviceAccountToken = readToken()

export function watch(req: Http2ServerRequest, res: Http2ServerResponse): void {
    const token = parseCookies(req)['acm-access-token-cookie']
    if (!token) return unauthorized(req, res)
    ServerSideEvents.handleRequest(token, req, res)
    startWatching(serviceAccountToken ?? token)
}

const accessCache: Record<string, Record<string, { time: number; promise: Promise<boolean> }>> = {}

function canAccess(
    resource: { apiVersion: string; kind: string; metadata?: { name?: string; namespace?: string } },
    verb: 'get' | 'list',
    token?: string
): Promise<boolean> {
    const key = `${resource.kind}:${resource.metadata?.namespace}:${resource.metadata?.name}`
    if (!accessCache[token]) accessCache[token] = {}
    const existing = accessCache[token][key]
    if (existing && existing.time > Date.now() - 60 * 1000) {
        return existing.promise
    }

    const { apiVersion, kind, metadata } = resource
    const name = metadata?.name
    const namespace = metadata?.name

    const promise = jsonPost(
        '/apis/authorization.k8s.io/v1/selfsubjectaccessreviews',
        {
            apiVersion: 'authorization.k8s.io/v1',
            kind: 'SelfSubjectAccessReview',
            metadata: {},
            spec: {
                resourceAttributes: {
                    group: resource.apiVersion.includes('/') ? resource.apiVersion.split('/')[0] : undefined,
                    name: resource.metadata?.name,
                    namespace: resource.metadata?.namespace,
                    resource: resource.kind.toLowerCase() + 's',
                    verb,
                },
            },
        },
        token
    ).then((data: { status: { allowed: boolean } }) => {
        if (data.status.allowed) {
            logger.debug({
                msg: 'access',
                type: 'ALLOWED',
                verb,
                resource: resource.kind.toLowerCase() + 's',
                name: resource.metadata?.name,
                namespace: resource.metadata?.namespace,
            })
            return true
        } else return false
    })
    accessCache[token][key] = {
        time: Date.now(),
        promise,
    }
    return promise
}

let watching = false
export function startWatching(token: string): void {
    if (watching) return
    watching = true

    ServerSideEvents.eventFilter = (token, event) => {
        const watchEvent = event.data as WatchEvent
        if (watchEvent.type === 'DELETED') return Promise.resolve(event)
        return canAccess(
            { kind: watchEvent.object.kind, apiVersion: watchEvent.object.apiVersion },
            'list',
            token
        ).then((allowed) => {
            if (allowed) return event
            return canAccess(
                {
                    kind: watchEvent.object.kind,
                    apiVersion: watchEvent.object.apiVersion,
                    metadata: { namespace: watchEvent.object.metadata.namespace },
                },
                'list',
                token
            ).then((allowed) => {
                if (allowed) return event
                return canAccess(watchEvent.object, 'get', token).then((allowed) => {
                    if (allowed) return event
                })
            })
        })
    }

    watchResource(token, 'v1', 'namespaces')
    watchResource(token, 'cluster.open-cluster-management.io/v1', 'managedClusters')
    watchResource(token, 'internal.open-cluster-management.io/v1beta1', 'managedClusterInfos')
    watchResource(token, 'inventory.open-cluster-management.io/v1alpha1', 'bareMetalAssets')
    watchResource(token, 'certificates.k8s.io/v1beta1', 'certificateSigningRequests')
    watchResource(token, 'hive.openshift.io/v1', 'clusterDeployments')
    watchResource(token, 'hive.openshift.io/v1', 'clusterImageSets')
    watchResource(token, 'addon.open-cluster-management.io/v1alpha1', 'clusterManagementAddons')
    watchResource(token, 'addon.open-cluster-management.io/v1alpha1', 'managedClusterAddons')
    watchResource(token, 'v1', 'secrets', { 'cluster.open-cluster-management.io/cloudconnection': '' })
}

const resources: Record<string, Record<string, number>> = {}

export function watchResource(
    token: string,
    apiVersion: string,
    kind: string,
    labelSelector?: Record<string, string>
): void {
    let path = apiVersion.includes('/') ? '/apis' : '/api'
    path += `/${apiVersion}/${kind.toLowerCase()}`
    path += `?watch`
    if (labelSelector) {
        path += Object.keys(labelSelector).map((key) =>
            labelSelector[key] ? `&labelSelector=${key}=${labelSelector[key]}` : `&labelSelector=${key}=`
        )
    }

    const resourceEvents: Record<string, number> = {}
    resources[kind] = resourceEvents

    const url = `${process.env.CLUSTER_API_URL}${path}`

    let data = ''
    const client = request(
        url,
        { headers: { authorization: `Bearer ${token}` }, agent: new Agent({ rejectUnauthorized: false }) },
        (res) => {
            res.on('data', (chunk) => {
                if (chunk instanceof Buffer) {
                    data += chunk.toString()
                    while (data.includes('\n')) {
                        const parts = data.split('\n')
                        data = parts.slice(1).join('\n')
                        try {
                            const eventData = JSON.parse(parts[0]) as WatchEvent
                            if (eventData.object) {
                                delete eventData.object.metadata.managedFields
                                delete eventData.object.metadata.selfLink
                                if (eventData.type === 'DELETED') {
                                    eventData.object = {
                                        kind: eventData.object.kind,
                                        apiVersion: eventData.object.apiVersion,
                                        metadata: {
                                            name: eventData.object.metadata.name,
                                            namespace: eventData.object.metadata.namespace,
                                        },
                                    }
                                }
                                logger.debug({
                                    msg: 'watch',
                                    type: eventData.type,
                                    kind: eventData.object.kind,
                                    name: eventData.object.metadata.name,
                                    namespace: eventData.object.metadata.namespace,
                                })
                                const eventID = ServerSideEvents.pushEvent({ data: eventData })
                                const resourceKey = `${eventData.object.metadata.name}:${eventData.object.metadata.namespace}`
                                if (resourceEvents[resourceKey]) {
                                    ServerSideEvents.removeEvent(resourceEvents[resourceKey])
                                }
                                if (eventData.type !== 'DELETED') {
                                    resourceEvents[resourceKey] = eventID
                                }
                            } else {
                                console.log(eventData)
                            }
                        } catch (err) {
                            logger.error(err)
                        }
                    }
                }
            }).on('error', logger.error)
        }
    )
    client.on('error', logger.error)
    client.end()
}
