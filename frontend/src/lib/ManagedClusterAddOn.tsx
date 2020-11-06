import { V1ObjectMeta } from '@kubernetes/client-node'
import { useCallback } from 'react'
import { IResource, ResourceList } from '../library/resources/resource'
import { resourceMethods } from '../library/utils/resource-methods'
import { useQuery } from './useQuery'

export const ManagedClusterAddOnApiVersion = 'addon.open-cluster-management.io/v1alpha1'
export type ManagedClusterAddOnApiVersionType = 'addon.open-cluster-management.io/v1alpha1'

export const ManagedClusterAddOnKind = 'ManagedClusterAddOn'
export type ManagedClusterAddOnKindType = 'ManagedClusterAddOn'

export interface ManagedClusterAddOn extends IResource {
    apiVersion: ManagedClusterAddOnApiVersionType
    kind: ManagedClusterAddOnKindType
    metadata: V1ObjectMeta
    spec: {}
    status: {
        conditions: {
            lastTransitionTime: string
            message: string
            reason: string
            status: string
            type: string
        }[]
        addOnMeta: {
            displayName: string
            description: string
        }
        addOnConfiguration: {
            crdName: string
            crName: string
        }
    }
}

export const managedClusterAddOnMethods = resourceMethods<ManagedClusterAddOn>({
    apiVersion: ManagedClusterAddOnApiVersion,
    kind: ManagedClusterAddOnKind,
})

export function useManagedClusterAddOns(namespace: string) {
    const restFunc = useCallback(() => {
        return managedClusterAddOnMethods.listNamespace(namespace)
    }, [namespace])
    return useQuery<ResourceList<ManagedClusterAddOn>>(restFunc)
}
