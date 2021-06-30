/* Copyright Contributors to the Open Cluster Management project */
import { Fragment, ReactNode, useEffect, useState } from 'react'
import { atom, SetterOrUpdater, useRecoilState } from 'recoil'
import { LoadingPage } from './components/LoadingPage'
import { AcmRoute } from '@open-cluster-management/ui-components'
import { BareMetalAsset, BareMetalAssetKind } from './resources/bare-metal-asset'
import { AnsibleJob, AnsibleJobKind } from './resources/ansible-job'
import { CertificateSigningRequest, CertificateSigningRequestKind } from './resources/certificate-signing-requests'
import { ClusterClaim, ClusterClaimKind } from './resources/cluster-claim'
import { ClusterCurator, ClusterCuratorKind } from './resources/cluster-curator'
import { ClusterDeployment, ClusterDeploymentKind } from './resources/cluster-deployment'
import { ClusterImageSet, ClusterImageSetKind } from './resources/cluster-image-set'
import { ClusterPool, ClusterPoolKind } from './resources/cluster-pool'
import { ClusterProvision, ClusterProvisionKind } from './resources/cluster-provision'
import { ClusterManagementAddOn, ClusterManagementAddOnKind } from './resources/cluster-management-add-on'
import { ConfigMap, ConfigMapKind } from './resources/configmap'
import { DiscoveryConfig, DiscoveryConfigKind } from './resources/discovery-config'
import { DiscoveredCluster, DiscoveredClusterKind } from './resources/discovered-cluster'
import { FeatureGate, FeatureGateKind } from './resources/feature-gate'
import { MachinePool, MachinePoolKind } from './resources/machine-pool'
import { ManagedCluster, ManagedClusterKind } from './resources/managed-cluster'
import { ManagedClusterAddOn, ManagedClusterAddOnKind } from './resources/managed-cluster-add-on'
import { ManagedClusterInfo, ManagedClusterInfoKind } from './resources/managed-cluster-info'
import { ManagedClusterSet, ManagedClusterSetKind } from './resources/managed-cluster-set'
import { ManagedClusterSetBinding, ManagedClusterSetBindingKind } from './resources/managed-cluster-set-binding'
import { MultiClusterHub, MultiClusterHubKind } from './resources/multi-cluster-hub'
import { Namespace, NamespaceKind } from './resources/namespace'
import { PolicyReport, PolicyReportKind } from './resources/policy-report'
import { Secret, SecretKind } from './resources/secret'
import { SubmarinerConfig, SubmarinerConfigKind } from './resources/submariner-config'
import { Deployment, DeploymentKind } from './resources/deployments'

