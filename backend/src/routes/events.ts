/* Copyright Contributors to the Open Cluster Management project */

import AbortController from 'abort-controller'
import { IncomingMessage } from 'http'
import { Http2ServerRequest, Http2ServerResponse } from 'http2'
import { parseCookies } from '../lib/cookies'
import { requestRetry } from '../lib/request-retry'
import { jsonPost } from '../lib/json-request'
import { logger } from '../lib/logger'
import { noop } from '../lib/noop'
import { unauthorized } from '../lib/respond'
import { ServerSideEvent, ServerSideEvents } from '../lib/server-side-events'
import { IResource } from '../resources/resource'
import { serviceAcccountToken, setDead } from './liveness'

export function events(req: Http2ServerRequest, res: Http2ServerResponse): void {
    const token = parseCookies(req)['openshift-session-token']
    if (!token) return unauthorized(req, res)
    ServerSideEvents.handleRequest(token, req, res)
}

interface WatchEvent {
    type: 'ADDED' | 'DELETED' | 'MODIFIED' | 'BOOKMARK' | 'ERROR'
    object: IResource
}

export interface SettingsEvent {
    type: 'SETTINGS'
    settings: Record<string, string>
}

type ServerSideEventData = WatchEvent | SettingsEvent | { type: 'START' | 'LOADED' }

const abortControllers: Record<string, AbortController> = {}

const resourceCache: {
    [kind: string]: {
        [namespace: string]: {
            [name: string]: {
                resource: IResource
                eventID: number
            }
        }
    }
} = {}

export function startWatching(): void {
    const token = serviceAcccountToken

    ServerSideEvents.eventFilter = eventFilter

    watchResource(token, 'v1', 'namespaces')
    watchResource(token, 'cluster.open-cluster-management.io/v1beta1', 'clusterCurators')
    watchResource(token, 'cluster.open-cluster-management.io/v1alpha1', 'managedClusterSets')
    watchResource(token, 'cluster.open-cluster-management.io/v1alpha1', 'managedClusterSetBindings')
    watchResource(token, 'cluster.open-cluster-management.io/v1', 'managedClusters')
    watchResource(token, 'internal.open-cluster-management.io/v1beta1', 'managedClusterInfos')
    watchResource(token, 'inventory.open-cluster-management.io/v1alpha1', 'bareMetalAssets')
    watchResource(token, 'operator.open-cluster-management.io/v1', 'multiClusterHubs')
    watchResource(token, 'certificates.k8s.io/v1beta1', 'certificateSigningRequests', {
        labelSelector: { 'open-cluster-management.io/cluster-name': '' },
    })
    watchResource(token, 'hive.openshift.io/v1', 'clusterClaims')
    watchResource(token, 'hive.openshift.io/v1', 'clusterDeployments')
    watchResource(token, 'hive.openshift.io/v1', 'clusterPools')
    watchResource(token, 'hive.openshift.io/v1', 'clusterImageSets')
    watchResource(token, 'hive.openshift.io/v1', 'clusterProvisions')
    watchResource(token, 'hive.openshift.io/v1', 'machinePools')
    watchResource(token, 'addon.open-cluster-management.io/v1alpha1', 'clusterManagementAddons')
    watchResource(token, 'addon.open-cluster-management.io/v1alpha1', 'managedClusterAddons')
    watchResource(token, 'v1', 'secrets', {
        labelSelector: { 'cluster.open-cluster-management.io/credentials': '' },
    })
    watchResource(token, 'discovery.open-cluster-management.io/v1alpha1', 'discoveryConfigs')
    watchResource(token, 'discovery.open-cluster-management.io/v1alpha1', 'discoveredClusters')
    watchResource(token, 'config.openshift.io/v1', 'featureGates', {
        labelSelector: { 'console.open-cluster-management.io': '' },
    })
    watchResource(token, 'v1', 'configmaps', {
        fieldSelector: {
            'metadata.namespace': 'openshift-config-managed',
            'metadata.name': 'console-public',
        },
    })
    watchResource(token, 'v1', 'configmaps', {
        fieldSelector: {
            'metadata.name': 'insight-content-data',
        },
    })
    watchResource(token, 'cluster.open-cluster-management.io/v1beta1', 'clustercurators')
    watchResource(token, 'wgpolicyk8s.io/v1alpha2', 'policyreports')
    watchResource(token, 'submarineraddon.open-cluster-management.io/v1alpha1', 'submarinerconfigs')
    watchResource(token, 'tower.ansible.com/v1alpha1', 'ansiblejobs')
}

