/* Copyright Contributors to the Open Cluster Management project */

import { render } from '@testing-library/react'
import { Scope } from 'nock/types'
import { MemoryRouter, Route, Switch } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import { AcmRoute } from '@open-cluster-management/ui-components'
import { nockCreate, nockDelete, nockNamespacedList, nockIgnoreRBAC } from '../../../../../lib/nock-util'
import {
    clickByLabel,
    clickByText,
    typeByText,
    waitForCalled,
    waitForNock,
    waitForNocks,
    waitForText,
    waitForNotText,
} from '../../../../../lib/test-util'
import { NavigationPath } from '../../../../../NavigationPath'
import {
    ClusterDeployment,
    ClusterDeploymentApiVersion,
    ClusterDeploymentKind,
} from '../../../../../resources/cluster-deployment'
import { ClusterManagementAddOn } from '../../../../../resources/cluster-management-add-on'
import {
    ClusterProvision,
    ClusterProvisionApiVersion,
    ClusterProvisionKind,
} from '../../../../../resources/cluster-provision'
import { ManagedCluster, ManagedClusterApiVersion, ManagedClusterKind } from '../../../../../resources/managed-cluster'
import {
    ManagedClusterAddOn,
    ManagedClusterAddOnApiVersion,
    ManagedClusterAddOnKind,
} from '../../../../../resources/managed-cluster-add-on'
import {
    ManagedClusterInfo,
    ManagedClusterInfoApiVersion,
    ManagedClusterInfoKind,
} from '../../../../../resources/managed-cluster-info'
import { MachinePool, MachinePoolApiVersion, MachinePoolKind } from '../../../../../resources/machine-pool'
import { PodApiVersion, PodKind, PodList } from '../../../../../resources/pod'
import { SelfSubjectAccessReview } from '../../../../../resources/self-subject-access-review'
import ClusterDetails from './ClusterDetails'
import {
    managedClustersState,
    managedClusterInfosState,
    clusterDeploymentsState,
    certificateSigningRequestsState,
    clusterManagementAddonsState,
    managedClusterAddonsState,
    configMapsState,
    managedClusterSetsState,
    acmRouteState,
    clusterProvisionsState,
    machinePoolsState,
    clusterCuratorsState,
} from '../../../../../atoms'
import { mockOpenShiftConsoleConfigMap, mockManagedClusterSet } from '../../../../../lib/test-metadata'
import { ClusterCurator, ClusterCuratorApiVersion, ClusterCuratorKind } from '../../../../../resources/cluster-curator'

export const clusterName = 'test-cluster'

