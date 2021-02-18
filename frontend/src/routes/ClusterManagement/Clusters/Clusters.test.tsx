import { render } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { nockAccessReview, nockDelete, nockList } from '../../../lib/nock-util'
import {
    clickByLabel,
    clickByRole,
    clickByText,
    typeByText,
    waitForNocks,
    waitForNotText,
    waitForText,
} from '../../../lib/test-util'
import {
    CertificateSigningRequest,
    CertificateSigningRequestApiVersion,
    CertificateSigningRequestKind,
} from '../../../resources/certificate-signing-requests'
import {
    ClusterDeployment,
    ClusterDeploymentApiVersion,
    ClusterDeploymentKind,
} from '../../../resources/cluster-deployment'
import { ManagedCluster, ManagedClusterApiVersion, ManagedClusterKind } from '../../../resources/managed-cluster'
import {
    ManagedClusterInfo,
    ManagedClusterInfoApiVersion,
    ManagedClusterInfoKind,
} from '../../../resources/managed-cluster-info'
import { ResourceAttributes } from '../../../resources/self-subject-access-review'
import ClustersPage from './Clusters'

const mockManagedCluster1: ManagedCluster = {
    apiVersion: ManagedClusterApiVersion,
    kind: ManagedClusterKind,
    metadata: { name: 'managed-cluster-name-1' },
    spec: { hubAcceptsClient: true },
    status: {
        allocatable: { cpu: '', memory: '' },
        capacity: { cpu: '', memory: '' },
        clusterClaims: [{ name: 'platform.open-cluster-management.io', value: 'AWS' }],
        conditions: [],
        version: { kubernetes: '' },
    },
}
const mockManagedCluster2: ManagedCluster = {
    apiVersion: ManagedClusterApiVersion,
    kind: ManagedClusterKind,
    metadata: { name: 'managed-cluster-name-2' },
    spec: { hubAcceptsClient: true },
}
const readyManagedClusterConditions = [
    { type: 'ManagedClusterConditionAvailable', reason: 'ManagedClusterConditionAvailable', status: 'True' },
    { type: 'ManagedClusterJoined', reason: 'ManagedClusterJoined', status: 'True' },
    { type: 'HubAcceptedManagedCluster', reason: 'HubAcceptedManagedCluster', status: 'True' },
]
const readyManagedClusterStatus = {
    allocatable: {
        cpu: '',
        memory: '',
    },
    capacity: {
        cpu: '',
        memory: '',
    },
    version: {
        kubernetes: '1.17',
    },
    clusterClaims: [],
    conditions: readyManagedClusterConditions,
}
const mockManagedCluster3: ManagedCluster = {
    apiVersion: ManagedClusterApiVersion,
    kind: ManagedClusterKind,
    metadata: { name: 'managed-cluster-name-3-no-upgrade' },
    spec: { hubAcceptsClient: true },
    status: readyManagedClusterStatus,
}
const mockManagedCluster4: ManagedCluster = {
    apiVersion: ManagedClusterApiVersion,
    kind: ManagedClusterKind,
    metadata: { name: 'managed-cluster-name-4-upgrade-available' },
    spec: { hubAcceptsClient: true },
    status: readyManagedClusterStatus,
}
const mockManagedCluster5: ManagedCluster = {
    apiVersion: ManagedClusterApiVersion,
    kind: ManagedClusterKind,
    metadata: { name: 'managed-cluster-name-5-upgrading' },
    spec: { hubAcceptsClient: true },
    status: readyManagedClusterStatus,
}
const mockManagedCluster6: ManagedCluster = {
    apiVersion: ManagedClusterApiVersion,
    kind: ManagedClusterKind,
    metadata: { name: 'managed-cluster-name-6-upgrade-available' },
    spec: { hubAcceptsClient: true },
    status: readyManagedClusterStatus,
}
const allMockManagedClusters: ManagedCluster[] = [
    mockManagedCluster1,
    mockManagedCluster2,
    mockManagedCluster3,
    mockManagedCluster4,
    mockManagedCluster5,
    mockManagedCluster6,
]
const allUpgradeAvailableMockManagedClusters: ManagedCluster[] = [mockManagedCluster4, mockManagedCluster6]
function nockListManagedClusters(managedClusters?: ManagedCluster[]) {
    return nockList(
        { apiVersion: ManagedClusterApiVersion, kind: ManagedClusterKind },
        managedClusters ?? allMockManagedClusters
    )
}

