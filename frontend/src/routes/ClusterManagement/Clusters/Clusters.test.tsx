import { Matcher, render, SelectorMatcherOptions, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { nockDelete, nockList } from '../../../lib/nock-util'
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
import ClustersPage from './Clusters'

const mockManagedCluster1: ManagedCluster = {
    apiVersion: ManagedClusterApiVersion,
    kind: ManagedClusterKind,
    metadata: { name: 'managed-cluster-name' },
    spec: { hubAcceptsClient: true },
}
const mockManagedCluster2: ManagedCluster = {
    apiVersion: ManagedClusterApiVersion,
    kind: ManagedClusterKind,
    metadata: { name: 'managed-cluster-name' },
    spec: { hubAcceptsClient: true },
}
function nockListManagedClusters(managedClusters?: ManagedCluster[]) {
    return nockList(
        { apiVersion: ManagedClusterApiVersion, kind: ManagedClusterKind },
        managedClusters ?? [mockManagedCluster1, mockManagedCluster2]
    )
}

const mockManagedClusterInfo: ManagedClusterInfo = {
    apiVersion: ManagedClusterInfoApiVersion,
    kind: ManagedClusterInfoKind,
    metadata: { name: 'managed-cluster-name', namespace: 'managed-cluster-name' },
}
function nockListManagedClusterInfos(managedClusterInfos?: ManagedClusterInfo[]) {
    return nockList(
        { apiVersion: ManagedClusterInfoApiVersion, kind: ManagedClusterInfoKind },
        managedClusterInfos ?? [mockManagedClusterInfo],
        undefined,
        { managedNamespacesOnly: '' }
    )
}

const mockClusterDeployment: ClusterDeployment = {
    apiVersion: ClusterDeploymentApiVersion,
    kind: ClusterDeploymentKind,
    metadata: { name: 'managed-cluster-name', namespace: 'managed-cluster-name' },
}
function nockListClusterDeployments(clusterDeployments?: ClusterDeployment[]) {
    return nockList(mockClusterDeployment, clusterDeployments ?? [mockClusterDeployment], undefined, {
        managedNamespacesOnly: '',
    })
}

const mockCertifigate: CertificateSigningRequest = {
    apiVersion: CertificateSigningRequestApiVersion,
    kind: CertificateSigningRequestKind,
    metadata: { name: 'managed-cluster-name', namespace: 'managed-cluster-name' },
}
function nockListCertificateSigningRequests(certificateSigningRequest?: CertificateSigningRequest[]) {
    return nockList(
        { apiVersion: CertificateSigningRequestApiVersion, kind: CertificateSigningRequestKind },
        certificateSigningRequest ?? [mockCertifigate],
        ['open-cluster-management.io/cluster-name']
    )
}

let getByText: (id: Matcher, options?: SelectorMatcherOptions) => HTMLElement
let queryByText: (id: Matcher, options?: SelectorMatcherOptions) => HTMLElement | null
let getAllByLabelText: (id: Matcher, options?: SelectorMatcherOptions) => HTMLElement[]

describe('Cluster page', () => {
    beforeEach(async () => {
        const listManagedClusterInfosNock = nockListManagedClusterInfos()
        const listCertificateSigningRequestsNock = nockListCertificateSigningRequests()
        const listClusterDeploymentsNock = nockListClusterDeployments()
        const listManagedClustersNock = nockListManagedClusters()
        const renderResult = render(
            <MemoryRouter>
                <ClustersPage />
            </MemoryRouter>
        )
        getByText = renderResult.getByText
        queryByText = renderResult.queryByText
        getAllByLabelText = renderResult.getAllByLabelText
        await waitFor(() => expect(listClusterDeploymentsNock.isDone()).toBeTruthy())
        await waitFor(() => expect(listManagedClusterInfosNock.isDone()).toBeTruthy())
        await waitFor(() => expect(listCertificateSigningRequestsNock.isDone()).toBeTruthy())
        await waitFor(() => expect(listManagedClustersNock.isDone()).toBeTruthy())
        await waitFor(() => expect(getByText(mockManagedCluster1.metadata.name!)).toBeInTheDocument())
    })

    it('deletes cluster', async () => {
        const deleteManagedClusterNock = nockDelete(mockManagedCluster1)
        const deleteClusterDeploymentNock = nockDelete(mockClusterDeployment)
        const listManagedClusterInfosNock = nockListManagedClusterInfos([])
        const listCertificateSigningRequestsNock = nockListCertificateSigningRequests([])
        const listClusterDeploymentsNock = nockListClusterDeployments([])
        const listManagedClustersNock = nockListManagedClusters([])
        userEvent.click(getAllByLabelText('Actions')[0]) // Click the action button on the first table row
        userEvent.click(getByText('managed.destroySelected')) // click the delete action
        userEvent.click(getByText('Confirm')) // click confirm on the delete dialog
        await waitFor(() => expect(deleteManagedClusterNock.isDone()).toBeTruthy())
        await waitFor(() => expect(deleteClusterDeploymentNock.isDone()).toBeTruthy())
        await waitFor(() => expect(listManagedClusterInfosNock.isDone()).toBeTruthy())
        await waitFor(() => expect(listCertificateSigningRequestsNock.isDone()).toBeTruthy())
        await waitFor(() => expect(listClusterDeploymentsNock.isDone()).toBeTruthy())
        await waitFor(() => expect(listManagedClustersNock.isDone()).toBeTruthy())
        await waitFor(() => expect(queryByText(mockManagedCluster1.metadata.name!)).toBeNull())
    })

    it('bulk deletes cluster', async () => {
        const deleteManagedClusterNock = nockDelete(mockManagedCluster1)
        const deleteClusterDeploymentNock = nockDelete(mockClusterDeployment)
        const listManagedClusterInfosNock = nockListManagedClusterInfos([])
        const listCertificateSigningRequestsNock = nockListCertificateSigningRequests([])
        const listClusterDeploymentsNock = nockListClusterDeployments([])
        const listManagedClustersNock = nockListManagedClusters([])
        userEvent.click(getAllByLabelText('Select row 0')[0]) // select row 0
        userEvent.click(getByText('managed.destroy')) // click the bulk destroy button
        userEvent.click(getByText('Confirm')) // click confirm on the delete dialog
        await waitFor(() => expect(deleteManagedClusterNock.isDone()).toBeTruthy())
        await waitFor(() => expect(deleteClusterDeploymentNock.isDone()).toBeTruthy())
        await waitFor(() => expect(listManagedClusterInfosNock.isDone()).toBeTruthy())
        await waitFor(() => expect(listCertificateSigningRequestsNock.isDone()).toBeTruthy())
        await waitFor(() => expect(listClusterDeploymentsNock.isDone()).toBeTruthy())
        await waitFor(() => expect(listManagedClustersNock.isDone()).toBeTruthy())
        await waitFor(() => expect(queryByText(mockManagedCluster1.metadata.name!)).toBeNull())
    })

    it('detaches cluster', async () => {
        const deleteManagedClusterNock = nockDelete(mockManagedCluster1)
        const deleteClusterDeploymentNock = nockDelete(mockClusterDeployment)
        const listManagedClusterInfosNock = nockListManagedClusterInfos([])
        const listCertificateSigningRequestsNock = nockListCertificateSigningRequests([])
        const listClusterDeploymentsNock = nockListClusterDeployments([])
        const listManagedClustersNock = nockListManagedClusters([])
        userEvent.click(getAllByLabelText('Actions')[1]) // Click the action button on row
        userEvent.click(getByText('managed.detached')) // click the delete action
        userEvent.click(getByText('Confirm')) // click confirm on the delete dialog
        await waitFor(() => expect(deleteManagedClusterNock.isDone()).toBeTruthy())
        await waitFor(() => expect(deleteClusterDeploymentNock.isDone()).toBeTruthy())
        await waitFor(() => expect(listManagedClusterInfosNock.isDone()).toBeTruthy())
        await waitFor(() => expect(listCertificateSigningRequestsNock.isDone()).toBeTruthy())
        await waitFor(() => expect(listClusterDeploymentsNock.isDone()).toBeTruthy())
        await waitFor(() => expect(listManagedClustersNock.isDone()).toBeTruthy())
        await waitFor(() => expect(queryByText(mockManagedCluster1.metadata.name!)).toBeNull())
    })

    it('bulk detaches cluster', async () => {
        const deleteManagedClusterNock = nockDelete(mockManagedCluster1)
        const deleteClusterDeploymentNock = nockDelete(mockClusterDeployment)
        const listManagedClusterInfosNock = nockListManagedClusterInfos([])
        const listCertificateSigningRequestsNock = nockListCertificateSigningRequests([])
        const listClusterDeploymentsNock = nockListClusterDeployments([])
        const listManagedClustersNock = nockListManagedClusters([])
        userEvent.click(getAllByLabelText('Select row 1')[1]) // select row 1
        userEvent.click(getByText('managed.detachSelected')) // click the bulk destroy button
        userEvent.click(getByText('Confirm')) // click confirm on the delete dialog
        await waitFor(() => expect(deleteManagedClusterNock.isDone()).toBeTruthy())
        await waitFor(() => expect(deleteClusterDeploymentNock.isDone()).toBeTruthy())
        await waitFor(() => expect(listManagedClusterInfosNock.isDone()).toBeTruthy())
        await waitFor(() => expect(listCertificateSigningRequestsNock.isDone()).toBeTruthy())
        await waitFor(() => expect(listClusterDeploymentsNock.isDone()).toBeTruthy())
        await waitFor(() => expect(listManagedClustersNock.isDone()).toBeTruthy())
        await waitFor(() => expect(queryByText(mockManagedCluster1.metadata.name!)).toBeNull())
    })
})