export const acmRouteState = atom<AcmRoute>({ key: 'acmRoute', default: '' as AcmRoute })
export const bareMetalAssetsState = atom<BareMetalAsset[]>({ key: 'bareMetalAssets', default: [] })
export const certificateSigningRequestsState = atom<CertificateSigningRequest[]>({
    key: 'certificateSigningRequests',
    default: [],
})
export const clusterClaimsState = atom<ClusterClaim[]>({ key: 'clusterClaims', default: [] })
export const clusterCuratorsState = atom<ClusterCurator[]>({ key: 'clusterCurators', default: [] })
export const clusterDeploymentsState = atom<ClusterDeployment[]>({ key: 'clusterDeployments', default: [] })
export const clusterImageSetsState = atom<ClusterImageSet[]>({ key: 'clusterImageSets', default: [] })
export const clusterPoolsState = atom<ClusterPool[]>({ key: 'clusterPools', default: [] })
export const clusterProvisionsState = atom<ClusterProvision[]>({ key: 'clusterProvisions', default: [] })
export const clusterManagementAddonsState = atom<ClusterManagementAddOn[]>({
    key: 'clusterManagementAddons',
    default: [],
})
export const configMapsState = atom<ConfigMap[]>({ key: 'configMaps', default: [] })
export const deploymentsState = atom<Deployment[]>({ key: 'deployments', default: [] })
export const discoveryConfigState = atom<DiscoveryConfig[]>({ key: 'discoveryConfigs', default: [] })
export const discoveredClusterState = atom<DiscoveredCluster[]>({ key: 'discoveredClusters', default: [] })
export const featureGatesState = atom<FeatureGate[]>({ key: 'featureGates', default: [] })
export const machinePoolsState = atom<MachinePool[]>({ key: 'machinePools', default: [] })
export const managedClustersState = atom<ManagedCluster[]>({ key: 'managedClusters', default: [] })
export const managedClusterAddonsState = atom<ManagedClusterAddOn[]>({ key: 'managedClusterAddons', default: [] })
export const managedClusterInfosState = atom<ManagedClusterInfo[]>({ key: 'managedClusterInfos', default: [] })
export const managedClusterSetsState = atom<ManagedClusterSet[]>({ key: 'managedClusterSets', default: [] })
export const managedClusterSetBindingsState = atom<ManagedClusterSetBinding[]>({
    key: 'managedClusterSetBindings',
    default: [],
})
export const multiClusterHubState = atom<MultiClusterHub[]>({ key: 'multiClusterHubs', default: [] })
export const namespacesState = atom<Namespace[]>({ key: 'namespaces', default: [] })
export const policyreportState = atom<PolicyReport[]>({ key: 'policyreports', default: [] })
export const secretsState = atom<Secret[]>({ key: 'secrets', default: [] })
export const settingsState = atom<Settings>({ key: 'settings', default: {} })
export const submarinerConfigsState = atom<SubmarinerConfig[]>({ key: 'submarinerconfigs', default: [] })
export const ansibleJobState = atom<AnsibleJob[]>({ key: 'ansiblejobs', default: [] })

interface Settings {
    LOG_LEVEL?: string
}