const mockManagedClusterInfo0: ManagedClusterInfo = {
    apiVersion: ManagedClusterInfoApiVersion,
    kind: ManagedClusterInfoKind,
    metadata: { name: 'managed-cluster-name-1', namespace: 'managed-cluster-name-1' },
}
const mockManagedClusterInfo1: ManagedClusterInfo = {
    apiVersion: ManagedClusterInfoApiVersion,
    kind: ManagedClusterInfoKind,
    metadata: { name: 'managed-cluster-name-2', namespace: 'managed-cluster-name-2', labels: { cloud: 'Google' } },
}
const mockManagedClusterInfo3: ManagedClusterInfo = {
    apiVersion: ManagedClusterInfoApiVersion,
    kind: ManagedClusterInfoKind,
    metadata: { name: 'managed-cluster-name-3-no-upgrade', namespace: 'managed-cluster-name-3-no-upgrade' },
    status: {
        conditions: readyManagedClusterConditions,
        version: '1.17',
        distributionInfo: {
            type: 'ocp',
            ocp: {
                version: '1.2.3',
                availableUpdates: [],
                desiredVersion: '1.2.3',
                upgradeFailed: false,
            },
        },
    },
}

const mockManagedClusterInfo4: ManagedClusterInfo = {
    apiVersion: ManagedClusterInfoApiVersion,
    kind: ManagedClusterInfoKind,
    metadata: {
        name: 'managed-cluster-name-4-upgrade-available',
        namespace: 'managed-cluster-name-4-upgrade-available',
    },
    status: {
        conditions: readyManagedClusterConditions,
        version: '1.17',
        distributionInfo: {
            type: 'ocp',
            ocp: {
                version: '1.2.3',
                availableUpdates: ['1.2.4', '1.2.5'],
                desiredVersion: '1.2.3',
                upgradeFailed: false,
            },
        },
    },
}
const mockManagedClusterInfo5: ManagedClusterInfo = {
    apiVersion: ManagedClusterInfoApiVersion,
    kind: ManagedClusterInfoKind,
    metadata: { name: 'managed-cluster-name-5-upgrading', namespace: 'managed-cluster-name-5-upgrading' },
    status: {
        conditions: readyManagedClusterConditions,
        version: '1.17',
        distributionInfo: {
            type: 'ocp',
            ocp: {
                version: '1.2.3',
                availableUpdates: ['1.2.4', '1.2.5'],
                desiredVersion: '1.2.4',
                upgradeFailed: false,
            },
        },
    },
}
const mockManagedClusterInfo6: ManagedClusterInfo = {
    apiVersion: ManagedClusterInfoApiVersion,
    kind: ManagedClusterInfoKind,
    metadata: {
        name: 'managed-cluster-name-6-upgrade-available',
        namespace: 'anaged-cluster-name-6-upgrade-available',
    },
    status: {
        conditions: readyManagedClusterConditions,
        version: '1.17',
        distributionInfo: {
            type: 'ocp',
            ocp: {
                version: '1.2.3',
                availableUpdates: ['1.2.4', '1.2.5', '1.2.6'],
                desiredVersion: '1.2.3',
                upgradeFailed: false,
            },
        },
        nodeList: [
            {
                name: 'ip-10-0-134-240.ec2.internal',
                labels: {
                    'beta.kubernetes.io/instance-type': 'm5.xlarge',
                    'failure-domain.beta.kubernetes.io/region': 'us-west-1',
                    'failure-domain.beta.kubernetes.io/zone': 'us-east-1c',
                    'node-role.kubernetes.io/worker': '',
                    'node.kubernetes.io/instance-type': 'm5.xlarge',
                },
                conditions: [
                    {
                        status: 'True',
                        type: 'Ready',
                    },
                ],
            },
            {
                name: 'ip-10-0-130-30.ec2.internal',
                labels: {
                    'beta.kubernetes.io/instance-type': 'm5.xlarge',
                    'failure-domain.beta.kubernetes.io/region': 'us-east-1',
                    'failure-domain.beta.kubernetes.io/zone': 'us-east-1a',
                    'node-role.kubernetes.io/master': '',
                    'node.kubernetes.io/instance-type': 'm5.xlarge',
                },
                capacity: {
                    cpu: '4',
                    memory: '15944104Ki',
                },
                conditions: [
                    {
                        status: 'Unknown',
                        type: 'Ready',
                    },
                ],
            },
            {
                name: 'ip-10-0-151-254.ec2.internal',
                labels: {
                    'beta.kubernetes.io/instance-type': 'm5.xlarge',
                    'failure-domain.beta.kubernetes.io/region': 'us-south-1',
                    'failure-domain.beta.kubernetes.io/zone': 'us-east-1b',
                    'node-role.kubernetes.io/master': '',
                    'node.kubernetes.io/instance-type': 'm5.xlarge',
                },
                capacity: {
                    cpu: '4',
                    memory: '8194000Pi',
                },
                conditions: [
                    {
                        status: 'False',
                        type: 'Ready',
                    },
                ],
            },
        ],
    },
}
function nockListManagedClusterInfos(managedClusterInfos?: ManagedClusterInfo[]) {
    return nockList(
        { apiVersion: ManagedClusterInfoApiVersion, kind: ManagedClusterInfoKind },
        managedClusterInfos ?? [
            mockManagedClusterInfo0,
            mockManagedClusterInfo1,
            mockManagedClusterInfo3,
            mockManagedClusterInfo4,
            mockManagedClusterInfo5,
            mockManagedClusterInfo6,
        ],
        undefined,
        { managedNamespacesOnly: '' }
    )
}

