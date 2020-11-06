import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { nockDelete, nockList } from '../../../lib/nock-util'
import { ProviderConnection, providerConnectionMethods } from '../../../lib/ProviderConnection'
import { ProviderConnectionsPage } from './ProviderConnections'

const mockProviderConnection: ProviderConnection = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: { name: 'provider-connection-name', namespace: 'provider-connection-namespace' },
}

const mockProviderConnections = [mockProviderConnection]

describe('provider connections page', () => {
    test('should render the table with provider connections', async () => {
        nockList(providerConnectionMethods, mockProviderConnections, [
            'cluster.open-cluster-management.io/cloudconnection=',
        ])
        const { getByText } = render(
            <MemoryRouter>
                <ProviderConnectionsPage />
            </MemoryRouter>
        )
        await waitFor(() => expect(getByText(mockProviderConnection.metadata!.name!)).toBeInTheDocument())
        expect(getByText(mockProviderConnection.metadata!.namespace!)).toBeInTheDocument()
    })

    test('should be able to delete a provider connection', async () => {
        const listNock = nockList(providerConnectionMethods, mockProviderConnections, [
            'cluster.open-cluster-management.io/cloudconnection=',
        ])
        const deleteNock = nockDelete(providerConnectionMethods, mockProviderConnection)
        const refreshNock = nockList(providerConnectionMethods, mockProviderConnections, [
            'cluster.open-cluster-management.io/cloudconnection=',
        ])
        const { getByText, getAllByLabelText } = render(
            <MemoryRouter>
                <ProviderConnectionsPage />
            </MemoryRouter>
        )
        await waitFor(() => expect(listNock.isDone()).toBeTruthy()) // expect the list api call
        await waitFor(() => expect(getByText(mockProviderConnection.metadata!.name!)).toBeInTheDocument())
        userEvent.click(getAllByLabelText('Actions')[0]) // Click the action button on the first table row
        userEvent.click(getByText('delete')) // click the delete action
        userEvent.click(getByText('Confirm')) // click confirm on the delete dialog
        await waitFor(() => expect(deleteNock.isDone()).toBeTruthy()) // expect the delete api call
        await waitFor(() => expect(refreshNock.isDone()).toBeTruthy()) // expect the refresh api call
    })
})
