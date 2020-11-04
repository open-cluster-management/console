import { V1ObjectMeta } from '@kubernetes/client-node'
import Axios, { AxiosResponse, Method } from 'axios'
import { useCallback, useEffect, useState } from 'react'

// https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.19

const responseType = 'json'
const withCredentials = true

export interface ResourceList<T> {
    items: T[]
}

export function GetWrapper<T>(restFunc: () => Promise<AxiosResponse<T>>) {
    const [data, setData] = useState<T>()
    const [error, setError] = useState<Error>()
    const [loading, setLoading] = useState(true)
    const [polling, setPolling] = useState(0)

    const refresh = useCallback(
        function refresh() {
            void restFunc()
                .then((response) => {
                    setLoading(false)
                    switch (response.status) {
                        case 401:
                            window.location.href = `${process.env.REACT_APP_BACKEND}/cluster-management/login`
                            setData(undefined)
                            break
                        default:
                            setData(response.data)
                            setError(undefined)
                            break
                    }
                })
                .catch((err: Error) => {
                    console.log(typeof err)
                    setData(undefined)
                    setError(err)
                    setLoading(false)
                })
        },
        [restFunc]
    )

    useEffect(refresh, [refresh])

    useEffect(() => {
        if (polling > 0) {
            const interval = setInterval(refresh, polling)
            return () => clearInterval(interval)
        }
    }, [refresh, polling])

    function startPolling(interval: number) {
        setPolling(interval)
    }

    function stopPolling() {
        setPolling(0)
    }

    useEffect(() => {
        const code: string = (error as any)?.statusCode
        switch (code) {
            case '401':
                window.location.href = `${process.env.REACT_APP_BACKEND}/cluster-management/login`
        }
    }, [error])

    return { error, loading, data, startPolling, stopPolling, refresh }
}

export interface IResource {
    apiVersion?: string
    kind?: string
    metadata?: V1ObjectMeta
}

export interface IResourceList<Resource extends IResource> {
    items: Resource[]
}

export async function restRequest<T>(method: Method, url: string, data?: object): Promise<AxiosResponse<T>> {
    return await Axios.request<T>({ method, url, data, responseType, withCredentials, validateStatus: () => true })
}

export interface IResourceMethods<Resource> {
    apiPath: string
    plural: string
    create: (resource: Resource) => Promise<AxiosResponse<Resource>>
    delete: (name?: string, namespace?: string) => Promise<AxiosResponse<Resource>>
    list: (labels?: string[]) => Promise<AxiosResponse<ResourceList<Resource>>>
    listCluster: (labels?: string[]) => Promise<AxiosResponse<ResourceList<Resource>>>
    listNamespace: (namespace: string, labels?: string[]) => Promise<AxiosResponse<ResourceList<Resource>>>
    getNamespaceResource: (namespace: string, name: string) => Promise<AxiosResponse<Resource>>
}

export function resourceMethods<Resource extends IResource>(options: {
    path: string
    plural: string
}): IResourceMethods<Resource> {
    const root = `${process.env.REACT_APP_BACKEND}/cluster-management/proxy${options.path}`
    return {
        apiPath: options.path,
        plural: options.plural,
        create: function createResource(resource: Resource) {
            let url = root
            if (resource.metadata?.namespace) url += `/namespaces/${resource.metadata.namespace}`
            url += `/${options.plural}`
            return restRequest<Resource>('POST', url, resource)
        },
        delete: function deleteResource(name?: string, namespace?: string) {
            let url = root
            if (namespace) url += `/namespaces/${namespace}`
            url += `/${options.plural}`
            url += `/${name}`
            return restRequest<Resource>('DELETE', url)
        },
        list: function listClusterResources(labels?: string[]) {
            let url = `${process.env.REACT_APP_BACKEND}/cluster-management/namespaced${options.path}`
            url += `/${options.plural}`
            if (labels) url += '?labelSelector=' + labels.join(',')
            return restRequest<ResourceList<Resource>>('GET', url)
        },
        listCluster: function listClusterResources(labels?: string[]) {
            let url = root
            url += `/${options.plural}`
            if (labels) url += '?labelSelector=' + labels.join(',')
            return restRequest<ResourceList<Resource>>('GET', url)
        },
        listNamespace: function listNamespaceResources(namespace: string, labels?: string[]) {
            let url = root
            url += `/namespaces/${namespace}`
            url += `/${options.plural}`
            if (labels) url += '?labelSelector=' + labels.join(',')
            return restRequest<ResourceList<Resource>>('GET', url)
        },
        getNamespaceResource: function getSingleNamespaceResource(namespace: string, name: string) {
            let url = root
            url += `/namespaces/${namespace}/${options.plural}/${name}`
            return restRequest<Resource>('GET', url)
        }
    }
}

export function deleteCreatedResources(resources: AxiosResponse[]) {
    return Promise.all(resources.map(resource => {
        /* istanbul ignore else */
        if (resource.status !== 409) {
            const url = `${resource.config.url}/${resource.data.details.name}`
            return restRequest<IResource>('DELETE', url)
        }
    }))
}

export function getResourceName(resource: Partial<IResource>) {
    return resource.metadata?.name
}

export function setResourceName(resource: Partial<IResource>, name: string) {
    if (!resource.metadata) resource.metadata = {}
    return (resource.metadata.name = name)
}

export function getResourceNamespace(resource: Partial<IResource>) {
    return resource.metadata?.namespace
}

export function setResourceNamespace(resource: Partial<IResource>, namespace: string) {
    if (!resource.metadata) resource.metadata = {}
    return (resource.metadata.namespace = namespace)
}