export function watchResource(
    token: string,
    apiVersion: string,
    kind: string,
    options?: {
        labelSelector?: Record<string, string>
        fieldSelector?: Record<string, string>
    },
    resourceVersion?: string
): void {
    let path = apiVersion.includes('/') ? '/apis' : '/api'
    path += `/${apiVersion}/${kind.toLowerCase()}`
    path += `?watch`

    if (options?.labelSelector) {
        path += Object.keys(options.labelSelector).map((key) =>
            options.labelSelector[key]
                ? `&labelSelector=${key}=${options.labelSelector[key]}`
                : `&labelSelector=${key}=`
        )
    }

    if (options?.fieldSelector) {
        path += '&fieldSelector='
        path += Object.keys(options.fieldSelector).map((key) => `${key}=${options.fieldSelector[key]}`)
    }

    path += '&allowWatchBookmarks'

    const url = `${process.env.CLUSTER_API_URL}${path}`

    let buffer: Buffer = Buffer.from('')
    const abortController = new AbortController()

    function onResponse(res: IncomingMessage) {
        if (res.statusCode === 200) {
            if (process.env.LOG_WATCH) {
                logger.info({ msg: 'watch start', kind })
            }
            res.on('data', (chunk) => {
                if (chunk instanceof Buffer) {
                    let oldBuffer = buffer
                    buffer = Buffer.concat([buffer, chunk])
                    oldBuffer.fill(0)
                    chunk.fill(0)

                    let index = buffer.indexOf('\n')
                    while (index !== -1) {
                        // TODO - Security: Search for secret and zero out secret

                        const data = buffer.slice(0, index)
                        try {
                            const watchEvent = JSON.parse(data.toString()) as WatchEvent
                            handleWatchEvent(watchEvent)
                        } catch (err) {
                            logger.error(err)
                        }
                        buffer = buffer.slice(index + 1)
                        index = buffer.indexOf('\n')
                    }

                    oldBuffer = buffer
                    buffer = Buffer.from(buffer)
                    oldBuffer.fill(0)
                }
            }).on('end', () => noop)
        } else {
            res.on('data', () => noop)
            res.on('end', () => noop)
        }
    }

    function onClose() {
        if (process.env.LOG_WATCH) logger.info({ msg: 'watch stop', kind })
        if (stopping) return
        watchResource(token, apiVersion, kind, options)
    }

    function onError(err: Error) {
        if (stopping) return
        logger.error({
            msg: 'watching error',
            kind,
            error: err.message,
            code: (err as unknown as { code: string })?.code,
        })
        switch ((err as unknown as { code: string }).code) {
            case 'ENOTFOUND':
                setDead()
                break
        }
    }

    requestRetry({
        url,
        token,
        timeout: 4 * 60 * 1000 + Math.floor(Math.random() * 30 * 1000),
        onResponse,
        onError,
        onClose,
        signal: abortController.signal,
    })
    abortControllers[kind] = abortController
}

function handleWatchEvent(watchEvent: WatchEvent): string {
    let { object: resource } = watchEvent

    if (watchEvent.type === 'ERROR') {
        if ((watchEvent.object as { code?: number })?.code !== 410) {
            logger.warn({ msg: 'watch error event', event: watchEvent })
        }
        return
    }

    if (watchEvent.type === 'BOOKMARK') {
        return resource.metadata?.resourceVersion
    }

    if (process.env.LOG_WATCH === 'true') {
        logger.trace({
            msg: 'watch',
            type: watchEvent.type,
            kind: resource.kind,
            name: resource.metadata?.name,
            namespace: resource.metadata?.namespace,
        })
    }

    if (!resource.kind) return undefined
    if (!resource.metadata?.name) return undefined

    // Remove undesired fields
    delete resource.metadata.managedFields
    delete resource.metadata.selfLink

    // Limit resource to just what is needed for DELETED
    if (watchEvent.type === 'DELETED') {
        resource = {
            kind: resource.kind,
            apiVersion: resource.apiVersion,
            metadata: {
                name: resource.metadata.name,
                namespace: resource.metadata.namespace,
            },
        }
        watchEvent.object = resource
    }

    let kindCache = resourceCache[resource.kind]
    if (!kindCache) {
        kindCache = {}
        resourceCache[resource.kind] = kindCache
    }

    const namespace = resource.metadata.namespace?.toString()
    let namespaceCache = kindCache[namespace]
    if (!namespaceCache) {
        namespaceCache = {}
        kindCache[namespace] = namespaceCache
    }

    const name = resource.metadata.name
    const existing = namespaceCache[name]
    if (existing) {
        if (existing.resource.metadata.resourceVersion === resource.metadata.resourceVersion)
            return resource.metadata.resourceVersion
        ServerSideEvents.removeEvent(existing.eventID)
    }

    const eventID = ServerSideEvents.pushEvent({ data: watchEvent })
    namespaceCache[name] = { resource, eventID }

    return resource.metadata.resourceVersion
}

