/* Copyright Contributors to the Open Cluster Management project */

import { render, waitFor } from '@testing-library/react'
import { Scope } from 'nock/types'
import React from 'react'
import { MemoryRouter, Route } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import { providerConnectionsState, discoveryConfigState } from '../../../atoms'
import { mockBadRequestStatus, nockCreate, nockDelete } from '../../../lib/nock-util'
import {
    clickByLabel,
    clickByRole,
    clickByText,
    waitForNock,
    waitForNocks,
    waitForNotText,
    waitForText,
} from '../../../lib/test-util'
import { NavigationPath } from '../../../NavigationPath'
import {
    ProviderConnection,
    ProviderConnectionApiVersion,
    ProviderConnectionKind,
} from '../../../resources/provider-connection'
import { DiscoveryConfig, DiscoveryConfigApiVersion, DiscoveryConfigKind } from '../../../resources/discovery-config'
import { ResourceAttributes, SelfSubjectAccessReview } from '../../../resources/self-subject-access-review'
import ProviderConnectionsPage from './ProviderConnections'

const mockProviderConnection1: ProviderConnection = {
    apiVersion: ProviderConnectionApiVersion,
    kind: ProviderConnectionKind,
    metadata: { name: 'provider-connection-1', namespace: 'provider-connection-namespace' },
}

const mockProviderConnection2: ProviderConnection = {
    apiVersion: ProviderConnectionApiVersion,
    kind: ProviderConnectionKind,
    metadata: { name: 'provider-connection-2', namespace: 'provider-connection-namespace' },
}

const cloudRedHatProviderConnection: ProviderConnection = {
    apiVersion: ProviderConnectionApiVersion,
    kind: ProviderConnectionKind,
    metadata: {
        name: 'ocm-api-token',
        namespace: 'ocm',
        labels: {
            'cluster.open-cluster-management.io/provider': 'crh',
        },
    },
}

const discoveryConfig: DiscoveryConfig = {
    apiVersion: DiscoveryConfigApiVersion,
    kind: DiscoveryConfigKind,
    metadata: {
        name: 'discovery',
        namespace: 'ocmm',
    },
    spec: {
        filters: {
            lastActive: 7,
            openShiftVersions: ['4.6'],
        },
        providerConnections: ['ocm-api-token'],
    },
}

const mockProviderConnections = [mockProviderConnection1, mockProviderConnection2]
let testLocation: Location

function nockCreateSelfSubjectAccesssRequest(resourceAttributes: ResourceAttributes, allowed: boolean = true) {
    return nockCreate(
        {
            apiVersion: 'authorization.k8s.io/v1',
            kind: 'SelfSubjectAccessReview',
            metadata: {},
            spec: {
                resourceAttributes,
            },
        } as SelfSubjectAccessReview,
        {
            apiVersion: 'authorization.k8s.io/v1',
            kind: 'SelfSubjectAccessReview',
            metadata: {},
            spec: {
                resourceAttributes,
            },
            status: {
                allowed,
            },
        } as SelfSubjectAccessReview
    )
}

function getPatchSecretResourceAttributes(name: string, namespace: string) {
    return {
        name,
        namespace,
        resource: 'secrets',
        verb: 'patch',
        group: '',
    } as ResourceAttributes
}

function getDeleteSecretResourceAttributes(name: string, namespace: string) {
    return {
        name,
        namespace,
        resource: 'secrets',
        verb: 'delete',
        group: '',
    } as ResourceAttributes
}

function TestProviderConnectionsPage(props: {
    providerConnections: ProviderConnection[]
    discoveryConfigs?: DiscoveryConfig[]
}) {
    return (
        <RecoilRoot
            initializeState={(snapshot) => {
                snapshot.set(providerConnectionsState, props.providerConnections)
                snapshot.set(discoveryConfigState, props.discoveryConfigs || [])
            }}
        >
            <MemoryRouter initialEntries={[NavigationPath.providerConnections]}>
                <Route
                    path={NavigationPath.providerConnections}
                    render={(props: any) => {
                        testLocation = props.location
                        return <ProviderConnectionsPage {...props} />
                    }}
                />
            </MemoryRouter>
        </RecoilRoot>
    )
}