const mockClusterDeployment: ClusterDeployment = {
    apiVersion: ClusterDeploymentApiVersion,
    kind: ClusterDeploymentKind,
    metadata: {
        name: 'managed-cluster-name-1',
        namespace: 'managed-cluster-name-1',
        labels: { 'hive.openshift.io/cluster-platform': 'aws' },
    },
}
function nockListClusterDeployments(clusterDeployments?: ClusterDeployment[]) {
    return nockList(mockClusterDeployment, clusterDeployments ?? [mockClusterDeployment], undefined, {
        managedNamespacesOnly: '',
    })
}

const mockCertifigate: CertificateSigningRequest = {
    apiVersion: CertificateSigningRequestApiVersion,
    kind: CertificateSigningRequestKind,
    metadata: { name: 'managed-cluster-name-1', namespace: 'managed-cluster-name-1' },
}
function nockListCertificateSigningRequests(certificateSigningRequest?: CertificateSigningRequest[]) {
    return nockList(
        { apiVersion: CertificateSigningRequestApiVersion, kind: CertificateSigningRequestKind },
        certificateSigningRequest ?? [mockCertifigate],
        ['open-cluster-management.io/cluster-name']
    )
}

function getPatchClusterResourceAttributes(name: string) {
    return {
        resource: 'managedclusters',
        verb: 'patch',
        group: 'cluster.open-cluster-management.io',
        name,
    } as ResourceAttributes
}
function getDeleteClusterResourceAttributes(name: string) {
    return {
        resource: 'managedclusters',
        verb: 'delete',
        group: 'cluster.open-cluster-management.io',
        name: name,
    } as ResourceAttributes
}
function getDeleteDeploymentResourceAttributes(name: string) {
    return {
        resource: 'clusterdeployments',
        verb: 'delete',
        group: 'hive.openshift.io',
        name,
        namespace: name,
    } as ResourceAttributes
}
function getDeleteMachinePoolsResourceAttributes(name: string) {
    return {
        resource: 'machinepools',
        verb: 'delete',
        group: 'hive.openshift.io',
        namespace: name,
    } as ResourceAttributes
}

function getClusterActionsResourceAttributes(name: string) {
    return {
        resource: 'managedclusteractions',
        verb: 'create',
        group: 'action.open-cluster-management.io',
        namespace: name,
    } as ResourceAttributes
}