function eventFilter(token: string, serverSideEvent: ServerSideEvent<ServerSideEventData>): Promise<boolean> {
    switch (serverSideEvent.data?.type) {
        case 'START':
        case 'LOADED':
        case 'SETTINGS':
            return Promise.resolve(true)

        case 'DELETED':
            // TODO - Security issue: Only send delete events to clients who can access that item
            // - Problem is if the namespace goes away, access check will fail
            // - Need to track what is sent to client and only send if they previously accessed this event
            return Promise.resolve(true)
        case 'ADDED':
        case 'MODIFIED': {
            const watchEvent = serverSideEvent.data
            const resource = watchEvent.object

            switch (resource.kind) {
                case 'FeatureGate': // Allow feature gates for all users
                    return Promise.resolve(true)
            }

            return canListClusterScopedKind(resource, token).then((allowed) => {
                if (allowed) return true
                return canListNamespacedScopedKind(resource, token).then((allowed) => {
                    if (allowed) return true
                    return canGetResource(resource, token)
                })
            })
        }
        default:
            logger.warn({ msg: 'unhandled server side event data type', serverSideEvent })
            return Promise.resolve(false)
    }
}

const accessCache: Record<string, Record<string, { time: number; promise: Promise<boolean> }>> = {}

function canListClusterScopedKind(resource: IResource, token: string): Promise<boolean> {
    return canAccess({ kind: resource.kind, apiVersion: resource.apiVersion }, 'list', token)
}

function canListNamespacedScopedKind(resource: IResource, token: string): Promise<boolean> {
    if (!resource.metadata?.namespace) return Promise.resolve(false)
    return canAccess(
        {
            kind: resource.kind,
            apiVersion: resource.apiVersion,
            metadata: { namespace: resource.metadata.namespace },
        },
        'list',
        token
    )
}

function canGetResource(resource: IResource, token: string): Promise<boolean> {
    return canAccess(resource, 'get', token)
}

function canAccess(
    resource: { kind: string; apiVersion: string; metadata?: { name?: string; namespace?: string } },
    verb: 'get' | 'list',
    token: string
): Promise<boolean> {
    // TODO make sure old cache items get cleaned up

    const key = `${resource.kind}:${resource.metadata?.namespace}:${resource.metadata?.name}`
    if (!accessCache[token]) accessCache[token] = {}
    const existing = accessCache[token][key]
    if (existing && existing.time > Date.now() - 60 * 1000) {
        return existing.promise
    }

    const promise = jsonPost<{ status: { allowed: boolean } }>(
        process.env.CLUSTER_API_URL + '/apis/authorization.k8s.io/v1/selfsubjectaccessreviews',
        {
            apiVersion: 'authorization.k8s.io/v1',
            kind: 'SelfSubjectAccessReview',
            metadata: {},
            spec: {
                resourceAttributes: {
                    group: resource.apiVersion.includes('/') ? resource.apiVersion.split('/')[0] : '',
                    name: resource.metadata?.name,
                    namespace:
                        resource.metadata?.namespace ??
                        (resource.kind === 'Namespace' ? resource.metadata?.name : undefined),
                    resource: resource.kind.toLowerCase() + 's',
                    verb,
                },
            },
        },
        token
    ).then((result) => {
        if (process.env.LOG_ACCESS === 'true') {
            logger.debug({
                msg: 'access',
                allowed: result.body.status.allowed,
                verb,
                resource: resource.kind.toLowerCase() + 's',
                name: resource.metadata?.name,
                namespace: resource.metadata?.namespace,
            })
        }
        return result.body.status.allowed
    })

    accessCache[token][key] = {
        time: Date.now(),
        promise,
    }
    return promise
}

let stopping = false
export function stopWatching(): void {
    stopping = true
    for (const kind in abortControllers) {
        abortControllers[kind].abort()
    }
}