describe('provider connections page', () => {
    test('should render the table with provider connections', async () => {
        render(<TestProviderConnectionsPage providerConnections={mockProviderConnections} />)
        await waitForText(mockProviderConnection1.metadata!.name!)
        await waitFor(() => expect(testLocation.pathname).toEqual(NavigationPath.providerConnections))
    })

    test('should goto the edit connection page', async () => {
        const rbacNocks: Scope[] = [
            nockCreateSelfSubjectAccesssRequest(
                getPatchSecretResourceAttributes('provider-connection-1', 'provider-connection-namespace')
            ),
            nockCreateSelfSubjectAccesssRequest(
                getDeleteSecretResourceAttributes('provider-connection-1', 'provider-connection-namespace')
            ),
        ]
        render(<TestProviderConnectionsPage providerConnections={mockProviderConnections} />)
        await waitForText(mockProviderConnection1.metadata!.name!)
        await clickByLabel('Actions', 0) // Click the action button on the first table row
        await waitForNocks(rbacNocks)
        await waitFor(() => expect(testLocation.pathname).toEqual(NavigationPath.providerConnections))
        await clickByText('edit')
        await waitFor(() =>
            expect(testLocation.pathname).toEqual(
                NavigationPath.editConnection
                    .replace(':namespace', mockProviderConnection1.metadata.namespace!)
                    .replace(':name', mockProviderConnection1.metadata.name!)
            )
        )
    })

    test('should be able to delete a provider connection', async () => {
        const deleteNock = nockDelete(mockProviderConnection1)
        const rbacNocks: Scope[] = [
            nockCreateSelfSubjectAccesssRequest(
                getPatchSecretResourceAttributes('provider-connection-1', 'provider-connection-namespace')
            ),
            nockCreateSelfSubjectAccesssRequest(
                getDeleteSecretResourceAttributes('provider-connection-1', 'provider-connection-namespace')
            ),
        ]
        render(<TestProviderConnectionsPage providerConnections={mockProviderConnections} />)
        await waitForText(mockProviderConnection1.metadata!.name!)
        await clickByLabel('Actions', 0) // Click the action button on the first table row
        await waitForNocks(rbacNocks)
        await clickByText('delete')
        await clickByText('common:delete')
        await waitForNock(deleteNock)
    })

    test('should show error if delete a provider connection fails', async () => {
        const rbacNocks: Scope[] = [
            nockCreateSelfSubjectAccesssRequest(
                getPatchSecretResourceAttributes('provider-connection-1', 'provider-connection-namespace')
            ),
            nockCreateSelfSubjectAccesssRequest(
                getDeleteSecretResourceAttributes('provider-connection-1', 'provider-connection-namespace')
            ),
        ]
        const badRequestStatus = nockDelete(mockProviderConnection1, mockBadRequestStatus)
        render(<TestProviderConnectionsPage providerConnections={mockProviderConnections} />)
        await waitForText(mockProviderConnection1.metadata!.name!)
        await clickByLabel('Actions', 0) // Click the action button on the first table row
        await waitForNocks(rbacNocks)
        await clickByText('delete')
        await clickByText('common:delete')
        await waitForNock(badRequestStatus)
        await waitForText(`Could not process request because of invalid data.`)
    })

    test('should be able to cancel delete a provider connection', async () => {
        const rbacNocks: Scope[] = [
            nockCreateSelfSubjectAccesssRequest(
                getPatchSecretResourceAttributes('provider-connection-1', 'provider-connection-namespace')
            ),
            nockCreateSelfSubjectAccesssRequest(
                getDeleteSecretResourceAttributes('provider-connection-1', 'provider-connection-namespace')
            ),
        ]
        render(<TestProviderConnectionsPage providerConnections={mockProviderConnections} />)
        await waitForText(mockProviderConnection1.metadata!.name!)
        await clickByLabel('Actions', 0) // Click the action button on the first table row
        await waitForNocks(rbacNocks)
        await clickByText('delete')
        await clickByText('common:cancel')
        await waitForNotText('common:cancel')
    })

    test('should be able to bulk delete provider connections', async () => {
        const deleteNock = nockDelete(mockProviderConnection1)
        render(<TestProviderConnectionsPage providerConnections={[mockProviderConnection1]} />)
        await waitForText(mockProviderConnection1.metadata!.name!)
        await clickByRole('checkbox', 1) // Select first item
        await clickByText('delete.batch')
        await clickByText('common:delete')
        await waitForNock(deleteNock)
    })

    test('should be able to cancel bulk delete provider connections', async () => {
        render(<TestProviderConnectionsPage providerConnections={[mockProviderConnection1]} />)
        await waitForText(mockProviderConnection1.metadata!.name!)
        await clickByRole('checkbox', 1) // Select all
        await clickByText('delete.batch')
        await clickByText('common:cancel')
        await waitForNotText('common:cancel')
    })

    test('If cloud.redhat.com providerconnection and no discoveryconfig configured, show action available', async () => {
        render(<TestProviderConnectionsPage providerConnections={[cloudRedHatProviderConnection]} />)
        await waitForText(cloudRedHatProviderConnection.metadata!.name!)
        await waitForText('connections.actions.enableClusterDiscovery')
    })

    test('If cloud.redhat.com providerconnection and discoveryconfig configured, do not show action available', async () => {
        render(
            <TestProviderConnectionsPage
                providerConnections={[cloudRedHatProviderConnection]}
                discoveryConfigs={[discoveryConfig]}
            />
        )
        await waitForText(cloudRedHatProviderConnection.metadata!.name!)
        await !waitForText('connections.actions.enableClusterDiscovery')
    })
})
