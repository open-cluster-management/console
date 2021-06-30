/* Copyright Contributors to the Open Cluster Management project */

import { fireEvent, render } from '@testing-library/react'
import { Scope } from 'nock/types'
import { MemoryRouter } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import { bareMetalAssetsState } from '../../../atoms'
import { nockCreate, nockDelete, nockRBAC } from '../../../lib/nock-util'
import {
    clickBulkAction,
    clickByLabel,
    clickByText,
    selectTableRow,
    waitForNock,
    waitForNocks,
    waitForText,
} from '../../../lib/test-util'
import { BareMetalAsset, BareMetalAssetApiVersion, BareMetalAssetKind } from '../../../resources/bare-metal-asset'
import {
    Project,
    ProjectApiVersion,
    ProjectKind,
    ProjectRequest,
    ProjectRequestApiVersion,
    ProjectRequestKind,
} from '../../../resources/project'
import { Secret, SecretApiVersion, SecretKind } from '../../../resources/secret'
import { ResourceAttributes } from '../../../resources/self-subject-access-review'
import BareMetalAssetsPage from './BareMetalAssetsPage'

const bareMetalAsset: BareMetalAsset = {
    apiVersion: 'inventory.open-cluster-management.io/v1alpha1',
    kind: 'BareMetalAsset',
    metadata: { name: 'test-bare-metal-asset-001', namespace: 'test-bare-metal-asset-namespace' },
    spec: {
        bmc: { address: 'example.com:80', credentialsName: 'secret-test-bare-metal-asset' },
        bootMACAddress: '00:90:7F:12:DE:7F',
    },
    status: {
        conditions: [
            {
                lastTransitionTime: new Date('2021-05-14T15:11:35Z'),
                message: 'A secret with the name fog13.cluster.internal-bmc-secret in namespace slot-04 was found',
                reason: 'SecretFound',
                status: 'True',
                type: 'CredentialsFound',
            },
            {
                lastTransitionTime: new Date('2021-05-14T15:11:35Z'),
                message: 'A ClusterDeployment with the name slot-04 in namespace slot-04 was found',
                reason: 'ClusterDeploymentFound',
                status: 'True',
                type: 'ClusterDeploymentFound',
            },
            {
                lastTransitionTime: new Date('2021-05-14T16:16:04Z'),
                message: 'Successfully applied SyncSet',
                reason: 'SyncSetAppliedSuccessful',
                status: 'True',
                type: 'AssetSyncCompleted',
            },
            {
                lastTransitionTime: new Date('2021-05-14T16:16:04Z'),
                message: 'SyncSet updated successfully',
                reason: 'SyncSetUpdated',
                status: 'True',
                type: 'AssetSyncStarted',
            },
        ],
    },
}

const mockBmaProject: ProjectRequest = {
    apiVersion: ProjectRequestApiVersion,
    kind: ProjectRequestKind,
    metadata: { name: 'test-namespace' },
}

const mockBmaProjectResponse: Project = {
    apiVersion: ProjectApiVersion,
    kind: ProjectKind,
    metadata: { name: 'test-namespace' },
}

const createBareMetalAsset: BareMetalAsset = {
    kind: BareMetalAssetKind,
    apiVersion: BareMetalAssetApiVersion,
    metadata: { name: 'test-bma', namespace: 'test-namespace' },
    spec: {
        bmc: { address: 'example.com:80', credentialsName: 'test-bma-bmc-secret' },
        bootMACAddress: '00:90:7F:12:DE:7F',
    },
}

const createBmaSecret: Secret = {
    kind: SecretKind,
    apiVersion: SecretApiVersion,
    metadata: { name: 'test-bma-bmc-secret', namespace: 'test-namespace' },
    stringData: { password: 'test', username: 'test' },
}

const bmaSecret: Secret = {
    kind: SecretKind,
    apiVersion: SecretApiVersion,
    metadata: { namespace: 'test-namespace', name: 'test-bma-bmc-secret' },
    data: { password: 'encoded', username: 'encoded' },
}

function clusterCreationResourceAttributes() {
    return {
        resource: 'managedclusters',
        verb: 'create',
        group: 'cluster.open-cluster-management.io',
    } as ResourceAttributes
}

const mockBareMetalAssets = [bareMetalAsset]

function getEditBMAResourceAttributes(name: string, namespace: string) {
    return {
        name,
        namespace,
        group: 'inventory.open-cluster-management.io',
        resource: 'baremetalassets',
        verb: 'patch',
    } as ResourceAttributes
}

function getDeleteBMAResourceAttributes(name: string, namespace: string) {
    return {
        name,
        namespace,
        group: 'inventory.open-cluster-management.io',
        resource: 'baremetalassets',
        verb: 'delete',
    } as ResourceAttributes
}

