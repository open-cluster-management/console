import nock from 'nock'
import { join } from 'path'
import { IResource } from '../library/resources/resource'
import { IResourceMethods, getResourcePath, getResourceNamePath } from '../library/utils/resource-methods'

export function nockList<Resource extends IResource>(
    resourceMethods: IResourceMethods<Resource>,
    resources: Resource[],
    labels?: string[]
) {
    let nockScope = nock(process.env.REACT_APP_BACKEND as string, { encodedQueryParams: true }).get(
        join('/cluster-management/namespaced', getResourcePath(resourceMethods))
    )

    if (labels) {
        nockScope = nockScope.query({
            labelSelector: encodeURIComponent(labels.join(',')),
        })
    }

    return nockScope.reply(
        200,
        { items: resources },
        {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Credentials': 'true',
        }
    )
}

export function nockClusterList<Resource extends IResource>(
    resourceMethods: IResourceMethods<Resource>,
    resources: Resource[],
    labels?: string[]
) {
    console.log('NOCK', join('/cluster-management/proxy', getResourcePath(resourceMethods)))
    let networkMock = nock(process.env.REACT_APP_BACKEND as string, { encodedQueryParams: true }).get(
        join('/cluster-management/proxy', getResourcePath(resourceMethods))
    )

    if (labels) {
        networkMock = networkMock.query({
            labelSelector: encodeURIComponent(labels.join(',')),
        })
    }

    return networkMock.reply(
        200,
        { items: resources },
        {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Credentials': 'true',
        }
    )
}

export function nockCreate(resource: IResource, response: IResource, statusCode = 201) {
    return nock(process.env.REACT_APP_BACKEND as string, { encodedQueryParams: true })
        .post('/cluster-management/proxy' + getResourcePath(resource), JSON.stringify(resource))
        .reply(statusCode, response, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Credentials': 'true',
        })
}

export function nockDelete(resource: IResource) {
    return nock(process.env.REACT_APP_BACKEND as string, { encodedQueryParams: true })
        .options('/cluster-management/proxy' + getResourceNamePath(resource))
        .optionally()
        .reply(204, undefined, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
            'Access-Control-Allow-Credentials': 'true',
        })
        .delete('/cluster-management/proxy' + getResourceNamePath(resource))
        .reply(204, undefined, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
            'Access-Control-Allow-Credentials': 'true',
        })
}
