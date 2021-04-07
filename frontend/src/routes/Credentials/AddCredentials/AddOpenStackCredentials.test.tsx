/* Copyright Contributors to the Open Cluster Management project */

import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import { nockIgnoreRBAC, nockCreate } from '../../../lib/nock-util'
import { getProviderByKey, ProviderID } from '../../../lib/providers'
import { NavigationPath } from '../../../NavigationPath'
import {
    packProviderConnection,
    ProviderConnection,
    ProviderConnectionApiVersion,
    ProviderConnectionKind,
} from '../../../resources/provider-connection'
import AddCredentialPage from './AddCredentials'
import { Namespace, NamespaceApiVersion, NamespaceKind } from '../../../resources/namespace'
import { namespacesState, multiClusterHubState } from '../../../atoms'
import { multiClusterHub } from '../../../lib/test-metadata'

const mockNamespace: Namespace = {
    apiVersion: NamespaceApiVersion,
    kind: NamespaceKind,
    metadata: { name: 'test-namespace' },
}

function EmptyPage() {
    return <div></div>
}

let location: Location
function TestAddConnectionPage() {
    return (
        <RecoilRoot
            initializeState={(snapshot) => {
                snapshot.set(namespacesState, [mockNamespace])
                snapshot.set(multiClusterHubState, [multiClusterHub])
            }}
        >
            <MemoryRouter initialEntries={[NavigationPath.addCredentials]}>
                <Route
                    path={NavigationPath.addCredentials}
                    render={(props: any) => {
                        location = props.location
                        return <AddCredentialPage {...props} />
                    }}
                />
                <Route
                    path={NavigationPath.credentials}
                    render={(props: any) => {
                        location = props.location
                        return <EmptyPage />
                    }}
                />
            </MemoryRouter>
        </RecoilRoot>
    )
}

describe('add connection page', () => {
    beforeEach(() => {
        nockIgnoreRBAC()
    })
    it('should create openstack provider connection', async () => {
        const providerConnection: ProviderConnection = {
            apiVersion: ProviderConnectionApiVersion,
            kind: ProviderConnectionKind,
            metadata: {
                name: 'connection',
                namespace: mockNamespace.metadata.name,
                labels: {
                    'cluster.open-cluster-management.io/provider': ProviderID.OST,
                    'cluster.open-cluster-management.io/cloudconnection': '',
                },
            },
            spec: {
                openstackCloudsYaml: 'clouds:\n\topenstack:\n\t\tauth:\n\t\t\tauth_url: http://localhost:5000\n\t\t\tusername: "admin"\n\t\t\tpassword: fake\n\t\t\tproject_id: 123456789',
                openstackCloud: 'openstack',
                baseDomain: 'base.domain',
                pullSecret: '{"pullSecret":"secret"}',
                sshPrivatekey: '-----BEGIN OPENSSH PRIVATE KEY-----\nkey\n-----END OPENSSH PRIVATE KEY-----',
                sshPublickey: 'ssh-rsa AAAAB1 fake@email.com',

            },
        }

        const createNock = nockCreate(packProviderConnection({ ...providerConnection }))
        const { getByText, getByTestId, container } = render(<TestAddConnectionPage />)
        await waitFor(() =>
            expect(container.querySelectorAll(`[aria-labelledby^="providerName-label"]`)).toHaveLength(1)
        )
        container.querySelector<HTMLButtonElement>(`[aria-labelledby^="providerName-label"]`)!.click()
        await waitFor(() => expect(getByText(getProviderByKey(ProviderID.VMW).name)).toBeInTheDocument())
        getByText(getProviderByKey(ProviderID.VMW).name).click()
        userEvent.type(getByTestId('connectionName'), providerConnection.metadata.name!)
        await waitFor(() =>
            expect(container.querySelectorAll(`[aria-labelledby^="namespaceName-label"]`)).toHaveLength(1)
        )
        container.querySelector<HTMLButtonElement>(`[aria-labelledby^="namespaceName-label"]`)!.click()
        await waitFor(() => expect(getByText(providerConnection.metadata.namespace!)).toBeInTheDocument())
        getByText(providerConnection.metadata.namespace!).click()
        userEvent.type(
            getByTestId('baseDomainResourceGroupName'),
            providerConnection.spec!.baseDomainResourceGroupName!
        )

        userEvent.type(getByTestId('openstackCloudsYaml'), providerConnection.spec!.openstackCloudsYaml!)
        userEvent.type(getByTestId('openstackCloud'), providerConnection.spec!.openstackCloud!)

        userEvent.type(getByTestId('baseDomain'), providerConnection.spec!.baseDomain!)
        userEvent.type(getByTestId('pullSecret'), providerConnection.spec!.pullSecret!)
        userEvent.type(getByTestId('sshPrivateKey'), providerConnection.spec!.sshPrivatekey!)
        userEvent.type(getByTestId('sshPublicKey'), providerConnection.spec!.sshPublickey!)
        getByText('addConnection.addButton.label').click()
        await waitFor(() => expect(createNock.isDone()).toBeTruthy())
        await waitFor(() => expect(location.pathname).toBe(NavigationPath.credentials))
    })
})