describe('bare metal asset page', () => {
    test('bare metal assets page renders', async () => {
        const clusterNock = nockRBAC(clusterCreationResourceAttributes())
        render(
            <RecoilRoot initializeState={(snapshot) => snapshot.set(bareMetalAssetsState, mockBareMetalAssets)}>
                <MemoryRouter>
                    <BareMetalAssetsPage />
                </MemoryRouter>
            </RecoilRoot>
        )
        await waitForNock(clusterNock)
        await waitForText(mockBareMetalAssets[0].metadata.name!)
    })

    test('can delete asset from overflow menu', async () => {
        const deleteNock = nockDelete(mockBareMetalAssets[0])
        const clusterNock = nockRBAC(clusterCreationResourceAttributes())
        const rbacNocks: Scope[] = [
            nockRBAC(getEditBMAResourceAttributes('test-bare-metal-asset-001', 'test-bare-metal-asset-namespace')),
            nockRBAC(getDeleteBMAResourceAttributes('test-bare-metal-asset-001', 'test-bare-metal-asset-namespace')),
        ]
        render(
            <RecoilRoot initializeState={(snapshot) => snapshot.set(bareMetalAssetsState, mockBareMetalAssets)}>
                <MemoryRouter>
                    <BareMetalAssetsPage />
                </MemoryRouter>
            </RecoilRoot>
        )
        await waitForNock(clusterNock)
        await waitForText(mockBareMetalAssets[0].metadata!.name!)
        await clickByLabel('Actions', 0) // Click the action button on the first table row
        await waitForNocks(rbacNocks)
        await clickByText('bareMetalAsset.rowAction.deleteAsset.title')
        await clickByText('common:delete')
        await waitForNock(deleteNock)
    })

    test('can delete assets from batch action menu', async () => {
        const clusterNock = nockRBAC(clusterCreationResourceAttributes())
        const deleteNock = nockDelete(mockBareMetalAssets[0])
        render(
            <RecoilRoot initializeState={(snapshot) => snapshot.set(bareMetalAssetsState, mockBareMetalAssets)}>
                <MemoryRouter>
                    <BareMetalAssetsPage />
                </MemoryRouter>
            </RecoilRoot>
        )
        await waitForNock(clusterNock)
        await waitForText(mockBareMetalAssets[0].metadata!.name!)
        await selectTableRow(1)
        await clickBulkAction('bareMetalAsset.bulkAction.deleteAsset')
        await clickByText('common:delete')
        await waitForNock(deleteNock)
    })

    test('can import assets from csv', async () => {
        const clusterNock = nockRBAC(clusterCreationResourceAttributes())
        const projectCreateNock = nockCreate(mockBmaProject, mockBmaProjectResponse)
        const secretCreateNock = nockCreate(createBmaSecret, bmaSecret)
        const bmaCreateNock = nockCreate(createBareMetalAsset)
        const rows = [
            'hostName,hostNamespace,bmcAddress,macAddress,username,password',
            'test-bma,test-namespace,example.com:80,00:90:7F:12:DE:7F,test,test',
        ]
        const file = new File([rows.join('\n')], 'some.csv')

        const { getByTestId } = render(
            <RecoilRoot initializeState={(snapshot) => snapshot.set(bareMetalAssetsState, mockBareMetalAssets)}>
                <MemoryRouter>
                    <BareMetalAssetsPage />
                </MemoryRouter>
            </RecoilRoot>
        )

        // wait for list to fill in with one dummy bma
        await waitForNock(clusterNock)

        // click the Import button
        await clickByText('bareMetalAsset.bulkAction.importAssets')

        // click the "Open file" button
        await clickByText('bareMetalAsset.importAction.button')

        // "click" the file input button
        const fileInput = getByTestId('importBMAs')
        Object.defineProperty(fileInput, 'files', { value: [file] })
        fireEvent.change(fileInput)

        // click the Import button on the dialog
        await clickByText('common:import')

        // wait for bma to be created
        await waitForNock(projectCreateNock)
        await waitForNock(secretCreateNock)
        await waitForNock(bmaCreateNock)
    })

    test('renders bare metal assets page with correct asset status', async () => {
        const clusterNock = nockRBAC(clusterCreationResourceAttributes())
        render(
            <RecoilRoot initializeState={(snapshot) => snapshot.set(bareMetalAssetsState, mockBareMetalAssets)}>
                <MemoryRouter>
                    <BareMetalAssetsPage />
                </MemoryRouter>
            </RecoilRoot>
        )
        await waitForNock(clusterNock)
        await waitForText(mockBareMetalAssets[0].metadata.name!)
        await waitForText('bareMetalAsset.statusMessage.SyncSetUpdated')
    })
})
