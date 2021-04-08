/* Copyright Contributors to the Open Cluster Management project */
import { ReactNode, useEffect, useState } from 'react'
import { atom, SetterOrUpdater, useRecoilState } from 'recoil'
import { LoadingPage } from './components/LoadingPage'
import { BareMetalAsset, BareMetalAssetKind } from './resources/bare-metal-asset'
import { CertificateSigningRequest, CertificateSigningRequestKind } from './resources/certificate-signing-requests'
import { ClusterClaim, ClusterClaimKind } from './resources/cluster-claim'
import { ClusterDeployment, ClusterDeploymentKind } from './resources/cluster-deployment'
import { ClusterImageSet, ClusterImageSetKind } from './resources/cluster-image-set'
import { ClusterPool, ClusterPoolKind } from './resources/cluster-pool'
import { ClusterProvision, ClusterProvisionKind } from './resources/cluster-provision'
import { ClusterManagementAddOn, ClusterManagementAddOnKind } from './resources/cluster-management-add-on'
import { DiscoveryConfig, DiscoveryConfigKind } from './resources/discovery-config'
import { DiscoveredCluster, DiscoveredClusterKind } from './resources/discovered-cluster'
import { ManagedCluster, ManagedClusterKind } from './resources/managed-cluster'
import { MultiClusterHub, MultiClusterHubKind } from './resources/multi-cluster-hub'
import { ManagedClusterSet, ManagedClusterSetKind } from './resources/managed-cluster-set'
import { ManagedClusterAddOn, ManagedClusterAddOnKind } from './resources/managed-cluster-add-on'
import { ManagedClusterInfo, ManagedClusterInfoKind } from './resources/managed-cluster-info'
import { Namespace, NamespaceKind } from './resources/namespace'
import { ProviderConnection, ProviderConnectionKind } from './resources/provider-connection'
import { ConfigMap, ConfigMapKind } from './resources/configmap'
import { FeatureGate, FeatureGateKind } from './resources/feature-gate'
import { AcmRoute } from '@open-cluster-management/ui-components'

export const acmRouteState = atom<AcmRoute>({ key: 'acmRoute', default: '' as AcmRoute })
export const bareMetalAssetsState = atom<BareMetalAsset[]>({ key: 'bareMetalAssets', default: [] })
export const certificateSigningRequestsState = atom<CertificateSigningRequest[]>({
    key: 'certificateSigningRequests',
    default: [],
})
export const clusterClaimsState = atom<ClusterClaim[]>({ key: 'clusterClaims', default: [] })
export const clusterDeploymentsState = atom<ClusterDeployment[]>({ key: 'clusterDeployments', default: [] })
export const clusterImageSetsState = atom<ClusterImageSet[]>({ key: 'clusterImageSets', default: [] })
export const clusterPoolsState = atom<ClusterPool[]>({ key: 'clusterPools', default: [] })
export const clusterProvisionsState = atom<ClusterProvision[]>({ key: 'clusterProvisions', default: [] })
export const clusterManagementAddonsState = atom<ClusterManagementAddOn[]>({
    key: 'clusterManagementAddons',
    default: [],
})
export const configMapsState = atom<ConfigMap[]>({ key: 'configMaps', default: [] })
export const discoveryConfigState = atom<DiscoveryConfig[]>({ key: 'discoveryConfigs', default: [] })
export const discoveredClusterState = atom<DiscoveredCluster[]>({ key: 'discoveredClusters', default: [] })
export const featureGatesState = atom<FeatureGate[]>({ key: 'featureGates', default: [] })
export const managedClusterAddonsState = atom<ManagedClusterAddOn[]>({ key: 'managedClusterAddons', default: [] })
export const managedClustersState = atom<ManagedCluster[]>({ key: 'managedClusters', default: [] })
export const multiClusterHubState = atom<MultiClusterHub[]>({ key: 'multiClusterHubs', default: [] })
export const managedClusterInfosState = atom<ManagedClusterInfo[]>({ key: 'managedClusterInfos', default: [] })
export const managedClusterSetsState = atom<ManagedClusterSet[]>({ key: 'managedClusterSets', default: [] })
export const namespacesState = atom<Namespace[]>({ key: 'namespaces', default: [] })
export const providerConnectionsState = atom<ProviderConnection[]>({ key: 'providerConnections', default: [] })

interface IEventData {
    type: 'ADDED' | 'DELETED' | 'MODIFIED' | 'LOADED' | 'START'
    object: {
        kind: string
        apiVersion: string
        metadata: {
            name: string
            namespace: string
            resourceVersion: string
        }
    }
}

