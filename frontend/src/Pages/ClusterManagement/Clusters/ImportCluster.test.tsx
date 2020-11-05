import React from 'react'
import { Route, MemoryRouter } from 'react-router-dom'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImportClusterPage } from './ImportCluster'
import { Project, ProjectRequest, projectRequestMethods } from '../../../lib/Project'
import { ManagedCluster, managedClusterMethods } from '../../../lib/ManagedCluster'
import { KlusterletAddonConfig, klusterletAddonConfigMethodss } from '../../../lib/KlusterletAddonConfig'
import { nockCreate } from '../../../lib/nock-util'
import * as nock from 'nock'

const mockProject: ProjectRequest = { metadata: { name: 'foobar' } }
const mockManagedCluster: ManagedCluster = {
    apiVersion: 'cluster.open-cluster-management.io/v1',
    kind: 'ManagedCluster',
    metadata: {
        name: 'foobar',
        labels: { cloud: 'auto-detect', vendor: 'auto-detect', name: 'foobar', environment: '' },
    },
    spec: { hubAcceptsClient: true },
}
const mockKAC: KlusterletAddonConfig = {
    apiVersion: 'agent.open-cluster-management.io/v1',
    kind: 'KlusterletAddonConfig',
    metadata: { name: 'foobar', namespace: 'foobar' },
    spec: {
        clusterName: 'foobar',
        clusterNamespace: 'foobar',
        clusterLabels: { cloud: 'auto-detect', vendor: 'auto-detect', name: 'foobar', environment: '' },
        applicationManager: { enabled: true },
        policyController: { enabled: true },
        searchCollector: { enabled: true },
        certPolicyController: { enabled: true },
        iamPolicyController: { enabled: true },
        version: '2.1.0',
    },
}

const mockProjectResponse: Project = {
    kind: 'Project',
    apiVersion: 'project.openshift.io/v1',
    metadata: {
        name: 'foobar',
        selfLink: '/apis/project.openshift.io/v1/projectrequests/foobar',
        uid: 'f628792b-79d2-4c41-a07a-c7f1afac5e8a',
        resourceVersion: '16251055',
        annotations: {
            'openshift.io/description': '',
            'openshift.io/display-name': '',
            'openshift.io/requester': 'kube:admin',
            'openshift.io/sa.scc.mcs': 's0:c25,c15',
            'openshift.io/sa.scc.supplemental-groups': '1000630000/10000',
            'openshift.io/sa.scc.uid-range': '1000630000/10000',
        },
    },
}
const mockManagedClusterResponse: ManagedCluster = {
    apiVersion: 'cluster.open-cluster-management.io/v1',
    kind: 'ManagedCluster',
    metadata: {
        labels: { cloud: 'auto-detect', environment: '', name: 'foobar', vendor: 'auto-detect' },
        name: 'foobar',
        uid: 'e60ef618-324b-49d4-8a28-48839c546565',
    },
    spec: { hubAcceptsClient: true, leaseDurationSeconds: 60 },
}
const mockKACResponse: KlusterletAddonConfig = {
    apiVersion: 'agent.open-cluster-management.io/v1',
    kind: 'KlusterletAddonConfig',
    metadata: {
        name: 'foobar',
        namespace: 'foobar',
        uid: 'fba00095-386b-4d68-b2da-97003bc6a987',
    },
    spec: {
        applicationManager: { enabled: true },
        certPolicyController: { enabled: true },
        clusterLabels: { cloud: 'auto-detect', environment: '', name: 'foobar', vendor: 'auto-detect' },
        clusterName: 'foobar',
        clusterNamespace: 'foobar',
        iamPolicyController: { enabled: true },
        policyController: { enabled: true },
        searchCollector: { enabled: true },
        version: '2.1.0',
    },
}

describe('ImportCluster', () => {
    const Component = () => {
        return (
            <MemoryRouter>
                <ImportClusterPage />
            </MemoryRouter>
        )
    }
    test('renders', () => {
        const { getByTestId } = render(<Component />)
        expect(getByTestId('import-cluster-form')).toBeInTheDocument()
        expect(getByTestId('clusterName-label')).toBeInTheDocument()
        expect(getByTestId('cloudLabel-label')).toBeInTheDocument()
        expect(getByTestId('environmentLabel-label')).toBeInTheDocument()
        expect(getByTestId('additionalLabels-label')).toBeInTheDocument()
    })
    test('can create resources', async () => {
        const projectNock = nockCreate(projectRequestMethods, mockProject, mockProjectResponse)
        const managedClusterNock = nockCreate(managedClusterMethods, mockManagedCluster, mockManagedClusterResponse)
        const kacNock = nockCreate(klusterletAddonConfigMethodss, mockKAC, mockKACResponse)

        const { getByTestId } = render(<Component />)
        userEvent.type(getByTestId('clusterName'), 'foobar')
        userEvent.click(getByTestId('submit'))

        await waitFor(() => expect(projectNock.isDone()).toBeTruthy())
        await waitFor(() => expect(managedClusterNock.isDone()).toBeTruthy())
        await waitFor(() => expect(kacNock.isDone()).toBeTruthy())
    })
})
