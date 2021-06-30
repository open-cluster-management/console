/* Copyright Contributors to the Open Cluster Management project */
import {
    AcmEmptyState,
    AcmIcon,
    AcmPage,
    AcmPageHeader,
    AcmToastContext,
    Provider,
    ProviderIconMap,
    ProviderLongTextMap,
} from '@open-cluster-management/ui-components'
import { PageSection } from '@patternfly/react-core'
import { Fragment, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RouteComponentProps, useHistory } from 'react-router'
import { useRecoilState } from 'recoil'
import { namespacesState } from '../../atoms'
import { AcmDataFormPage } from '../../components/AcmDataForm'
import { FormData } from '../../components/AcmFormData'
import { ErrorPage } from '../../components/ErrorPage'
import { LoadingPage } from '../../components/LoadingPage'
import { DOC_LINKS } from '../../lib/doc-util'
import { getAuthorizedNamespaces, rbacCreate } from '../../lib/rbac-util'
import { createResource, patchResource } from '../../lib/resource-request'
import {
    validateBaseDomain,
    validateCertificate,
    validateGCProjectID,
    validateImageMirror,
    validateJSON,
    validateKubernetesDnsName,
    validateLibvirtURI,
    validatePrivateSshKey,
    validatePublicSshKey,
    validateCloudsYaml,
    validateBareMetalOSImageURL,
} from '../../lib/validation'
import { NavigationPath } from '../../NavigationPath'
import { ProviderConnection, unpackProviderConnection } from '../../resources/provider-connection'
import { IResource } from '../../resources/resource'
import { getSecret, Secret, SecretDefinition } from '../../resources/secret'

const credentialProviders: Provider[] = [
    Provider.openstack,
    Provider.ansible,
    Provider.redhatcloud,
    Provider.aws,
    Provider.azure,
    Provider.gcp,
    Provider.vmware,
    Provider.baremetal,
]

enum ProviderGroup {
    Automation = 'Automation & other credentials',
    Datacenter = 'Datacenter credentials',
    CloudProvider = 'Cloud provider credentials',
}

const providerGroup: Record<string, string> = {
    [Provider.redhatcloud]: ProviderGroup.Automation,
    [Provider.ansible]: ProviderGroup.Automation,
    [Provider.aws]: ProviderGroup.CloudProvider,
    [Provider.gcp]: ProviderGroup.CloudProvider,
    [Provider.azure]: ProviderGroup.CloudProvider,
    [Provider.ibm]: ProviderGroup.CloudProvider,
    [Provider.openstack]: ProviderGroup.Datacenter,
    [Provider.baremetal]: ProviderGroup.Datacenter,
    [Provider.vmware]: ProviderGroup.Datacenter,
}

export default function CredentialsFormPage({ match }: RouteComponentProps<{ namespace: string; name: string }>) {
    const { name, namespace } = match.params
    const { t } = useTranslation(['credentials', 'common'])

    let isEditing = false
    let isViewing = false
    if (name !== undefined) {
        isEditing = match.path.endsWith(NavigationPath.editCredentials)
        isViewing = !isEditing
    }

    const [error, setError] = useState<Error>()

    const [namespaces] = useRecoilState(namespacesState)
    const [projects, setProjects] = useState<string[]>()
    useEffect(() => {
        if (!isEditing && !isViewing)
            getAuthorizedNamespaces([rbacCreate(SecretDefinition)], namespaces)
                .then((namespaces: string[]) => setProjects(namespaces.sort()))
                .catch(setError)
        return undefined
    }, [namespaces, isEditing, isViewing])

    const [providerConnection, setProviderConnection] = useState<ProviderConnection | undefined>()
    useEffect(() => {
        if (isEditing || isViewing) {
            const result = getSecret({ name, namespace })
            result.promise
                .then((secret) => setProviderConnection(unpackProviderConnection(secret as ProviderConnection)))
                .catch(setError)
            return result.abort
        }
        return undefined
    }, [isEditing, isViewing, name, namespace])

    if (error) return <ErrorPage error={error} />

    if (isEditing || isViewing) {
        if (!providerConnection) return <LoadingPage />
        return (
            <CredentialsForm
                namespaces={[providerConnection.metadata.namespace!]}
                providerConnection={providerConnection}
                isEditing={isEditing}
                isViewing={isViewing}
            />
        )
    } else {
        if (!projects) return <LoadingPage />
        if (projects.length === 0) {
            return (
                <AcmPage
                    header={
                        <AcmPageHeader
                            title={t('credentialsForm.title.add')}
                            breadcrumb={[
                                { text: t('credentialsPage.title'), to: NavigationPath.credentials },
                                { text: t('credentialsForm.title.add') },
                            ]}
                        />
                    }
                >
                    <PageSection variant="light" isFilled>
                        <AcmEmptyState
                            title={t('common:rbac.title.unauthorized')}
                            message={t('common:rbac.namespaces.unauthorized')}
                            showIcon={false}
                        />
                    </PageSection>
                </AcmPage>
            )
        }
        return <CredentialsForm namespaces={projects} isEditing={false} isViewing={false} />
    }
}

