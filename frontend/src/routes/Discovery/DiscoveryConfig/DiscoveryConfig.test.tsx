/* Copyright Contributors to the Open Cluster Management project */

import { Provider } from '@open-cluster-management/ui-components'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import { discoveryConfigState, secretsState } from '../../../atoms'
import { nockCreate, nockDelete, nockGet, nockReplace } from '../../../lib/nock-util'
import { clickByText, waitForNocks, waitForText } from '../../../lib/test-util'
import { NavigationPath } from '../../../NavigationPath'
import { DiscoveryConfig, DiscoveryConfigApiVersion, DiscoveryConfigKind } from '../../../resources/discovery-config'
import { FeatureGate } from '../../../resources/feature-gate'
import { Secret, SecretKind, SecretApiVersion } from '../../../resources/secret'
import DiscoveryConfigPage from './DiscoveryConfig'

const mockFeatureGate: FeatureGate = {
    apiVersion: 'config.openshift.io/v1',
    kind: 'FeatureGate',
    metadata: { name: 'open-cluster-management-discovery' },
    spec: { featureSet: 'DiscoveryEnabled' },
}

const credential: Secret = {
    apiVersion: SecretApiVersion,
    kind: SecretKind,
    metadata: {
        name: 'connection',
        namespace: 'discovery',
        labels: {
            'cluster.open-cluster-management.io/provider': Provider.redhatcloud,
            'cluster.open-cluster-management.io/cloudconnection': '',
        },
    },
    type: 'Opaque',
}

// const mockCredential = [packProviderConnection({ ...credential })]

const discoveryConfig: DiscoveryConfig = {
    apiVersion: DiscoveryConfigApiVersion,
    kind: DiscoveryConfigKind,
    metadata: {
        name: 'discovery',
        namespace: credential.metadata.namespace!,
    },
    spec: {
        filters: {
            lastActive: 14,
            openShiftVersions: ['4.7'],
        },
        credential: credential.metadata.name!,
    },
}

const discoveryConfigUpdated: DiscoveryConfig = {
    apiVersion: DiscoveryConfigApiVersion,
    kind: DiscoveryConfigKind,
    metadata: {
        name: 'discovery',
        namespace: 'discovery',
    },
    spec: {
        filters: {
            lastActive: 30,
            openShiftVersions: ['4.7', '4.8'],
        },
        credential: credential.metadata.name!,
    },
}

function TestAddDiscoveryConfigPage() {
    return (
        <RecoilRoot
            initializeState={(snapshot) => {
                snapshot.set(discoveryConfigState, [])
                snapshot.set(secretsState, [credential])
            }}
        >
            <MemoryRouter>
                <Route
                    render={(props: any) => {
                        return <DiscoveryConfigPage {...props} />
                    }}
                />
            </MemoryRouter>
        </RecoilRoot>
    )
}

function TestEditConnectionPage() {
    return (
        <RecoilRoot
            initializeState={(snapshot) => {
                snapshot.set(discoveryConfigState, [discoveryConfig])
            }}
        >
            <MemoryRouter initialEntries={[NavigationPath.configureDiscovery]}>
                <Route
                    path={NavigationPath.configureDiscovery}
                    render={(props: any) => {
                        return <DiscoveryConfigPage {...props} />
                    }}
                />
            </MemoryRouter>
        </RecoilRoot>
    )
}

beforeEach(() => {
    sessionStorage.clear()
    nockGet(mockFeatureGate, undefined, 200, true)
})

describe('discovery config page', () => {
    it('Create DiscoveryConfig', async () => {
        const { container } = render(<TestAddDiscoveryConfigPage />)

        // Select LastActive
        await waitFor(() =>
            expect(container.querySelectorAll(`[aria-labelledby^="lastActiveFilter-label"]`)).toHaveLength(1)
        )
        container.querySelector<HTMLButtonElement>(`[aria-labelledby^="lastActiveFilter-label"]`)!.click()
        await clickByText('14 days')

        // Select Version
        expect(container.querySelectorAll(`[aria-labelledby^="discoveryVersions-label"]`)).toHaveLength(1)
        container.querySelector<HTMLButtonElement>(`[aria-labelledby^="discoveryVersions-label"]`)!.click()
        await clickByText('4.7')

        // Select Credential
        expect(container.querySelectorAll(`[aria-labelledby^="credentials-label"]`)).toHaveLength(1)
        container.querySelector<HTMLButtonElement>(`[aria-labelledby^="credentials-label"]`)!.click()
        await clickByText(credential.metadata.namespace! + '/' + credential.metadata.name!)

        // Submit form
        const createDiscoveryConfigNock = nockCreate(discoveryConfig, discoveryConfig)
        await clickByText('discoveryConfig.add')
        await waitFor(() => expect(createDiscoveryConfigNock.isDone()).toBeTruthy())
    })

    it('Edit DiscoveryConfig', async () => {
        const nocks = [nockGet(discoveryConfig, discoveryConfig)]

        const { container } = render(<TestEditConnectionPage />)
        await waitForNocks(nocks)

        // Select Namespace
        await waitFor(() => expect(container.querySelectorAll(`[aria-labelledby^="namespaces-label"]`)).toHaveLength(1))
        container.querySelector<HTMLButtonElement>(`[aria-labelledby^="namespaces-label"]`)!.click()
        await clickByText(discoveryConfig.metadata.namespace!)

        // Ensure Form is prepopulated
        await waitForText(discoveryConfig.spec.filters?.lastActive! + ' days')
        await waitForText(discoveryConfig.spec.filters?.openShiftVersions![0]!)
        await waitForText(credential.metadata.namespace + '/' + credential.metadata.name!)

        // Change form
        container.querySelector<HTMLButtonElement>(`[aria-labelledby^="lastActiveFilter-label"]`)!.click()
        await clickByText('30 days')

        container.querySelector<HTMLButtonElement>(`[aria-labelledby^="discoveryVersions-label"]`)!.click()
        await clickByText('4.8')

        const replaceNock = nockReplace(discoveryConfigUpdated)
        await clickByText('discoveryConfig.edit')
        await waitFor(() => expect(replaceNock.isDone()).toBeTruthy())
    })

    it('Delete DiscoveryConfig', async () => {
        const nocks = [nockGet(discoveryConfig, discoveryConfig)]

        const { container } = render(<TestEditConnectionPage />)
        await waitForNocks(nocks)

        // Select Namespace
        await waitFor(() => expect(container.querySelectorAll(`[aria-labelledby^="namespaces-label"]`)).toHaveLength(1))
        container.querySelector<HTMLButtonElement>(`[aria-labelledby^="namespaces-label"]`)!.click()
        await clickByText(discoveryConfig.metadata.namespace!)

        // Ensure Form is prepopulated
        await waitForText(discoveryConfig.spec.filters?.lastActive! + ' days')
        await waitForText(discoveryConfig.spec.filters?.openShiftVersions![0]!)
        await waitForText(credential.metadata.namespace + '/' + credential.metadata.name!)

        const deleteNock = nockDelete(discoveryConfigUpdated)
        await clickByText('discoveryConfig.delete')
        await waitForText('disable.title')
        await clickByText('discoveryConfig.delete.btn')
        await waitFor(() => expect(deleteNock.isDone()).toBeTruthy())
    })
})