export function LoadData(props: { children?: ReactNode }) {
    const [loading, setLoading] = useState(true)
    const [, setBareMetalAssets] = useRecoilState(bareMetalAssetsState)
    const [, setCertificateSigningRequests] = useRecoilState(certificateSigningRequestsState)
    const [, setClusterClaims] = useRecoilState(clusterClaimsState)
    const [, setClusterDeployments] = useRecoilState(clusterDeploymentsState)
    const [, setClusterPools] = useRecoilState(clusterPoolsState)
    const [, setClusterProvisions] = useRecoilState(clusterProvisionsState)
    const [, setClusterImageSets] = useRecoilState(clusterImageSetsState)
    const [, setClusterManagementAddons] = useRecoilState(clusterManagementAddonsState)
    const [, setConfigMaps] = useRecoilState(configMapsState)
    const [, setDiscoveryConfigs] = useRecoilState(discoveryConfigState)
    const [, setDiscoveredClusters] = useRecoilState(discoveredClusterState)
    const [, setFeatureGates] = useRecoilState(featureGatesState)
    const [, setManagedClusterAddons] = useRecoilState(managedClusterAddonsState)
    const [, setManagedClusters] = useRecoilState(managedClustersState)
    const [, setMultiClusterHubs] = useRecoilState(multiClusterHubState)
    const [, setManagedClusterInfos] = useRecoilState(managedClusterInfosState)
    const [, setManagedClusterSets] = useRecoilState(managedClusterSetsState)
    const [, setNamespaces] = useRecoilState(namespacesState)
    const [, setProviderConnections] = useRecoilState(providerConnectionsState)

    const setters: Record<string, SetterOrUpdater<any[]>> = {
        [BareMetalAssetKind]: setBareMetalAssets,
        [CertificateSigningRequestKind]: setCertificateSigningRequests,
        [ClusterClaimKind]: setClusterClaims,
        [ClusterDeploymentKind]: setClusterDeployments,
        [ClusterImageSetKind]: setClusterImageSets,
        [ClusterPoolKind]: setClusterPools,
        [ClusterProvisionKind]: setClusterProvisions,
        [ClusterManagementAddOnKind]: setClusterManagementAddons,
        [ConfigMapKind]: setConfigMaps,
        [DiscoveryConfigKind]: setDiscoveryConfigs,
        [FeatureGateKind]: setFeatureGates,
        [ManagedClusterAddOnKind]: setManagedClusterAddons,
        [ManagedClusterKind]: setManagedClusters,
        [MultiClusterHubKind]: setMultiClusterHubs,
        [ManagedClusterInfoKind]: setManagedClusterInfos,
        [ManagedClusterSetKind]: setManagedClusterSets,
        [NamespaceKind]: setNamespaces,
        [ProviderConnectionKind]: setProviderConnections,
        [DiscoveredClusterKind]: setDiscoveredClusters,
    }

    // Temporary fix for checking for login
    useEffect(() => {
        function checkLoggedIn() {
            fetch(`${process.env.REACT_APP_BACKEND_PATH}/api/`, {
                credentials: 'include',
                headers: { accept: 'application/json' },
            }).then((res) => {
                switch (res.status) {
                    case 401:
                        window.location.href = `${process.env.REACT_APP_BACKEND_HOST}/login`
                        break
                }
                setTimeout(checkLoggedIn, 30 * 1000)
            })
        }
        checkLoggedIn()
    }, [])

    useEffect(() => {
        let eventDataQueue: IEventData[] | undefined = []

        async function processEvents() {
            if (!eventDataQueue) return
            const dataToProcess = eventDataQueue
            for (const kind in setters) {
                const setter = setters[kind]
                setter((resources) => {
                    const newResources = [...resources]
                    for (const data of dataToProcess) {
                        if (data.object?.kind === kind) {
                            const index = newResources.findIndex(
                                (resource) =>
                                    resource.metadata?.name === data.object.metadata.name &&
                                    resource.metadata?.namespace === data.object.metadata.namespace
                            )
                            switch (data.type) {
                                case 'ADDED':
                                case 'MODIFIED':
                                    if (index !== -1) newResources[index] = data.object
                                    else newResources.push(data.object)
                                    break
                                case 'DELETED':
                                    if (index !== -1) newResources.splice(index, 1)
                                    break
                            }
                        }
                    }
                    return newResources
                })
            }
            eventDataQueue = undefined
        }

        function processEventData(data: IEventData): void {
            if (!data.object) return
            const setter = setters[data.object.kind]
            if (!setter) return
            setter((resources) => {
                const newResources = [...resources]
                const index = resources.findIndex(
                    (resource) =>
                        resource.metadata?.name === data.object.metadata.name &&
                        resource.metadata?.namespace === data.object.metadata.namespace
                )
                switch (data.type) {
                    case 'ADDED':
                    case 'MODIFIED':
                        if (index !== -1) newResources[index] = data.object
                        else newResources.push(data.object)
                        break
                    case 'DELETED':
                        if (index !== -1) newResources.splice(index, 1)
                        break
                }
                return newResources
            })
        }

        function processMessage(event: MessageEvent) {
            if (event.data) {
                try {
                    const data = JSON.parse(event.data) as IEventData
                    switch (data.type) {
                        case 'ADDED':
                        case 'MODIFIED':
                        case 'DELETED':
                            if (eventDataQueue) eventDataQueue.push(data)
                            else processEventData(data)
                            break
                        case 'START':
                            if (eventDataQueue === undefined) eventDataQueue = []
                            break
                        case 'LOADED':
                            processEvents()
                            setLoading(false)
                            break
                    }
                } catch (err) {
                    console.error(err)
                }
            }
        }

        let evtSource: EventSource | undefined
        function startWatch() {
            evtSource = new EventSource(`${process.env.REACT_APP_BACKEND_PATH}/watch`, { withCredentials: true })
            evtSource.onmessage = processMessage
            evtSource.onerror = function (err) {
                console.error('EventSource failed:', err)
            }
        }
        startWatch()
        return () => {
            if (evtSource) evtSource.close()
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    if (loading) return <LoadingPage />

    return props.children
}