const mockManagedClusterInfo: ManagedClusterInfo = {
    apiVersion: ManagedClusterInfoApiVersion,
    kind: ManagedClusterInfoKind,
    metadata: { name: clusterName, namespace: clusterName },
    status: {
        distributionInfo: {
            ocp: {
                desired: {
                    version: '1.2.3',
                    image: 'abc',
                    channels: ['stable-1.2', 'stable-1.3'],
                },
                version: '1.2.3',
                channel: 'stable-1.2',
                availableUpdates: [],
                desiredVersion: '',
                upgradeFailed: false,
                versionAvailableUpdates: [{ version: '1.2.4', image: 'abc' }],
            },
            type: 'OCP',
        },
        conditions: [
            {
                message: 'Accepted by hub cluster admin',
                reason: 'HubClusterAdminAccepted',
                status: 'True',
                type: 'HubAcceptedManagedCluster',
            },
        ],
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

const mockManagedCluster: ManagedCluster = {
    apiVersion: ManagedClusterApiVersion,
    kind: ManagedClusterKind,
    metadata: { name: clusterName },
    spec: { hubAcceptsClient: true },
    status: {
        allocatable: { cpu: '', memory: '' },
        capacity: { cpu: '', memory: '' },
        version: { kubernetes: '' },
        clusterClaims: [],
        conditions: [],
    },
}

const mockClusterDeployment: ClusterDeployment = {
    apiVersion: ClusterDeploymentApiVersion,
    kind: ClusterDeploymentKind,
    metadata: {
        labels: {
            cloud: 'AWS',
            'hive.openshift.io/cluster-platform': 'aws',
            'hive.openshift.io/cluster-region': 'us-east-1',
            region: 'us-east-1',
            vendor: 'OpenShift',
        },
        name: clusterName,
        namespace: clusterName,
    },
    spec: {
        baseDomain: 'dev02.test-chesterfield.com',
        clusterName: clusterName,
        installed: false,
        platform: {
            aws: {
                credentialsSecretRef: {
                    name: 'test-cluster-aws-creds',
                },
                region: 'us-east-1',
            },
        },
        provisioning: {
            imageSetRef: {
                name: 'img4.5.15-x86-64',
            },
            installConfigSecretRef: {
                name: 'test-cluster-install-config',
            },
            sshPrivateKeySecretRef: {
                name: 'test-cluster-ssh-private-key',
            },
        },
        pullSecretRef: {
            name: 'test-cluster-pull-secret',
        },
    },
    status: {
        cliImage:
            'quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:8b8e08e498c61ccec5c446d6ab50c96792799c992c78cfce7bbb8481f04a64cb',
        conditions: [],
        installerImage:
            'quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:a3ed2bf438dfa5a114aa94cb923103432cd457cac51d1c4814ae0ef7e6e9853b',
        provisionRef: {
            name: 'test-cluster-31-26h5q',
        },
    },
}

const mockHiveProvisionPods: PodList = {
    kind: 'PodList',
    apiVersion: 'v1',
    metadata: { selfLink: '/api/v1/namespaces/test-cluster/pods', resourceVersion: '50100517' },
    items: [
        {
            metadata: {
                name: 'test-cluster-0-92r2t-provision-wtsph',
                generateName: 'test-cluster-0-92r2t-provision-',
                namespace: clusterName,
                selfLink: '/api/v1/namespaces/test-cluster/pods/test-cluster-0-92r2t-provision-wtsph',
                uid: '4facb96d-9737-407d-ac32-0b50bf66cc45',
                resourceVersion: '50084255',
                labels: {
                    cloud: 'AWS',
                    'controller-uid': 'a399648b-429b-4a96-928e-0396a335c3af',
                    'hive.openshift.io/cluster-deployment-name': clusterName,
                    'hive.openshift.io/cluster-platform': 'aws',
                    'hive.openshift.io/cluster-provision': 'test-cluster-0-92r2t',
                    'hive.openshift.io/cluster-provision-name': 'test-cluster-0-92r2t',
                    'hive.openshift.io/cluster-region': 'us-east-1',
                    'hive.openshift.io/install': 'true',
                    'hive.openshift.io/job-type': 'provision',
                    'job-name': 'test-cluster-0-92r2t-provision',
                    region: 'us-east-1',
                    vendor: 'OpenShift',
                },
            },
        },
    ],
}

const mockManagedClusterAddOnApp: ManagedClusterAddOn = {
    apiVersion: ManagedClusterAddOnApiVersion,
    kind: ManagedClusterAddOnKind,
    metadata: {
        name: 'application-manager',
        namespace: clusterName,
    },
    spec: {},
    status: {
        conditions: [
            {
                lastTransitionTime: '',
                message: 'Progressing',
                reason: 'Progressing',
                status: 'True',
                type: 'Progressing',
            },
        ],
        addOnMeta: {
            displayName: 'application-manager',
            description: 'application-manager description',
        },
        addOnConfiguration: {
            crdName: 'klusterletaddonconfig',
            crName: clusterName,
        },
    },
}

const mockManagedClusterAddOnWork: ManagedClusterAddOn = {
    apiVersion: 'addon.open-cluster-management.io/v1alpha1',
    kind: 'ManagedClusterAddOn',
    metadata: {
        name: 'work-manager',
        namespace: clusterName,
    },
    spec: {},
    status: {
        conditions: [
            {
                lastTransitionTime: '',
                message: 'Degraded',
                reason: 'Degraded',
                status: 'True',
                type: 'Degraded',
            },
        ],
        addOnMeta: {
            displayName: 'work-manager',
            description: 'work-manager description',
        },
        addOnConfiguration: {
            crdName: 'klusterletaddonconfig',
            crName: clusterName,
        },
    },
}

const mockManagedClusterAddOnCert: ManagedClusterAddOn = {
    apiVersion: 'addon.open-cluster-management.io/v1alpha1',
    kind: 'ManagedClusterAddOn',
    metadata: {
        name: 'cert-policy-controller',
        namespace: clusterName,
    },
    spec: {},
    status: {
        conditions: [
            {
                lastTransitionTime: '',
                message: 'Available',
                reason: 'Available',
                status: 'True',
                type: 'Available',
            },
        ],
        addOnMeta: {
            displayName: 'cert-policy-controller',
            description: 'cert-policy-controller description',
        },
        addOnConfiguration: {
            crdName: 'klusterletaddonconfig',
            crName: clusterName,
        },
    },
}

const mockManagedClusterAddOnPolicy: ManagedClusterAddOn = {
    apiVersion: 'addon.open-cluster-management.io/v1alpha1',
    kind: 'ManagedClusterAddOn',
    metadata: {
        uid: '',
        name: 'policy-controller',
        namespace: clusterName,
    },
    spec: {},
    status: {
        conditions: [
            {
                lastTransitionTime: '',
                message: 'Progressing',
                reason: 'Progressing',
                status: 'False',
                type: 'Progressing',
            },
        ],
        addOnMeta: {
            displayName: 'policy-controller',
            description: 'policy-controller description',
        },
        addOnConfiguration: {
            crdName: 'klusterletaddonconfig',
            crName: clusterName,
        },
    },
}

const mockManagedClusterAddOnSearch: ManagedClusterAddOn = {
    apiVersion: 'addon.open-cluster-management.io/v1alpha1',
    kind: 'ManagedClusterAddOn',
    metadata: {
        uid: '',
        name: 'search-collector',
        namespace: clusterName,
    },
    spec: {},
    status: {
        conditions: [
            {
                lastTransitionTime: '',
                message: 'Unknown',
                reason: 'Unknown',
                status: 'True',
                type: 'Unknown',
            },
        ],
        addOnMeta: {
            displayName: 'search-collector',
            description: 'search-collector description',
        },
        addOnConfiguration: {
            crdName: 'klusterletaddonconfig',
            crName: clusterName,
        },
    },
}

const mockSelfSubjectAccessResponse: SelfSubjectAccessReview = {
    apiVersion: 'authorization.k8s.io/v1',
    kind: 'SelfSubjectAccessReview',
    metadata: {},
    spec: {
        resourceAttributes: {
            namespace: clusterName,
            resource: 'secrets',
            verb: 'get',
        },
    },
    status: {
        allowed: true,
    },
}

const mockGetSecretSelfSubjectAccessRequest: SelfSubjectAccessReview = {
    apiVersion: 'authorization.k8s.io/v1',
    kind: 'SelfSubjectAccessReview',
    metadata: {},
    spec: {
        resourceAttributes: {
            namespace: clusterName,
            resource: 'secrets',
            verb: 'get',
            group: '',
        },
    },
}
const mockClusterManagementAddons: ClusterManagementAddOn[] = [
    {
        apiVersion: 'addon.open-cluster-management.io/v1alpha1',
        kind: 'ClusterManagementAddOn',
        metadata: {
            name: 'application-manager',
            annotations: {
                'console.open-cluster-management.io/launch-link': '/cma/grafana',
                'console.open-cluster-management.io/launch-link-text': 'Grafana',
            },
        },
        spec: {
            addOnConfiguration: { crName: '', crdName: 'klusterletaddonconfigs.agent.open-cluster-management.io' },
            addOnMeta: {
                description: 'Processes events and other requests to managed resources.',
                displayName: 'Application Manager',
            },
        },
    },
    {
        apiVersion: 'addon.open-cluster-management.io/v1alpha1',
        kind: 'ClusterManagementAddOn',
        metadata: {
            name: 'cert-policy-controller',
        },
        spec: {
            addOnConfiguration: { crName: '', crdName: 'klusterletaddonconfigs.agent.open-cluster-management.io' },
            addOnMeta: {
                description: 'Monitors certificate expiration based on distributed policies.',
                displayName: 'Cert Policy Controller',
            },
        },
    },
    {
        apiVersion: 'addon.open-cluster-management.io/v1alpha1',
        kind: 'ClusterManagementAddOn',
        metadata: {
            name: 'iam-policy-controller',
        },
        spec: {
            addOnConfiguration: { crName: '', crdName: 'klusterletaddonconfigs.agent.open-cluster-management.io' },
            addOnMeta: {
                description: 'Monitors identity controls based on distributed policies.',
                displayName: 'IAM Policy Controller',
            },
        },
    },
    {
        apiVersion: 'addon.open-cluster-management.io/v1alpha1',
        kind: 'ClusterManagementAddOn',
        metadata: {
            name: 'policy-controller',
        },
        spec: {
            addOnConfiguration: { crName: '', crdName: 'klusterletaddonconfigs.agent.open-cluster-management.io' },
            addOnMeta: {
                description: 'Distributes configured policies and monitors Kubernetes-based policies.',
                displayName: 'Policy Controller',
            },
        },
    },
    {
        apiVersion: 'addon.open-cluster-management.io/v1alpha1',
        kind: 'ClusterManagementAddOn',
        metadata: {
            name: 'search-collector',
        },
        spec: {
            addOnConfiguration: { crName: '', crdName: 'klusterletaddonconfigs.agent.open-cluster-management.io' },
            addOnMeta: {
                description: 'Collects cluster data to be indexed by search components on the hub cluster.',
                displayName: 'Search Collector',
            },
        },
    },
    {
        apiVersion: 'addon.open-cluster-management.io/v1alpha1',
        kind: 'ClusterManagementAddOn',
        metadata: {
            name: 'work-manager',
        },
        spec: {
            addOnConfiguration: { crName: '', crdName: 'klusterletaddonconfigs.agent.open-cluster-management.io' },
            addOnMeta: {
                description: 'Handles endpoint work requests and managed cluster status.',
                displayName: 'Work Manager',
            },
        },
    },
]

const mockManagedClusterAddOns: ManagedClusterAddOn[] = [
    mockManagedClusterAddOnApp,
    mockManagedClusterAddOnWork,
    mockManagedClusterAddOnCert,
    mockManagedClusterAddOnPolicy,
    mockManagedClusterAddOnSearch,
]

const mockClusterProvisions: ClusterProvision = {
    apiVersion: ClusterProvisionApiVersion,
    kind: ClusterProvisionKind,
    metadata: {
        labels: {
            cloud: 'GCP',
            'hive.openshift.io/cluster-deployment-name': clusterName,
            'hive.openshift.io/cluster-platform': 'gcp',
            'hive.openshift.io/cluster-region': 'us-east1',
            region: 'us-east1',
            vendor: 'OpenShift',
        },
        name: 'test-cluster-0-hmd44',
        namespace: clusterName,
    },
    spec: {
        attempt: 0,
        clusterDeploymentRef: { name: clusterName },
        installLog:
            'level=info msg="Credentials loaded from environment variable \\"GOOGLE_CREDENTIALS\\", file \\"/.gcp/osServiceAccount.json\\""\nlevel=fatal msg="failed to fetch Master Machines: failed to load asset \\"Install Config\\": platform.gcp.project: Invalid value: \\"gc-acm-dev-fake\\": invalid project ID"\n',
    },
    status: {
        conditions: [
            {
                lastProbeTime: '2021-01-04T18:23:30Z',
                lastTransitionTime: '2021-01-04T18:23:30Z',
                message: 'Install job has been created',
                reason: 'JobCreated',
                status: 'True',
                type: 'ClusterProvisionJobCreated',
            },
            {
                lastProbeTime: '2021-01-04T18:23:37Z',
                lastTransitionTime: '2021-01-04T18:23:37Z',
                message: 'Invalid GCP project ID',
                reason: 'GCPInvalidProjectID',
                status: 'True',
                type: 'ClusterProvisionFailed',
            },
        ],
    },
}

export const mockMachinePoolManual: MachinePool = {
    apiVersion: MachinePoolApiVersion,
    kind: MachinePoolKind,
    metadata: {
        name: `${clusterName}-manual`,
        namespace: clusterName,
    },
    spec: {
        clusterDeploymentRef: {
            name: clusterName,
        },
        name: 'worker',
        platform: {
            aws: {
                rootVolume: {
                    iops: 100,
                    size: 22,
                    type: 'gp2',
                },
                type: 'm4.xlarge',
            },
        },
        replicas: 3,
    },
    status: {
        replicas: 3,
        machineSets: [
            {
                maxReplicas: 1,
                minReplicas: 1,
                name: `${clusterName}-rxzsv-9k5qn-worker-us-east-1a`,
                replicas: 1,
            },
            {
                maxReplicas: 1,
                minReplicas: 1,
                name: `${clusterName}-rxzsv-9k5qn-worker-us-east-1b`,
                replicas: 1,
            },
            {
                maxReplicas: 1,
                minReplicas: 1,
                name: `${clusterName}-rxzsv-9k5qn-worker-us-east-1c`,
                replicas: 1,
            },
            {
                maxReplicas: 0,
                minReplicas: 0,
                name: `${clusterName}-rxzsv-9k5qn-worker-us-east-1d`,
                replicas: 0,
            },
            {
                maxReplicas: 0,
                minReplicas: 0,
                name: `${clusterName}-rxzsv-9k5qn-worker-us-east-1e`,
                replicas: 0,
            },
            {
                maxReplicas: 0,
                minReplicas: 0,
                name: `${clusterName}-rxzsv-9k5qn-worker-us-east-1f`,
                replicas: 0,
            },
        ],
    },
}

export const mockMachinePoolAuto: MachinePool = {
    apiVersion: MachinePoolApiVersion,
    kind: MachinePoolKind,
    metadata: {
        name: `${clusterName}-auto`,
        namespace: clusterName,
    },
    spec: {
        clusterDeploymentRef: {
            name: clusterName,
        },
        name: 'worker',
        platform: {
            aws: {
                rootVolume: {
                    iops: 100,
                    size: 22,
                    type: 'gp2',
                },
                type: 'm4.xlarge',
            },
        },
        autoscaling: {
            minReplicas: 1,
            maxReplicas: 3,
        },
    },
    status: {
        replicas: 3,
        machineSets: [
            {
                maxReplicas: 1,
                minReplicas: 1,
                name: `${clusterName}-rxzsv-9k5qn-worker-us-east-1a`,
                replicas: 1,
            },
            {
                maxReplicas: 1,
                minReplicas: 1,
                name: `${clusterName}-rxzsv-9k5qn-worker-us-east-1b`,
                replicas: 1,
            },
            {
                maxReplicas: 1,
                minReplicas: 1,
                name: `${clusterName}-rxzsv-9k5qn-worker-us-east-1c`,
                replicas: 1,
            },
            {
                maxReplicas: 0,
                minReplicas: 0,
                name: `${clusterName}-rxzsv-9k5qn-worker-us-east-1d`,
                replicas: 0,
            },
            {
                maxReplicas: 0,
                minReplicas: 0,
                name: `${clusterName}-rxzsv-9k5qn-worker-us-east-1e`,
                replicas: 0,
            },
            {
                maxReplicas: 0,
                minReplicas: 0,
                name: `${clusterName}-rxzsv-9k5qn-worker-us-east-1f`,
                replicas: 0,
            },
        ],
    },
}

const mockClusterCurator: ClusterCurator = {
    apiVersion: ClusterCuratorApiVersion,
    kind: ClusterCuratorKind,
    metadata: {
        name: 'test-cluster',
        namespace: 'test-cluster',
    },
    spec: {
        desiredCuration: 'install',
        install: {
            towerAuthSecret: 'ansible-credential-i',
            prehook: [],
        },
    },
}

const nockListHiveProvisionJobs = () =>
    nockNamespacedList(
        { apiVersion: PodApiVersion, kind: PodKind, metadata: { namespace: clusterName } },
        mockHiveProvisionPods,
        ['hive.openshift.io/cluster-deployment-name=test-cluster', 'hive.openshift.io/job-type=provision']
    )

const Component = () => (
    <RecoilRoot
        initializeState={(snapshot) => {
            snapshot.set(acmRouteState, AcmRoute.Clusters)
            snapshot.set(managedClusterAddonsState, mockManagedClusterAddOns)
            snapshot.set(clusterManagementAddonsState, mockClusterManagementAddons)
            snapshot.set(managedClustersState, [mockManagedCluster])
            snapshot.set(clusterDeploymentsState, [mockClusterDeployment])
            snapshot.set(managedClusterInfosState, [mockManagedClusterInfo])
            snapshot.set(certificateSigningRequestsState, [])
            snapshot.set(managedClusterSetsState, [mockManagedClusterSet])
            snapshot.set(configMapsState, [mockOpenShiftConsoleConfigMap])
            snapshot.set(clusterProvisionsState, [mockClusterProvisions])
            snapshot.set(machinePoolsState, [mockMachinePoolManual, mockMachinePoolAuto])
            snapshot.set(clusterCuratorsState, [mockClusterCurator])
        }}
    >
        <MemoryRouter initialEntries={[NavigationPath.clusterDetails.replace(':id', clusterName)]}>
            <Switch>
                <Route path={NavigationPath.clusterDetails} component={ClusterDetails} />
            </Switch>
        </MemoryRouter>
    </RecoilRoot>
)

describe('ClusterDetails', () => {
    beforeEach(async () => {
        nockIgnoreRBAC()
        render(<Component />)
    })

    test('overview page renders', async () => {
        await waitForText(clusterName, true)
        await waitForText('tab.overview')
        await waitForText('table.details')
    })

    test('overview page opens logs', async () => {
        const nocks: Scope[] = [nockListHiveProvisionJobs()]
        window.open = jest.fn()
        await clickByText('status.link.logs')
        await waitForNocks(nocks)
        await waitForCalled(window.open as jest.Mock)
    })

    test('overview page opens edit labels', async () => {
        await waitForText(clusterName, true)

        await clickByLabel('common:labels.edit.title')
        await waitForText('labels.description')

        await clickByText('common:cancel')
        await waitForNotText('labels.description')
    })

    test('overview page handles channel select', async () => {
        await waitForText(clusterName, true)
        await waitForText(clusterName, true)

        await clickByLabel('cluster:bulk.title.selectChannel')
        await waitForText('bulk.message.selectChannel')

        await clickByText('common:cancel')
        await waitForNotText('bulk.message.selectChannel')
    })

    test('nodes page renders', async () => {
        await clickByText('tab.nodes')
        await waitForText(mockManagedClusterInfo.status?.nodeList?.[0].name!)

        await clickByText('table.role')
        await waitForText(mockManagedClusterInfo.status?.nodeList?.[0].name!)

        await clickByText('table.region')
        await waitForText(mockManagedClusterInfo.status?.nodeList?.[0].name!)
    })

    test('machine pools page renders', async () => {
        await clickByText('tab.machinepools')
        await waitForText(mockMachinePoolManual.metadata.name!)
        await waitForText(mockMachinePoolAuto.metadata.name!)
    })

    test('settings page renders', async () => {
        await clickByText('tab.addons')
        await waitForText(mockManagedClusterAddOns[0].metadata.name!)
    })

    test('overview page handles detach', async () => {
        await clickByText('actions')

        await clickByText('managed.detach')
        await typeByText('type.to.confirm', mockManagedCluster.metadata.name!)

        const deleteNock = nockDelete(mockManagedCluster)
        await clickByText('detach')
        await waitForNock(deleteNock)
    })

    test('overview page handles destroy', async () => {
        await clickByText('actions')
        await clickByText('managed.destroy')
        await typeByText('type.to.confirm', mockManagedCluster.metadata.name!)

        const deleteNocks: Scope[] = [nockDelete(mockManagedCluster), nockDelete(mockClusterDeployment)]
        await clickByText('destroy')
        await waitForNocks(deleteNocks)
    })
})

describe('ClusterDetails', () => {
    test('page renders error state', async () => {
        const nock = nockCreate(mockGetSecretSelfSubjectAccessRequest, mockSelfSubjectAccessResponse)
        render(
            <RecoilRoot
                initializeState={(snapshot) => {
                    snapshot.set(managedClustersState, [])
                    snapshot.set(clusterDeploymentsState, [])
                    snapshot.set(managedClusterInfosState, [])
                    snapshot.set(certificateSigningRequestsState, [])
                    snapshot.set(clusterManagementAddonsState, [])
                    snapshot.set(managedClusterAddonsState, [])
                    snapshot.set(managedClusterSetsState, [mockManagedClusterSet])
                    snapshot.set(configMapsState, [])
                }}
            >
                <MemoryRouter initialEntries={[NavigationPath.clusterDetails.replace(':id', clusterName)]}>
                    <Switch>
                        <Route path={NavigationPath.clusterDetails} component={ClusterDetails} />
                    </Switch>
                </MemoryRouter>
            </RecoilRoot>
        )
        await waitForNocks([nock])
        await waitForText('Not found')
    })
})