interface WatchEvent {
    type: 'ADDED' | 'DELETED' | 'MODIFIED'
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

export interface SettingsEvent {
    type: 'SETTINGS'
    settings: Record<string, string>
}

type ServerSideEventData = WatchEvent | SettingsEvent | { type: 'START' | 'LOADED' }

export function LoadData(props: { children?: ReactNode }) {
    const [loading, setLoading] = useState(true)
    const [, setAnsibleJobs] = useRecoilState(ansibleJobState)
    const [, setBareMetalAssets] = useRecoilState(bareMetalAssetsState)
    const [, setCertificateSigningRequests] = useRecoilState(certificateSigningRequestsState)
    const [, setClusterClaims] = useRecoilState(clusterClaimsState)
    const [, setClusterCurators] = useRecoilState(clusterCuratorsState)
    const [, setClusterDeployments] = useRecoilState(clusterDeploymentsState)
    const [, setClusterPools] = useRecoilState(clusterPoolsState)
    const [, setClusterProvisions] = useRecoilState(clusterProvisionsState)
    const [, setClusterImageSets] = useRecoilState(clusterImageSetsState)
    const [, setClusterManagementAddons] = useRecoilState(clusterManagementAddonsState)
    const [, setConfigMaps] = useRecoilState(configMapsState)
    const [, setDeployments] = useRecoilState(deploymentsState)
    const [, setDiscoveryConfigs] = useRecoilState(discoveryConfigState)
    const [, setDiscoveredClusters] = useRecoilState(discoveredClusterState)
    const [, setFeatureGates] = useRecoilState(featureGatesState)
    const [, setMachinePools] = useRecoilState(machinePoolsState)
    const [, setManagedClusters] = useRecoilState(managedClustersState)
    const [, setManagedClusterAddons] = useRecoilState(managedClusterAddonsState)
    const [, setManagedClusterInfos] = useRecoilState(managedClusterInfosState)
    const [, setManagedClusterSets] = useRecoilState(managedClusterSetsState)
    const [, setManagedClusterSetBindings] = useRecoilState(managedClusterSetBindingsState)
    const [, setMultiClusterHubs] = useRecoilState(multiClusterHubState)
    const [, setNamespaces] = useRecoilState(namespacesState)
    const [, setPolicyReports] = useRecoilState(policyreportState)
    const [, setSecrets] = useRecoilState(secretsState)
    const [, setSettings] = useRecoilState(settingsState)
    const [, setSubmarinerConfigs] = useRecoilState(submarinerConfigsState)

    const setters: Record<string, SetterOrUpdater<any[]>> = {
        [AnsibleJobKind]: setAnsibleJobs,
        [BareMetalAssetKind]: setBareMetalAssets,
        [CertificateSigningRequestKind]: setCertificateSigningRequests,
        [ClusterClaimKind]: setClusterClaims,
        [ClusterCuratorKind]: setClusterCurators,
        [ClusterDeploymentKind]: setClusterDeployments,
        [ClusterImageSetKind]: setClusterImageSets,
        [ClusterPoolKind]: setClusterPools,
        [ClusterProvisionKind]: setClusterProvisions,
        [ClusterManagementAddOnKind]: setClusterManagementAddons,
        [ConfigMapKind]: setConfigMaps,
        [DeploymentKind]: setDeployments,
        [DiscoveryConfigKind]: setDiscoveryConfigs,
        [DiscoveredClusterKind]: setDiscoveredClusters,
        [FeatureGateKind]: setFeatureGates,
        [MachinePoolKind]: setMachinePools,
        [ManagedClusterKind]: setManagedClusters,
        [ManagedClusterAddOnKind]: setManagedClusterAddons,
        [ManagedClusterInfoKind]: setManagedClusterInfos,
        [ManagedClusterSetKind]: setManagedClusterSets,
        [ManagedClusterSetBindingKind]: setManagedClusterSetBindings,
        [MultiClusterHubKind]: setMultiClusterHubs,
        [NamespaceKind]: setNamespaces,
        [PolicyReportKind]: setPolicyReports,
        [SecretKind]: setSecrets,
        [SubmarinerConfigKind]: setSubmarinerConfigs,
    }

    useEffect(() => {
        let eventDataQueue: WatchEvent[] | undefined = []

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

        function processEventData(data: WatchEvent): void {
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
                    const data = JSON.parse(event.data) as ServerSideEventData
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
                        case 'SETTINGS':
                            setSettings(data.settings)
                            break
                    }
                } catch (err) {
                    console.error(err)
                }
            }
        }

        let evtSource: EventSource | undefined
        function startWatch() {
            evtSource = new EventSource(`${process.env.REACT_APP_BACKEND_PATH}/events`, { withCredentials: true })
            evtSource.onmessage = processMessage
            evtSource.onerror = function () {
                console.log('EventSource', 'error', 'readyState', evtSource?.readyState)
                switch (evtSource?.readyState) {
                    case EventSource.CLOSED:
                        startWatch()
                        break
                }
            }
        }
        startWatch()
        return () => {
            if (evtSource) evtSource.close()
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        function checkLoggedIn() {
            fetch(`${process.env.REACT_APP_BACKEND_PATH}/authenticated`, {
                credentials: 'include',
                headers: { accept: 'application/json' },
            })
                .then((res) => {
                    switch (res.status) {
                        case 200:
                            break
                        default:
                            if (process.env.NODE_ENV === 'production') {
                                window.location.reload()
                            } else {
                                window.location.href = `${process.env.REACT_APP_BACKEND_HOST}${process.env.REACT_APP_BACKEND_PATH}/login`
                            }
                            break
                    }
                })
                .catch(() => {
                    if (process.env.NODE_ENV === 'production') {
                        window.location.reload()
                    } else {
                        window.location.href = `${process.env.REACT_APP_BACKEND_HOST}${process.env.REACT_APP_BACKEND_PATH}/login`
                    }
                })
                .finally(() => {
                    setTimeout(checkLoggedIn, 30 * 1000)
                })
        }
        checkLoggedIn()
    }, [])

    if (loading) return <LoadingPage />

    return <Fragment>{props.children}</Fragment>
}