describe('Cluster page', () => {
    beforeEach(async () => {
        const nocks = [
            nockListManagedClusterInfos(),
            nockListCertificateSigningRequests(),
            nockListClusterDeployments(),
            nockListManagedClusters(),
        ]
        const allActionPermissionNock = allUpgradeAvailableMockManagedClusters.map((mockManagedCluster) => {
            return nockAccessReview(getClusterActionsResourceAttributes(mockManagedCluster.metadata.name!), true)
        })
        render(
            <MemoryRouter>
                <ClustersPage />
            </MemoryRouter>
        )
        await waitForNocks(nocks)
        await waitForText(mockManagedCluster1.metadata.name!)
        await waitForNocks(allActionPermissionNock)
    })

    it('deletes cluster', async () => {
        const rbacNocks = [
            nockAccessReview(getPatchClusterResourceAttributes(mockManagedCluster1.metadata.name!)),
            nockAccessReview(getDeleteClusterResourceAttributes(mockManagedCluster1.metadata.name!)),
            nockAccessReview(getDeleteClusterResourceAttributes(mockManagedCluster1.metadata.name!)),
            nockAccessReview(getDeleteMachinePoolsResourceAttributes(mockManagedCluster1.metadata.name!)),
            nockAccessReview(getClusterActionsResourceAttributes(mockManagedCluster1.metadata.name!)),
            nockAccessReview(getDeleteDeploymentResourceAttributes(mockManagedCluster1.metadata.name!)),
        ]
        await clickByLabel('Actions', 0) // Click the action button on row
        await waitForNocks(rbacNocks)

        // await new Promise((resolve) => setTimeout(resolve, 100))
        await clickByText('managed.destroySelected')
        await typeByText('type.to.confirm', mockManagedCluster1.metadata!.name!)

        const deleteNocks = [nockDelete(mockManagedCluster1), nockDelete(mockClusterDeployment)]
        const refreshNocks = [
            nockListManagedClusterInfos([]),
            nockListCertificateSigningRequests([]),
            nockListClusterDeployments([]),
            nockListManagedClusters([]),
        ]
        await clickByText('destroy')
        await waitForNocks(deleteNocks)
        await waitForNocks(refreshNocks)

        await waitForNotText(mockManagedCluster1.metadata.name!)
    })

    it('bulk deletes cluster', async () => {
        await clickByRole('checkbox', 1) // select row 1
        await clickByText('managed.destroy')
        await typeByText('type.to.confirm', 'confirm')

        const deleteNocks = [nockDelete(mockManagedCluster1), nockDelete(mockClusterDeployment)]
        const refreshNocks = [
            nockListManagedClusterInfos([]),
            nockListCertificateSigningRequests([]),
            nockListClusterDeployments([]),
            nockListManagedClusters([]),
        ]
        await clickByText('destroy')
        await waitForNocks(deleteNocks)
        await waitForNocks(refreshNocks)
        await waitForNotText(mockManagedCluster1.metadata.name!)
    })

    it('detaches cluster', async () => {
        const rbacNocks = [
            nockAccessReview(getPatchClusterResourceAttributes(mockManagedCluster1.metadata.name!)),
            nockAccessReview(getDeleteClusterResourceAttributes(mockManagedCluster1.metadata.name!)),
            nockAccessReview(getDeleteClusterResourceAttributes(mockManagedCluster1.metadata.name!)),
            nockAccessReview(getDeleteMachinePoolsResourceAttributes(mockManagedCluster1.metadata.name!)),
            nockAccessReview(getClusterActionsResourceAttributes(mockManagedCluster1.metadata.name!)),
            nockAccessReview(getDeleteDeploymentResourceAttributes(mockManagedCluster1.metadata.name!)),
        ]
        await clickByLabel('Actions', 0) // Click the action button on row
        await waitForNocks(rbacNocks)
        await clickByText('managed.detached')
        await typeByText('type.to.confirm', mockManagedCluster1.metadata!.name!)

        const deleteNocks = [nockDelete(mockManagedCluster1)]
        const refreshNocks = [
            nockListManagedClusterInfos([]),
            nockListCertificateSigningRequests([]),
            nockListClusterDeployments([]),
            nockListManagedClusters([]),
        ]
        await clickByText('detach')
        await waitForNocks(deleteNocks)
        await waitForNocks(refreshNocks)

        await waitForNotText(mockManagedCluster1.metadata.name!)
    })

    it('bulk detaches cluster', async () => {
        const deleteNocks = [nockDelete(mockManagedCluster2)]
        const refreshNocks = [
            nockListManagedClusterInfos([]),
            nockListCertificateSigningRequests([]),
            nockListClusterDeployments([]),
            nockListManagedClusters([]),
        ]
        await clickByRole('checkbox', 2) // select row 2
        await clickByText('managed.detachSelected')
        await typeByText('type.to.confirm', 'confirm')
        await clickByText('detach')
        await waitForNocks(deleteNocks)
        await waitForNocks(refreshNocks)
        await waitForNotText(mockManagedCluster1.metadata.name!)
    })

    test('overflow menu should hide upgrade option if no available upgrade', async () => {
        const rbacNocks = [
            nockAccessReview(getPatchClusterResourceAttributes(mockManagedCluster3.metadata.name!)),
            nockAccessReview(getDeleteClusterResourceAttributes(mockManagedCluster3.metadata.name!)),
            nockAccessReview(getClusterActionsResourceAttributes(mockManagedCluster3.metadata.name!)),
        ]
        await waitForText(mockManagedCluster3.metadata.name!)
        await clickByLabel('Actions', 2) // Click the action button on the 3th table row
        await waitForNocks(rbacNocks)
        await waitForNotText('managed.upgrade')
        await waitForText(mockManagedCluster3.metadata.name!)
    })

    test('overflow menu should hide upgrade option if currently upgrading', async () => {
        const rbacNocks = [
            nockAccessReview(getPatchClusterResourceAttributes(mockManagedCluster5.metadata.name!)),
            nockAccessReview(getDeleteClusterResourceAttributes(mockManagedCluster5.metadata.name!)),
            nockAccessReview(getClusterActionsResourceAttributes(mockManagedCluster5.metadata.name!)),
        ]
        await waitForText(mockManagedCluster5.metadata.name!)
        await clickByLabel('Actions', 4) // Click the action button on the 5th table row
        await waitForNocks(rbacNocks)
        await waitForNotText('managed.upgrade')
        await waitForText(mockManagedCluster5.metadata.name!)
    })

    test('overflow menu should allow upgrade if has available upgrade', async () => {
        const rbacNocks = [
            nockAccessReview(getPatchClusterResourceAttributes(mockManagedCluster4.metadata.name!)),
            nockAccessReview(getDeleteClusterResourceAttributes(mockManagedCluster4.metadata.name!)),
            nockAccessReview(getClusterActionsResourceAttributes(mockManagedCluster4.metadata.name!)),
        ]
        await waitForText(mockManagedCluster4.metadata.name!)
        await clickByLabel('Actions', 3) // Click the action button on the 4th table row
        await waitForNocks(rbacNocks)
        await clickByText('managed.upgrade')
        await waitForText('upgrade.title')
        await clickByText('upgrade.cancel')
        await waitForText(mockManagedCluster4.metadata.name!)
    })

    test('batch upgrade support when upgrading single cluster', async () => {
        await waitForText(mockManagedCluster4.metadata.name!)
        await clickByLabel('Select row 3')
        await clickByText('managed.upgradeSelected')
        await waitForText(`upgrade.submit upgrade.multiple.singular`)
        await clickByText('common:cancel')
        await waitForText(mockManagedCluster4.metadata.name!)
    })

    test('batch upgrade support when upgrading multiple clusters', async () => {
        await waitForText(mockManagedCluster4.metadata.name!)
        await waitForText(mockManagedCluster6.metadata.name!)
        await clickByLabel('Select row 3')
        await clickByLabel('Select row 5')
        await clickByText('managed.upgradeSelected')
        await waitForText(`upgrade.multiple.note`)
        await waitForText(`upgrade.submit upgrade.multiple.plural`)
        await clickByText('common:cancel')
        await waitForText(mockManagedCluster4.metadata.name!)
        await waitForText(mockManagedCluster6.metadata.name!)
    })
})