export function CredentialsForm(props: {
    namespaces: string[]
    providerConnection?: ProviderConnection
    isEditing: boolean
    isViewing: boolean
}) {
    const { t } = useTranslation(['credentials', 'common'])
    const { namespaces, providerConnection, isEditing, isViewing } = props
    const toastContext = useContext(AcmToastContext)

    const history = useHistory()

    const [credentialsType, setCredentialsType] = useState(
        providerConnection?.metadata.labels?.['cluster.open-cluster-management.io/type'] ?? ''
    )

    // Details
    const [name, setName] = useState(providerConnection?.metadata.name ?? '')
    const [namespace, setNamespace] = useState(providerConnection?.metadata.namespace ?? '')

    // Base Domain
    const [baseDomain, setBaseDomain] = useState(providerConnection?.stringData?.baseDomain ?? '')

    // Pull Secret
    const [pullSecret, setPullSecret] = useState(providerConnection?.stringData?.pullSecret ?? '')

    // SSH Key
    const [sshPublickey, setSshPublickey] = useState(providerConnection?.stringData?.['ssh-publickey'] ?? '')
    const [sshPrivatekey, setSshPrivatekey] = useState(providerConnection?.stringData?.['ssh-privatekey'] ?? '')

    // Amazon Web Services State
    const [aws_access_key_id, setAwsAccessKeyID] = useState(providerConnection?.stringData?.aws_access_key_id ?? '')
    const [aws_secret_access_key, setAwsSecretAccessKeyID] = useState(
        providerConnection?.stringData?.aws_secret_access_key ?? ''
    )

    // Azure Cloud State
    const [baseDomainResourceGroupName, setBaseDomainResourceGroupName] = useState(
        providerConnection?.stringData?.baseDomainResourceGroupName ?? ''
    )

    let osServicePrincipalJson:
        | {
              clientId: string
              clientSecret: string
              tenantId: string
              subscriptionId: string
          }
        | undefined = undefined

    if (providerConnection?.stringData?.['osServicePrincipal.json']) {
        try {
            osServicePrincipalJson = JSON.parse(providerConnection?.stringData?.['osServicePrincipal.json'])
        } catch {
            // Do Nothing
        }
    }

    const [clientId, setClientId] = useState(osServicePrincipalJson?.clientId ?? '')
    const [clientSecret, setClientSecret] = useState(osServicePrincipalJson?.clientSecret ?? '')
    const [tenantId, setTenantId] = useState(osServicePrincipalJson?.tenantId ?? '')
    const [subscriptionId, setSubscriptionId] = useState(osServicePrincipalJson?.subscriptionId ?? '')

    // Google
    const [projectID, setGcProjectID] = useState(providerConnection?.stringData?.projectID ?? '')
    const [osServiceAccountJson, setGcServiceAccountKey] = useState(
        providerConnection?.stringData?.['osServiceAccount.json'] ?? ''
    )

    // VMWare
    const [vCenter, setVcenter] = useState(providerConnection?.stringData?.vCenter ?? '')
    const [username, setUsername] = useState(providerConnection?.stringData?.username ?? '')
    const [password, setPassword] = useState(providerConnection?.stringData?.password ?? '')
    const [cacertificate, setCacertificate] = useState(providerConnection?.stringData?.cacertificate ?? '')
    const [cluster, setVmClusterName] = useState(providerConnection?.stringData?.cluster ?? '')
    const [datacenter, setDatacenter] = useState(providerConnection?.stringData?.datacenter ?? '')
    const [defaultDatastore, setDatastore] = useState(providerConnection?.stringData?.defaultDatastore ?? '')

    // OpenStack
    const [cloudsYaml, setOpenstackCloudsYaml] = useState(providerConnection?.stringData?.['clouds.yaml'] ?? '')
    const [cloud, setOpenstackCloud] = useState(providerConnection?.stringData?.cloud ?? '')

    // BareMetal
    const [libvirtURI, setLibvirtURI] = useState(providerConnection?.stringData?.libvirtURI ?? '')
    const [sshKnownHosts, setSshKnownHosts] = useState(providerConnection?.stringData?.sshKnownHosts ?? '')
    const [imageMirror, setImageMirror] = useState(providerConnection?.stringData?.imageMirror ?? '')
    const [bootstrapOSImage, setBootstrapOSImage] = useState(providerConnection?.stringData?.bootstrapOSImage ?? '')
    const [clusterOSImage, setClusterOSImage] = useState(providerConnection?.stringData?.clusterOSImage ?? '')
    const [additionalTrustBundle, setAdditionalTrustBundle] = useState(
        providerConnection?.stringData?.additionalTrustBundle ?? ''
    )

    // Ansible
    const [ansibleHost, setAnsibleHost] = useState(providerConnection?.stringData?.host ?? '')
    const [ansibleToken, setAnsibleToken] = useState(providerConnection?.stringData?.token ?? '')

    // Red Hat Cloud
    const [ocmAPIToken, setOcmAPIToken] = useState(providerConnection?.stringData?.ocmAPIToken ?? '')

    function stateToData() {
        const secret: ProviderConnection = {
            apiVersion: 'v1',
            kind: 'Secret',
            type: 'Opaque',
            metadata: {
                name,
                namespace,
                labels: {
                    ...(providerConnection ? providerConnection.metadata.labels : {}),
                    ...{
                        'cluster.open-cluster-management.io/type': credentialsType,
                        'cluster.open-cluster-management.io/credentials': '',
                    },
                },
            },
            stringData: {},
        }
        let annotations = providerConnection ? providerConnection?.metadata.annotations : undefined
        if (annotations) {
            delete annotations['kubectl.kubernetes.io/last-applied-configuration']
            if (Object.keys(annotations).length === 0) annotations = undefined
        }
        if (annotations) {
            secret.metadata.annotations = annotations
        }
        switch (credentialsType) {
            case Provider.aws:
                secret.stringData!.aws_access_key_id = aws_access_key_id
                secret.stringData!.aws_secret_access_key = aws_secret_access_key
                secret.stringData!.baseDomain = baseDomain
                secret.stringData!.pullSecret = pullSecret
                secret.stringData!['ssh-privatekey'] = sshPrivatekey
                secret.stringData!['ssh-publickey'] = sshPublickey
                break
            case Provider.azure:
                secret.stringData!.baseDomainResourceGroupName = baseDomainResourceGroupName
                secret.stringData!['osServicePrincipal.json'] = JSON.stringify({
                    clientId,
                    clientSecret,
                    tenantId,
                    subscriptionId,
                })
                secret.stringData!.baseDomain = baseDomain
                secret.stringData!.pullSecret = pullSecret
                secret.stringData!['ssh-privatekey'] = sshPrivatekey
                secret.stringData!['ssh-publickey'] = sshPublickey
                break
            case Provider.gcp:
                secret.stringData!.projectID = projectID
                secret.stringData!['osServiceAccount.json'] = osServiceAccountJson
                secret.stringData!.baseDomain = baseDomain
                secret.stringData!.pullSecret = pullSecret
                secret.stringData!['ssh-privatekey'] = sshPrivatekey
                secret.stringData!['ssh-publickey'] = sshPublickey
                break
            case Provider.vmware:
                secret.stringData!.vCenter = vCenter
                secret.stringData!.username = username
                secret.stringData!.password = password
                secret.stringData!.cacertificate = cacertificate
                secret.stringData!.cluster = cluster
                secret.stringData!.datacenter = datacenter
                secret.stringData!.defaultDatastore = defaultDatastore
                secret.stringData!.baseDomain = baseDomain
                secret.stringData!.pullSecret = pullSecret
                secret.stringData!['ssh-privatekey'] = sshPrivatekey
                secret.stringData!['ssh-publickey'] = sshPublickey
                break
            case Provider.openstack:
                secret.stringData!['clouds.yaml'] = cloudsYaml
                secret.stringData!.cloud = cloud
                secret.stringData!.baseDomain = baseDomain
                secret.stringData!.pullSecret = pullSecret
                secret.stringData!['ssh-privatekey'] = sshPrivatekey
                secret.stringData!['ssh-publickey'] = sshPublickey
                break
            case Provider.baremetal:
                secret.stringData!.libvirtURI = libvirtURI
                secret.stringData!.sshKnownHosts = sshKnownHosts
                secret.stringData!.imageMirror = imageMirror
                secret.stringData!.bootstrapOSImage = bootstrapOSImage
                secret.stringData!.clusterOSImage = clusterOSImage
                secret.stringData!.additionalTrustBundle = additionalTrustBundle
                secret.stringData!.baseDomain = baseDomain
                secret.stringData!.pullSecret = pullSecret
                secret.stringData!['ssh-privatekey'] = sshPrivatekey
                secret.stringData!['ssh-publickey'] = sshPublickey
                break
            case Provider.ansible:
                secret.stringData!.host = ansibleHost
                secret.stringData!.token = ansibleToken
                break

            case Provider.redhatcloud:
                secret.stringData!.ocmAPIToken = ocmAPIToken
                break
        }
        return secret
        // return packProviderConnection(secret)
    }
    const title = isViewing ? name : isEditing ? t('credentialsForm.title.edit') : t('credentialsForm.title.add')
    const titleTooltip = (
        <Fragment>
            {t('credentialsForm.title.tooltip')}
            <a
                href={DOC_LINKS.CREATE_CONNECTION}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'block', marginTop: '4px' }}
            >
                {t('common:learn.more')}
            </a>
        </Fragment>
    )

    const formData: FormData = {
        title,
        titleTooltip,
        breadcrumb: [{ text: t('credentialsPage.title'), to: NavigationPath.credentials }, { text: title }],
        sections: [
            {
                type: 'Section',
                title: credentialsType
                    ? t('credentialsForm.basicInformation.title')
                    : t('credentialsForm.credentialsType.title'),
                wizardTitle: credentialsType
                    ? t('credentialsForm.basicInformation.wizardTitle')
                    : t('credentialsForm.credentialsType.wizardTitle'),
                description: !credentialsType && (
                    <a href={DOC_LINKS.CREATE_CONNECTION} target="_blank" rel="noreferrer">
                        {t('credentialsForm.credentialsType.wizardDescription')}
                    </a>
                ),
                inputs: [
                    {
                        id: 'credentialsType',
                        type: isEditing || credentialsType ? 'GroupedSelect' : 'GroupedTiles',
                        label: t('credentialsForm.credentialsType.label'),
                        placeholder: t('credentialsForm.credentialsType.placeholder'),
                        value: credentialsType,
                        onChange: setCredentialsType,
                        isRequired: true,
                        groups: [
                            {
                                group: ProviderGroup.CloudProvider,
                                options: credentialProviders
                                    .filter((provider) => providerGroup[provider] === ProviderGroup.CloudProvider)
                                    .map((provider) => {
                                        return {
                                            id: provider,
                                            value: provider,
                                            icon: <AcmIcon icon={ProviderIconMap[provider]} />,
                                            text: ProviderLongTextMap[provider],
                                        }
                                    }),
                            },
                            {
                                group: ProviderGroup.Datacenter,
                                options: credentialProviders
                                    .filter((provider) => providerGroup[provider] === ProviderGroup.Datacenter)
                                    .map((provider) => {
                                        return {
                                            id: provider,
                                            value: provider,
                                            icon: <AcmIcon icon={ProviderIconMap[provider]} />,
                                            text: ProviderLongTextMap[provider],
                                        }
                                    }),
                            },
                            {
                                group: ProviderGroup.Automation,
                                options: credentialProviders
                                    .filter((provider) => providerGroup[provider] === ProviderGroup.Automation)
                                    .map((provider) => {
                                        return {
                                            id: provider,
                                            value: provider,
                                            icon: <AcmIcon icon={ProviderIconMap[provider]} />,
                                            text: ProviderLongTextMap[provider],
                                        }
                                    }),
                            },
                        ],
                        isDisabled: isEditing,
                    },
                    {
                        id: 'credentialsName',
                        type: 'Text',
                        label: t('credentialsForm.credentialsName.label'),
                        placeholder: t('credentialsForm.credentialsName.placeholder'),
                        labelHelp: t('credentialsForm.credentialsName.labelHelp'),
                        value: name,
                        onChange: setName,
                        validation: (value) => validateKubernetesDnsName(value, t),
                        isRequired: true,
                        isDisabled: isEditing,
                        isHidden: !credentialsType,
                    },
                    {
                        id: 'namespaceName',
                        type: 'Select',
                        label: t('credentialsForm.namespaceName.label'),
                        placeholder: t('credentialsForm.namespaceName.placeholder'),
                        labelHelp: t('credentialsForm.namespaceName.labelHelp'),
                        value: namespace,
                        onChange: setNamespace,
                        isRequired: true,
                        options: namespaces.map((namespace) => ({
                            id: namespace,
                            value: namespace,
                        })),
                        isDisabled: isEditing,
                        isHidden: !credentialsType,
                    },
                    {
                        id: 'baseDomain',
                        isHidden: ![
                            Provider.aws,
                            Provider.azure,
                            Provider.baremetal,
                            Provider.gcp,
                            Provider.openstack,
                            Provider.vmware,
                        ].includes(credentialsType as Provider),
                        type: 'Text',
                        label: t('credentialsForm.baseDomain.label'),
                        placeholder: t('credentialsForm.baseDomain.placeholder'),
                        labelHelp: t('credentialsForm.baseDomain.labelHelp'),
                        value: baseDomain,
                        onChange: setBaseDomain,
                        validation: (v) => validateBaseDomain(v, t),
                    },
                ],
            },
            {
                type: 'Section',
                title: t('credentialsForm.awsCredentials.title'),
                wizardTitle: t('credentialsForm.awsCredentials.wizardTitle'),
                description: (
                    <a href={DOC_LINKS.CREATE_CONNECTION_AWS} target="_blank" rel="noreferrer">
                        {t('credentialsForm.awsCredentials.wizardDescription')}
                    </a>
                ),
                inputs: [
                    {
                        id: 'aws_access_key_id',
                        isHidden: credentialsType !== Provider.aws,
                        type: 'Text',
                        label: t('credentialsForm.aws_access_key_id.label'),
                        placeholder: t('credentialsForm.aws_access_key_id.placeholder'),
                        labelHelp: t('credentialsForm.aws_access_key_id.labelHelp'),
                        value: aws_access_key_id,
                        onChange: setAwsAccessKeyID,
                        isRequired: true,
                    },
                    {
                        id: 'aws_secret_access_key',
                        isHidden: credentialsType !== Provider.aws,
                        type: 'Text',
                        label: t('credentialsForm.aws_secret_access_key.label'),
                        placeholder: t('credentialsForm.aws_secret_access_key.placeholder'),
                        labelHelp: t('credentialsForm.aws_secret_access_key.labelHelp'),
                        value: aws_secret_access_key,
                        onChange: setAwsSecretAccessKeyID,
                        isRequired: true,
                        isSecret: true,
                    },
                ],
            },
            {
                type: 'Section',
                title: t('credentialsForm.gcpCredentials.title'),
                wizardTitle: t('credentialsForm.gcpCredentials.wizardTitle'),
                description: (
                    <a href={DOC_LINKS.CREATE_CONNECTION_GCP} target="_blank" rel="noreferrer">
                        {t('credentialsForm.gcpCredentials.wizardDescription')}
                    </a>
                ),
                inputs: [
                    {
                        id: 'projectID',
                        isHidden: credentialsType !== Provider.gcp,
                        type: 'Text',
                        label: t('credentialsForm.projectID.label'),
                        placeholder: t('credentialsForm.projectID.placeholder'),
                        labelHelp: t('credentialsForm.projectID.labelHelp'),
                        value: projectID,
                        onChange: setGcProjectID,
                        validation: (value) => validateGCProjectID(value, t),
                        isRequired: true,
                    },
                    {
                        id: 'osServiceAccount.json',
                        isHidden: credentialsType !== Provider.gcp,
                        type: 'TextArea',
                        label: t('credentialsForm.osServiceAccount.json.label'),
                        placeholder: t('credentialsForm.osServiceAccount.json.placeholder'),
                        labelHelp: t('credentialsForm.osServiceAccount.json.labelHelp'),
                        value: osServiceAccountJson,
                        onChange: setGcServiceAccountKey,
                        validation: (value) => validateJSON(value, t),
                        isRequired: true,
                        isSecret: true,
                    },
                ],
            },
            {
                type: 'Section',
                title: t('credentialsForm.azureCredentials.title'),
                wizardTitle: t('credentialsForm.azureCredentials.wizardTitle'),
                description: (
                    <a href={DOC_LINKS.CREATE_CONNECTION_AZURE} target="_blank" rel="noreferrer">
                        {t('credentialsForm.azureCredentials.wizardDescription')}
                    </a>
                ),
                inputs: [
                    {
                        id: 'baseDomainResourceGroupName',
                        isHidden: credentialsType !== Provider.azure,
                        type: 'Text',
                        label: t('credentialsForm.baseDomainResourceGroupName.label'),
                        placeholder: t('credentialsForm.baseDomainResourceGroupName.placeholder'),
                        labelHelp: t('credentialsForm.baseDomainResourceGroupName.labelHelp'),
                        value: baseDomainResourceGroupName,
                        onChange: setBaseDomainResourceGroupName,
                        isRequired: true,
                    },
                    {
                        id: 'clientId',
                        isHidden: credentialsType !== Provider.azure,
                        type: 'Text',
                        label: t('credentialsForm.clientId.label'),
                        placeholder: t('credentialsForm.clientId.placeholder'),
                        labelHelp: t('credentialsForm.clientId.labelHelp'),
                        value: clientId,
                        onChange: setClientId,
                        isRequired: true,
                    },
                    {
                        id: 'clientSecret',
                        isHidden: credentialsType !== Provider.azure,
                        type: 'Text',
                        label: t('credentialsForm.clientSecret.label'),
                        placeholder: t('credentialsForm.clientSecret.placeholder'),
                        labelHelp: t('credentialsForm.clientSecret.labelHelp'),
                        isRequired: true,
                        value: clientSecret,
                        onChange: setClientSecret,
                        isSecret: true,
                    },
                    {
                        id: 'subscriptionId',
                        isHidden: credentialsType !== Provider.azure,
                        type: 'Text',
                        label: t('credentialsForm.subscriptionId.label'),
                        placeholder: t('credentialsForm.subscriptionId.placeholder'),
                        labelHelp: t('credentialsForm.subscriptionId.labelHelp'),
                        value: subscriptionId,
                        onChange: setSubscriptionId,
                        isRequired: true,
                    },
                    {
                        id: 'tenantId',
                        isHidden: credentialsType !== Provider.azure,
                        type: 'Text',
                        label: t('credentialsForm.tenantId.label'),
                        placeholder: t('credentialsForm.tenantId.placeholder'),
                        labelHelp: t('credentialsForm.tenantId.labelHelp'),
                        value: tenantId,
                        onChange: setTenantId,
                        isRequired: true,
                    },
                ],
            },
            {
                type: 'Section',
                title: t('credentialsForm.vCenter.title'),
                wizardTitle: t('credentialsForm.vCenter.wizardTitle'),
                description: (
                    <a href={DOC_LINKS.CREATE_CONNECTION_VMWARE} target="_blank" rel="noreferrer">
                        {t('credentialsForm.vCenter.wizardDescription')}
                    </a>
                ),
                inputs: [
                    {
                        id: 'vCenter',
                        isHidden: credentialsType !== Provider.vmware,
                        type: 'Text',
                        label: t('credentialsForm.vCenter.label'),
                        placeholder: t('credentialsForm.vCenter.placeholder'),
                        labelHelp: t('credentialsForm.vCenter.labelHelp'),
                        value: vCenter,
                        onChange: setVcenter,
                        isRequired: true,
                    },
                    {
                        id: 'username',
                        isHidden: credentialsType !== Provider.vmware,
                        type: 'Text',
                        label: t('credentialsForm.username.label'),
                        placeholder: t('credentialsForm.username.placeholder'),
                        labelHelp: t('credentialsForm.username.labelHelp'),
                        value: username,
                        onChange: setUsername,
                        isRequired: true,
                    },
                    {
                        id: 'password',
                        isHidden: credentialsType !== Provider.vmware,
                        type: 'Text',
                        label: t('credentialsForm.password.label'),
                        placeholder: t('credentialsForm.password.placeholder'),
                        labelHelp: t('credentialsForm.password.labelHelp'),
                        value: password,
                        onChange: setPassword,
                        isRequired: true,
                        isSecret: true,
                    },
                    {
                        id: 'cacertificate',
                        isHidden: credentialsType !== Provider.vmware,
                        type: 'TextArea',
                        label: t('credentialsForm.cacertificate.label'),
                        placeholder: t('credentialsForm.cacertificate.placeholder'),
                        labelHelp: t('credentialsForm.cacertificate.labelHelp'),
                        value: cacertificate,
                        onChange: setCacertificate,
                        validation: (value) => validateCertificate(value, t),
                        isRequired: true,
                    },
                    {
                        id: 'cluster',
                        isHidden: credentialsType !== Provider.vmware,
                        type: 'Text',
                        label: t('credentialsForm.cluster.label'),
                        placeholder: t('credentialsForm.cluster.placeholder'),
                        labelHelp: t('credentialsForm.cluster.labelHelp'),
                        value: cluster,
                        onChange: setVmClusterName,
                        isRequired: true,
                    },
                    {
                        id: 'datacenter',
                        isHidden: credentialsType !== Provider.vmware,
                        type: 'Text',
                        label: t('credentialsForm.datacenter.label'),
                        placeholder: t('credentialsForm.datacenter.placeholder'),
                        labelHelp: t('credentialsForm.datacenter.labelHelp'),
                        value: datacenter,
                        onChange: setDatacenter,
                        isRequired: true,
                    },
                    {
                        id: 'defaultDatastore',
                        isHidden: credentialsType !== Provider.vmware,
                        type: 'Text',
                        label: t('credentialsForm.defaultDatastore.label'),
                        placeholder: t('credentialsForm.defaultDatastore.placeholder'),
                        labelHelp: t('credentialsForm.defaultDatastore.labelHelp'),
                        value: defaultDatastore,
                        onChange: setDatastore,
                        isRequired: true,
                    },
                ],
            },
            {
                type: 'Section',
                title: t('credentialsForm.openStackCredentials.title'),
                wizardTitle: t('credentialsForm.openStackCredentials.wizardTitle'),
                description: (
                    <a href={DOC_LINKS.CREATE_CONNECTION_OPENSTACK} target="_blank" rel="noreferrer">
                        {t('credentialsForm.openStackCredentials.wizardDescription')}
                    </a>
                ),
                inputs: [
                    {
                        id: 'clouds.yaml',
                        isHidden: credentialsType !== Provider.openstack,
                        type: 'TextArea',
                        label: t('credentialsForm.clouds.yaml.label'),
                        placeholder: t('credentialsForm.clouds.yaml.placeholder'),
                        labelHelp: t('credentialsForm.clouds.yaml.labelHelp'),
                        value: cloudsYaml,
                        onChange: setOpenstackCloudsYaml,
                        isRequired: true,
                        isSecret: true,
                        validation: (value) => validateCloudsYaml(value, cloud, t),
                    },
                    {
                        id: 'cloud',
                        isHidden: credentialsType !== Provider.openstack,
                        type: 'Text',
                        label: t('credentialsForm.cloud.label'),
                        placeholder: t('credentialsForm.cloud.placeholder'),
                        labelHelp: t('credentialsForm.cloud.labelHelp'),
                        value: cloud,
                        onChange: setOpenstackCloud,
                        isRequired: true,
                    },
                ],
            },
            {
                type: 'Section',
                title: t('credentialsForm.bareMetalCredentials.title'),
                wizardTitle: t('credentialsForm.bareMetalCredentials.wizardTitle'),
                description: (
                    <a href={DOC_LINKS.CREATE_CONNECTION_BAREMETAL} target="_blank" rel="noreferrer">
                        {t('credentialsForm.bareMetalCredentials.wizardDescription')}
                    </a>
                ),
                inputs: [
                    {
                        id: 'libvirtURI',
                        isHidden: credentialsType !== Provider.baremetal,
                        type: 'Text',
                        label: t('credentialsForm.libvirtURI.label'),
                        placeholder: t('credentialsForm.libvirtURI.placeholder'),
                        labelHelp: t('credentialsForm.libvirtURI.labelHelp'),
                        value: libvirtURI,
                        onChange: setLibvirtURI,
                        validation: (value) => validateLibvirtURI(value, t),
                        isRequired: true,
                    },
                    {
                        id: 'sshKnownHosts',
                        isHidden: credentialsType !== Provider.baremetal,
                        type: 'TextArea',
                        label: t('credentialsForm.sshKnownHosts.label'),
                        placeholder: t('credentialsForm.sshKnownHosts.placeholder'),
                        labelHelp: t('credentialsForm.sshKnownHosts.labelHelp'),
                        value: sshKnownHosts,
                        onChange: setSshKnownHosts,
                        isRequired: true,
                    },
                ],
            },
            {
                type: 'Section',
                title: t('credentialsForm.bareMetalDisconnected.title'),
                wizardTitle: t('credentialsForm.bareMetalDisconnected.wizardTitle'),
                description: (
                    <a href={DOC_LINKS.CREATE_CONNECTION_BAREMETAL} target="_blank" rel="noreferrer">
                        {t('credentialsForm.bareMetalDisconnected.wizardDescription')}
                    </a>
                ),
                inputs: [
                    {
                        id: 'imageMirror',
                        isHidden: credentialsType !== Provider.baremetal,
                        type: 'Text',
                        label: t('credentialsForm.imageMirror.label'),
                        placeholder: t('credentialsForm.imageMirror.placeholder'),
                        labelHelp: t('credentialsForm.imageMirror.labelHelp'),
                        value: imageMirror,
                        onChange: setImageMirror,
                        validation: (value) => validateImageMirror(value, t),
                    },
                    {
                        id: 'bootstrapOSImage',
                        isHidden: credentialsType !== Provider.baremetal,
                        type: 'Text',
                        label: t('credentialsForm.bootstrapOSImage.label'),
                        placeholder: t('credentialsForm.bootstrapOSImage.placeholder'),
                        labelHelp: t('credentialsForm.bootstrapOSImage.labelHelp'),
                        value: bootstrapOSImage,
                        onChange: setBootstrapOSImage,
                        validation: (value) => validateBareMetalOSImageURL(value, t),
                    },
                    {
                        id: 'clusterOSImage',
                        isHidden: credentialsType !== Provider.baremetal,
                        type: 'Text',
                        label: t('credentialsForm.clusterOSImage.label'),
                        placeholder: t('credentialsForm.clusterOSImage.placeholder'),
                        labelHelp: t('credentialsForm.clusterOSImage.labelHelp'),
                        value: clusterOSImage,
                        onChange: setClusterOSImage,
                        validation: (value) => validateBareMetalOSImageURL(value, t),
                    },
                    {
                        id: 'additionalTrustBundle',
                        isHidden: credentialsType !== Provider.baremetal,
                        type: 'TextArea',
                        label: t('credentialsForm.additionalTrustBundle.label'),
                        placeholder: t('credentialsForm.additionalTrustBundle.placeholder'),
                        labelHelp: t('credentialsForm.additionalTrustBundle.labelHelp'),
                        value: additionalTrustBundle,
                        onChange: setAdditionalTrustBundle,
                    },
                ],
            },
            {
                type: 'Section',
                title: t('credentialsForm.ansibleCredentials.title'),
                wizardTitle: t('credentialsForm.ansibleCredentials.wizardTitle'),
                description: (
                    <a href={DOC_LINKS._ANSIBLE} target="_blank" rel="noreferrer">
                        {t('credentialsForm.ansibleCredentials.wizardDescription')}
                    </a>
                ),
                inputs: [
                    {
                        id: 'ansibleHost',
                        isHidden: credentialsType !== Provider.ansible,
                        type: 'Text',
                        label: t('credentialsForm.ansibleHost.label'),
                        placeholder: t('credentialsForm.ansibleHost.placeholder'),
                        // labelHelp: t('credentialsForm.ansibleHost.labelHelp'), // TODO
                        value: ansibleHost,
                        onChange: setAnsibleHost,
                        isRequired: true,
                    },
                    {
                        id: 'ansibleToken',
                        isHidden: credentialsType !== Provider.ansible,
                        type: 'Text',
                        label: t('credentialsForm.ansibleToken.label'),
                        placeholder: t('credentialsForm.ansibleToken.placeholder'),
                        // labelHelp: t('credentialsForm.ansibleToken.labelHelp'), // TODO
                        value: ansibleToken,
                        onChange: setAnsibleToken,
                        isRequired: true,
                        isSecret: true,
                    },
                ],
            },
            {
                type: 'Section',
                title: t('credentialsForm.openshiftCredentials.title'),
                wizardTitle: t('credentialsForm.openshiftCredentials.wizardTitle'),
                description: (
                    <a href={DOC_LINKS.CREATE_CONNECTION_REDHATCLOUD} target="_blank" rel="noreferrer">
                        {t('credentialsForm.openshiftCredentials.wizardDescription')}
                    </a>
                ),
                inputs: [
                    {
                        id: 'ocmAPIToken',
                        isHidden: credentialsType !== Provider.redhatcloud,
                        type: 'Text',
                        label: t('credentialsForm.ocmapitoken.label'),
                        placeholder: t('credentialsForm.ocmapitoken.placeholder'),
                        value: ocmAPIToken,
                        onChange: setOcmAPIToken,
                        isRequired: true,
                        isSecret: true,
                    },
                ],
            },
            {
                type: 'Section',
                title: t('credentialsForm.pullSecret.title'),
                wizardTitle: t('credentialsForm.pullSecret.wizardTitle'),
                description: (
                    <a href={DOC_LINKS.CREATE_CONNECTION} target="_blank" rel="noreferrer">
                        {t('credentialsForm.pullSecret.wizardDescription')}
                    </a>
                ),
                inputs: [
                    {
                        id: 'pullSecret',
                        isHidden: ![
                            Provider.aws,
                            Provider.azure,
                            Provider.baremetal,
                            Provider.gcp,
                            Provider.openstack,
                            Provider.vmware,
                        ].includes(credentialsType as Provider),
                        type: 'TextArea',
                        label: t('credentialsForm.pullSecret.label'),
                        placeholder: t('credentialsForm.pullSecret.placeholder'),
                        labelHelp: t('credentialsForm.pullSecret.labelHelp'),
                        value: pullSecret,
                        onChange: setPullSecret,
                        validation: (value) => validateJSON(value, t),
                        isRequired: true,
                        isSecret: true,
                    },
                    {
                        id: 'ssh-privatekey',
                        isHidden: ![
                            Provider.aws,
                            Provider.azure,
                            Provider.baremetal,
                            Provider.gcp,
                            Provider.openstack,
                            Provider.vmware,
                        ].includes(credentialsType as Provider),
                        type: 'TextArea',
                        label: t('credentialsForm.sshPrivateKey.label'),
                        placeholder: t('credentialsForm.sshPrivateKey.placeholder'),
                        labelHelp: t('credentialsForm.sshPrivateKey.labelHelp'),
                        value: sshPrivatekey,
                        onChange: setSshPrivatekey,
                        validation: (value) => validatePrivateSshKey(value, t),
                        isRequired: true,
                        isSecret: true,
                    },
                    {
                        id: 'ssh-publickey',
                        isHidden: ![
                            Provider.aws,
                            Provider.azure,
                            Provider.baremetal,
                            Provider.gcp,
                            Provider.openstack,
                            Provider.vmware,
                        ].includes(credentialsType as Provider),
                        type: 'TextArea',
                        label: t('credentialsForm.sshPublicKey.label'),
                        placeholder: t('credentialsForm.sshPublicKey.placeholder'),
                        labelHelp: t('credentialsForm.sshPublicKey.labelHelp'),
                        value: sshPublickey,
                        onChange: setSshPublickey,
                        validation: (value) => validatePublicSshKey(value, t),
                        isRequired: true,
                        isSecret: true,
                    },
                ],
            },
        ],
        submit: () => {
            if (isEditing) {
                const secret = stateToData() as Secret
                const patch: { op: 'replace'; path: string; value: unknown }[] = []
                if (secret.stringData) {
                    patch.push({ op: 'replace', path: `/stringData`, value: secret.stringData })
                }
                return patchResource(secret, patch).promise.then(() => {
                    toastContext.addAlert({
                        title: t('credentialsForm.updated.title'),
                        message: t('credentialsForm.updated.message', { name }),
                        type: 'success',
                        autoClose: true,
                    })
                    history.push(NavigationPath.credentials)
                })
            } else {
                return createResource(stateToData() as IResource).promise.then(() => {
                    toastContext.addAlert({
                        title: t('credentialsForm.created.title'),
                        message: t('credentialsForm.created.message', { name }),
                        type: 'success',
                        autoClose: true,
                    })
                    history.push(NavigationPath.credentials)
                })
            }
        },
        submitText: isEditing ? t('credentialsForm.submitButton.save') : t('credentialsForm.submitButton.add'),
        submittingText: isEditing ? t('credentialsForm.submitButton.saving') : t('credentialsForm.submitButton.adding'),
        reviewTitle: t('common:wizard.review.title'),
        reviewDescription: t('common:wizard.review.description'),
        cancelLabel: t('common:cancel'),
        nextLabel: t('common:next'),
        backLabel: t('common:back'),
        cancel: () => history.push(NavigationPath.credentials),
        stateToData,
    }
    return (
        <AcmDataFormPage
            formData={formData}
            mode={isViewing ? 'details' : isEditing ? 'form' : 'wizard'}
            edit={() => {
                if (providerConnection) {
                    history.push(
                        NavigationPath.editCredentials
                            .replace(':namespace', providerConnection.metadata.namespace!)
                            .replace(':name', providerConnection.metadata.name!)
                    )
                }
            }}
        />
    )
}
