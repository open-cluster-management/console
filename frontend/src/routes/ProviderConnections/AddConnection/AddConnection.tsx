import React, { useContext, useEffect, useState } from 'react'
import {
    AcmAlertContext,
    AcmAlertGroup,
    AcmAlertProvider,
    AcmButton,
    AcmEmptyState,
    AcmForm,
    AcmLoadingPage,
    AcmPageCard,
    AcmPageHeader,
    AcmSelect,
    AcmSubmit,
    AcmTextInput,
    AcmInlineProvider,
    Provider,
} from '@open-cluster-management/ui-components'
import { AcmTextArea } from '@open-cluster-management/ui-components/lib/AcmTextArea/AcmTextArea'
import { ActionGroup, Button, Page, SelectOption, Title } from '@patternfly/react-core'
import { useTranslation } from 'react-i18next'
import { RouteComponentProps, useHistory } from 'react-router-dom'
import { ErrorPage } from '../../../components/ErrorPage'
import { ProviderID, providers } from '../../../lib/providers'
import { IRequestResult } from '../../../lib/resource-request'
import {
    validateBaseDnsName,
    validateCertificate,
    validateGCProjectID,
    validateImageMirror,
    validateJSON,
    validateKubernetesDnsName,
    validateLibvirtURI,
    validatePrivateSshKey,
    validatePublicSshKey,
} from '../../../lib/validation'
import { NavigationPath } from '../../../NavigationPath'
import { listProjects, Project } from '../../../resources/project'
import {
    createProviderConnection,
    getProviderConnection,
    getProviderConnectionProviderID,
    ProviderConnection,
    ProviderConnectionApiVersion,
    ProviderConnectionKind,
    replaceProviderConnection,
    setProviderConnectionProviderID,
} from '../../../resources/provider-connection'
import { AppContext } from '../../../components/AppContext'
import { rbacNamespaceFilter } from '../../../resources/self-subject-access-review'
import { makeStyles } from '@material-ui/styles'
import { DOC_LINKS } from '../../../lib/doc-util'

export default function AddConnectionPage({ match }: RouteComponentProps<{ namespace: string; name: string }>) {
    const { t } = useTranslation(['connection'])
    return (
        <AcmAlertProvider>
            <Page>
                {match?.params.namespace ? (
                    <AcmPageHeader
                        title={t('editConnection.title')}
                        titleTooltip={
                            <>
                                {t('addConnection.title.tooltip')}
                                <a
                                    href={DOC_LINKS.CREATE_CONNECTION}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ display: 'block', marginTop: '4px' }}
                                >
                                    {t('common:learn.more')}
                                </a>
                            </>
                        }
                        breadcrumb={[
                            { text: t('connections'), to: NavigationPath.providerConnections },
                            { text: t('editConnection.title'), to: '' },
                        ]}
                    />
                ) : (
                    <AcmPageHeader
                        title={t('addConnection.title')}
                        titleTooltip={
                            <>
                                {t('addConnection.title.tooltip')}
                                <a
                                    href={DOC_LINKS.CREATE_CONNECTION}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ display: 'block', marginTop: '4px' }}
                                >
                                    {t('common:learn.more')}
                                </a>
                            </>
                        }
                        breadcrumb={[
                            { text: t('connections'), to: NavigationPath.providerConnections },
                            { text: t('addConnection.title'), to: '' },
                        ]}
                    />
                )}
                <AddConnectionPageData namespace={match?.params.namespace} name={match?.params.name} />
            </Page>
        </AcmAlertProvider>
    )
}

export function AddConnectionPageData(props: { namespace: string; name: string }) {
    const { t } = useTranslation(['connection', 'common'])
    const [projects, setProjects] = useState<string[]>([])
    const [error, setError] = useState<Error>()
    const [retry, setRetry] = useState(0)
    const [isLoading, setIsLoading] = useState<boolean>(true)

    const [providerConnection, setProviderConnection] = useState<ProviderConnection>({
        apiVersion: ProviderConnectionApiVersion,
        kind: ProviderConnectionKind,
        metadata: {
            name: '',
            namespace: '',
        },
        spec: {
            awsAccessKeyID: '',
            awsSecretAccessKeyID: '',

            baseDomainResourceGroupName: '',
            clientId: '',
            clientsecret: '',
            subscriptionid: '',
            tenantid: '',

            gcProjectID: '',
            gcServiceAccountKey: '',

            username: '',
            password: '',
            vcenter: '',
            cacertificate: '',
            vmClusterName: '',
            datacenter: '',
            datastore: '',

            libvirtURI: '',
            sshKnownHosts: '',
            imageMirror: '',
            bootstrapOSImage: '',
            clusterOSImage: '',
            additionalTrustBundle: '',

            baseDomain: '',
            pullSecret: '',
            sshPrivatekey: '',
            sshPublickey: '',
        },
    })

    useEffect(() => {
        setError(undefined)
        setProjects([])
        setIsLoading(true)
    }, [retry])

    // create connection
    useEffect(() => {
        if (!props.namespace) {
            const result = listProjects()
            result.promise
                .then(async (projects) => {
                    const namespaces = projects!.map((project) => project.metadata.name!)
                    await rbacNamespaceFilter('secret.create', namespaces).then(setProjects).catch(setError)
                })
                .catch(setError)
                .finally(() => setIsLoading(false))
            return result.abort
        }
    }, [props.namespace])

    // edit connection
    useEffect(() => {
        if (props.name) {
            setProjects([props.namespace])
            const result = getProviderConnection(props)
            result.promise
                .then((providerConnection) => {
                    setProviderConnection(providerConnection)
                })
                .catch(setError)
                .finally(() => setIsLoading(false))
            return result.abort
        }
    }, [retry, props])

    if (error) {
        return (
            <ErrorPage
                error={error}
                actions={
                    <AcmButton
                        onClick={() => {
                            setRetry(retry + 1)
                        }}
                    >
                        {t('common:retry')}
                    </AcmButton>
                }
            />
        )
    }
    if (isLoading) {
        return <AcmLoadingPage />
    }

    if (projects.length === 0) {
        return (
            <AcmPageCard>
                <AcmEmptyState
                    title={t('common:rbac.title.unauthorized')}
                    message={t('common:rbac.namespaces.unauthorized')}
                    showIcon={false}
                />
            </AcmPageCard>
        )
    }

    return <AddConnectionPageContent providerConnection={providerConnection} projects={projects} />
}

const useStyles = makeStyles({
    providerSelect: {
        '& .pf-c-select__toggle-text': {
            padding: '4px 0',
        },
    },
})

export function AddConnectionPageContent(props: { providerConnection: ProviderConnection; projects: string[] }) {
    const { t } = useTranslation(['connection'])
    const history = useHistory()
    const { featureGates } = useContext(AppContext)

    const isEditing = () => props.providerConnection.metadata.name !== ''
    const alertContext = useContext(AcmAlertContext)

    const [providerConnection, setProviderConnection] = useState<ProviderConnection>(
        JSON.parse(JSON.stringify(props.providerConnection))
    )
    // useEffect(() => {
    //     setProviderConnection(JSON.parse(JSON.stringify(props.providerConnection)))
    // }, [props.providerConnection])
    function updateProviderConnection(update: (providerConnection: ProviderConnection) => void) {
        const copy = { ...providerConnection }
        update(copy)
        setProviderConnection(copy)
    }

    const classes = useStyles()

    return (
        <AcmPageCard>
            <AcmForm>
                <Title headingLevel="h4" size="xl">
                    Select a provider and enter basic information
                </Title>
                <AcmSelect
                    className={classes.providerSelect}
                    id="providerName"
                    label={t('addConnection.providerName.label')}
                    placeholder={t('addConnection.providerName.placeholder')}
                    labelHelp={t('addConnection.providerName.labelHelp')}
                    value={getProviderConnectionProviderID(providerConnection)}
                    onChange={(providerID) => {
                        updateProviderConnection((providerConnection) => {
                            setProviderConnectionProviderID(providerConnection, providerID as ProviderID)
                        })
                    }}
                    isDisabled={isEditing()}
                    isRequired
                >
                    {providers
                        .filter((provider) => {
                            if (!featureGates['open-cluster-management-discovery'] && provider.key === ProviderID.CRH) {
                                return false // skip
                            }
                            return true
                        })
                        .map((provider) => {
                            let mappedProvider
                            switch (provider.key) {
                                case ProviderID.GCP:
                                    mappedProvider = Provider.gcp
                                    break
                                case ProviderID.AWS:
                                    mappedProvider = Provider.aws
                                    break
                                case ProviderID.AZR:
                                    mappedProvider = Provider.azure
                                    break
                                case ProviderID.VMW:
                                    mappedProvider = Provider.vmware
                                    break
                                case ProviderID.BMC:
                                    mappedProvider = Provider.baremetal
                                    break
                                case ProviderID.CRH:
                                    mappedProvider = Provider.redhatcloud
                                    break
                                case ProviderID.UKN:
                                default:
                                    mappedProvider = Provider.other
                            }
                            return (
                                <SelectOption key={provider.key} value={provider.key}>
                                    {/* {provider.name} */}
                                    <AcmInlineProvider provider={mappedProvider} />
                                </SelectOption>
                            )
                        })}
                </AcmSelect>
                <AcmTextInput
                    id="connectionName"
                    label={t('addConnection.connectionName.label')}
                    placeholder={t('addConnection.connectionName.placeholder')}
                    labelHelp={t('addConnection.connectionName.labelHelp')}
                    value={providerConnection.metadata.name}
                    onChange={(name) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.metadata.name = name
                        })
                    }}
                    validation={(value) => validateKubernetesDnsName(value, 'Connection name', t)}
                    isRequired
                    isDisabled={isEditing()}
                />
                <AcmSelect
                    id="namespaceName"
                    label={t('addConnection.namespaceName.label')}
                    placeholder={t('addConnection.namespaceName.placeholder')}
                    labelHelp={t('addConnection.namespaceName.labelHelp')}
                    value={providerConnection.metadata.namespace}
                    onChange={(namespace) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.metadata.namespace = namespace
                        })
                    }}
                    isRequired
                    isDisabled={isEditing()}
                    variant="typeahead"
                >
                    {props.projects.map((project) => (
                        <SelectOption key={project} value={project}>
                            {project}
                        </SelectOption>
                    ))}
                </AcmSelect>
                <Title headingLevel="h4" size="xl" hidden={!getProviderConnectionProviderID(providerConnection)}>
                    Configure your provider connection
                </Title>
                <AcmTextInput
                    id="baseDomain"
                    label={t('addConnection.baseDomain.label')}
                    placeholder={t('addConnection.baseDomain.placeholder')}
                    labelHelp={t('addConnection.baseDomain.labelHelp')}
                    value={providerConnection.spec?.baseDomain}
                    onChange={(baseDomain) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.baseDomain = baseDomain as string
                        })
                    }}
                    hidden={
                        !getProviderConnectionProviderID(providerConnection) ||
                        getProviderConnectionProviderID(providerConnection) === ProviderID.CRH
                    }
                    isRequired
                />
                <AcmTextInput
                    id="awsAccessKeyID"
                    label={t('addConnection.awsAccessKeyID.label')}
                    placeholder={t('addConnection.awsAccessKeyID.placeholder')}
                    labelHelp={t('addConnection.awsAccessKeyID.labelHelp')}
                    value={providerConnection.spec?.awsAccessKeyID}
                    onChange={(awsAccessKeyID) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.awsAccessKeyID = awsAccessKeyID
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.AWS}
                    isRequired
                />
                <AcmTextInput
                    id="awsSecretAccessKeyID"
                    label={t('addConnection.awsSecretAccessKeyID.label')}
                    placeholder={t('addConnection.awsSecretAccessKeyID.placeholder')}
                    labelHelp={t('addConnection.awsSecretAccessKeyID.labelHelp')}
                    value={providerConnection.spec?.awsSecretAccessKeyID}
                    onChange={(awsSecretAccessKeyID) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.awsSecretAccessKeyID = awsSecretAccessKeyID
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.AWS}
                    type="password"
                    isRequired
                />
                <AcmTextInput
                    id="baseDomainResourceGroupName"
                    label={t('addConnection.baseDomainResourceGroupName.label')}
                    placeholder={t('addConnection.baseDomainResourceGroupName.placeholder')}
                    labelHelp={t('addConnection.baseDomainResourceGroupName.labelHelp')}
                    value={providerConnection.spec?.baseDomainResourceGroupName}
                    onChange={(baseDomainResourceGroupName) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.baseDomainResourceGroupName = baseDomainResourceGroupName
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.AZR}
                    isRequired
                />
                <AcmTextInput
                    id="clientId"
                    label={t('addConnection.clientId.label')}
                    placeholder={t('addConnection.clientId.placeholder')}
                    labelHelp={t('addConnection.clientId.labelHelp')}
                    value={providerConnection.spec?.clientId}
                    onChange={(clientId) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.clientId = clientId
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.AZR}
                    isRequired
                />
                <AcmTextInput
                    id="clientsecret"
                    label={t('addConnection.clientsecret.label')}
                    placeholder={t('addConnection.clientsecret.placeholder')}
                    labelHelp={t('addConnection.clientsecret.labelHelp')}
                    value={providerConnection.spec?.clientsecret}
                    onChange={(clientsecret) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.clientsecret = clientsecret
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.AZR}
                    type="password"
                    isRequired
                />
                <AcmTextInput
                    id="subscriptionid"
                    label={t('addConnection.subscriptionid.label')}
                    placeholder={t('addConnection.subscriptionid.placeholder')}
                    labelHelp={t('addConnection.subscriptionid.labelHelp')}
                    value={providerConnection.spec?.subscriptionid}
                    onChange={(subscriptionid) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.subscriptionid = subscriptionid
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.AZR}
                    isRequired
                />
                <AcmTextInput
                    id="tenantid"
                    label={t('addConnection.tenantid.label')}
                    placeholder={t('addConnection.tenantid.placeholder')}
                    labelHelp={t('addConnection.tenantid.labelHelp')}
                    value={providerConnection.spec?.tenantid}
                    onChange={(tenantid) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.tenantid = tenantid
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.AZR}
                    isRequired
                />
                <AcmTextInput
                    id="gcProjectID"
                    label={t('addConnection.gcProjectID.label')}
                    placeholder={t('addConnection.gcProjectID.placeholder')}
                    labelHelp={t('addConnection.gcProjectID.labelHelp')}
                    value={providerConnection.spec?.gcProjectID}
                    onChange={(gcProjectID) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.gcProjectID = gcProjectID
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.GCP}
                    isRequired
                    validation={(value) => validateGCProjectID(value, t)}
                />
                <AcmTextArea
                    id="gcServiceAccountKey"
                    label={t('addConnection.gcServiceAccountKey.label')}
                    placeholder={t('addConnection.gcServiceAccountKey.placeholder')}
                    labelHelp={t('addConnection.gcServiceAccountKey.labelHelp')}
                    value={providerConnection.spec?.gcServiceAccountKey}
                    onChange={(gcServiceAccountKey) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.gcServiceAccountKey = gcServiceAccountKey
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.GCP}
                    isRequired
                    validation={(value) => validateJSON(value, t)}
                />
                <AcmTextInput
                    id="vcenter"
                    label={t('addConnection.vcenter.label')}
                    placeholder={t('addConnection.vcenter.placeholder')}
                    labelHelp={t('addConnection.vcenter.labelHelp')}
                    value={providerConnection.spec?.vcenter}
                    onChange={(vcenter) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.vcenter = vcenter
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.VMW}
                    isRequired
                />
                <AcmTextInput
                    id="username"
                    label={t('addConnection.username.label')}
                    placeholder={t('addConnection.username.placeholder')}
                    labelHelp={t('addConnection.username.labelHelp')}
                    value={providerConnection.spec?.username}
                    onChange={(username) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.username = username
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.VMW}
                    isRequired
                />
                <AcmTextInput
                    id="password"
                    label={t('addConnection.password.label')}
                    placeholder={t('addConnection.password.placeholder')}
                    labelHelp={t('addConnection.password.labelHelp')}
                    value={providerConnection.spec?.password}
                    onChange={(password) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.password = password
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.VMW}
                    type="password"
                    isRequired
                />
                <AcmTextArea
                    id="cacertificate"
                    label={t('addConnection.cacertificate.label')}
                    placeholder={t('addConnection.cacertificate.placeholder')}
                    labelHelp={t('addConnection.cacertificate.labelHelp')}
                    value={providerConnection.spec?.cacertificate}
                    onChange={(cacertificate) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.cacertificate = cacertificate
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.VMW}
                    isRequired
                    validation={(value) => validateCertificate(value, t)}
                />
                <AcmTextInput
                    id="vmClusterName"
                    label={t('addConnection.vmClusterName.label')}
                    placeholder={t('addConnection.vmClusterName.placeholder')}
                    labelHelp={t('addConnection.vmClusterName.labelHelp')}
                    value={providerConnection.spec?.vmClusterName}
                    onChange={(vmClusterName) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.vmClusterName = vmClusterName
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.VMW}
                    isRequired
                />
                <AcmTextInput
                    id="datacenter"
                    label={t('addConnection.datacenter.label')}
                    placeholder={t('addConnection.datacenter.placeholder')}
                    labelHelp={t('addConnection.datacenter.labelHelp')}
                    value={providerConnection.spec?.datacenter}
                    onChange={(datacenter) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.datacenter = datacenter
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.VMW}
                    isRequired
                />
                <AcmTextInput
                    id="datastore"
                    label={t('addConnection.datastore.label')}
                    placeholder={t('addConnection.datastore.placeholder')}
                    labelHelp={t('addConnection.datastore.labelHelp')}
                    value={providerConnection.spec?.datastore}
                    onChange={(datastore) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.datastore = datastore
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.VMW}
                    isRequired
                />
                <AcmTextInput
                    id="libvirtURI"
                    label={t('addConnection.libvirtURI.label')}
                    placeholder={t('addConnection.libvirtURI.placeholder')}
                    labelHelp={t('addConnection.libvirtURI.labelHelp')}
                    value={providerConnection.spec?.libvirtURI}
                    onChange={(libvirtURI) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.libvirtURI = libvirtURI
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.BMC}
                    isRequired
                    validation={(value) => validateLibvirtURI(value, t)}
                />
                <AcmTextArea
                    id="sshKnownHosts"
                    label={t('addConnection.sshKnownHosts.label')}
                    placeholder={t('addConnection.sshKnownHosts.placeholder')}
                    labelHelp={t('addConnection.sshKnownHosts.labelHelp')}
                    value={providerConnection.spec?.sshKnownHosts}
                    onChange={(sshKnownHosts) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.sshKnownHosts = sshKnownHosts
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.BMC}
                    isRequired
                />
                <AcmTextArea
                    id="pullSecret"
                    label={t('addConnection.pullSecret.label')}
                    placeholder={t('addConnection.pullSecret.placeholder')}
                    labelHelp={t('addConnection.pullSecret.labelHelp')}
                    value={providerConnection.spec?.pullSecret}
                    onChange={(pullSecret) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.pullSecret = pullSecret as string
                        })
                    }}
                    hidden={
                        !getProviderConnectionProviderID(providerConnection) ||
                        getProviderConnectionProviderID(providerConnection) === ProviderID.CRH
                    }
                    isRequired
                    validation={(value) => validateJSON(value, t)}
                />
                <AcmTextArea
                    id="sshPrivateKey"
                    label={t('addConnection.sshPrivateKey.label')}
                    placeholder={t('addConnection.sshPrivateKey.placeholder')}
                    labelHelp={t('addConnection.sshPrivateKey.labelHelp')}
                    resizeOrientation="vertical"
                    value={providerConnection.spec?.sshPrivatekey}
                    onChange={(sshPrivatekey) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.sshPrivatekey = sshPrivatekey as string
                        })
                    }}
                    hidden={
                        !getProviderConnectionProviderID(providerConnection) ||
                        getProviderConnectionProviderID(providerConnection) === ProviderID.CRH
                    }
                    validation={(value) => validatePrivateSshKey(value, t)}
                    isRequired
                />
                <AcmTextArea
                    id="sshPublicKey"
                    label={t('addConnection.sshPublicKey.label')}
                    placeholder={t('addConnection.sshPublicKey.placeholder')}
                    labelHelp={t('addConnection.sshPublicKey.labelHelp')}
                    resizeOrientation="vertical"
                    value={providerConnection.spec?.sshPublickey}
                    onChange={(sshPublickey) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.sshPublickey = sshPublickey as string
                        })
                    }}
                    hidden={
                        !getProviderConnectionProviderID(providerConnection) ||
                        getProviderConnectionProviderID(providerConnection) === ProviderID.CRH
                    }
                    validation={(value) => validatePublicSshKey(value, t)}
                    isRequired
                />
                <Title
                    headingLevel="h4"
                    size="xl"
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.BMC}
                >
                    Configure for disconnected installation
                </Title>
                <AcmTextInput
                    id="imageMirror"
                    label={t('addConnection.imageMirror.label')}
                    placeholder={t('addConnection.imageMirror.placeholder')}
                    labelHelp={t('addConnection.imageMirror.labelHelp')}
                    value={providerConnection.spec?.imageMirror}
                    onChange={(imageMirror) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.imageMirror = imageMirror as string
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.BMC}
                    validation={(value) => validateImageMirror(value, t)}
                />
                <AcmTextInput
                    id="bootstrapOSImage"
                    label={t('addConnection.bootstrapOSImage.label')}
                    placeholder={t('addConnection.bootstrapOSImage.placeholder')}
                    labelHelp={t('addConnection.bootstrapOSImage.labelHelp')}
                    value={providerConnection.spec?.bootstrapOSImage}
                    onChange={(bootstrapOSImage) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.bootstrapOSImage = bootstrapOSImage as string
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.BMC}
                />
                <AcmTextInput
                    id="clusterOSImage"
                    label={t('addConnection.clusterOSImage.label')}
                    placeholder={t('addConnection.clusterOSImage.placeholder')}
                    labelHelp={t('addConnection.clusterOSImage.labelHelp')}
                    value={providerConnection.spec?.clusterOSImage}
                    onChange={(clusterOSImage) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.clusterOSImage = clusterOSImage as string
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.BMC}
                />
                <AcmTextArea
                    id="additionalTrustBundle"
                    label={t('addConnection.additionalTrustBundle.label')}
                    placeholder={t('addConnection.additionalTrustBundle.placeholder')}
                    labelHelp={t('addConnection.additionalTrustBundle.labelHelp')}
                    value={providerConnection.spec?.additionalTrustBundle}
                    onChange={(additionalTrustBundle) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.additionalTrustBundle = additionalTrustBundle as string
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.BMC}
                    validation={(value) => (value ? validateCertificate(value, t) : undefined)}
                />
                <AcmTextArea
                    id="ocmAPIToken"
                    label={t('addConnection.ocmapitoken.label')}
                    placeholder={t('addConnection.ocmapitoken.placeholder')}
                    labelHelp={t('addConnection.ocmapitoken.labelHelp')}
                    value={providerConnection.spec?.ocmAPIToken}
                    onChange={(ocmAPIToken) => {
                        updateProviderConnection((providerConnection) => {
                            providerConnection.spec!.ocmAPIToken = ocmAPIToken as string
                        })
                    }}
                    hidden={getProviderConnectionProviderID(providerConnection) !== ProviderID.CRH}
                    isRequired
                    validation={(value) => validateBaseDnsName(value, t)}
                />
                <AcmAlertGroup isInline canClose />
                <ActionGroup>
                    <AcmSubmit
                        id="submit"
                        variant="primary"
                        onClick={() => {
                            const data = JSON.parse(JSON.stringify(providerConnection))
                            const providerID = getProviderConnectionProviderID(data)
                            if (providerID !== ProviderID.AWS) {
                                delete data.spec!.awsAccessKeyID
                                delete data.spec!.awsSecretAccessKeyID
                            }
                            if (providerID !== ProviderID.AZR) {
                                delete data.spec!.baseDomainResourceGroupName
                                delete data.spec!.clientId
                                delete data.spec!.clientsecret
                                delete data.spec!.subscriptionid
                                delete data.spec!.tenantid
                            }
                            if (providerID !== ProviderID.BMC) {
                                delete data.spec!.libvirtURI
                                delete data.spec!.sshKnownHosts
                                delete data.spec!.imageMirror
                                delete data.spec!.bootstrapOSImage
                                delete data.spec!.clusterOSImage
                                delete data.spec!.additionalTrustBundle
                            }
                            if (providerID !== ProviderID.GCP) {
                                delete data.spec!.gcProjectID
                                delete data.spec!.gcServiceAccountKey
                            }
                            if (providerID !== ProviderID.VMW) {
                                delete data.spec!.username
                                delete data.spec!.password
                                delete data.spec!.vcenter
                                delete data.spec!.cacertificate
                                delete data.spec!.vmClusterName
                                delete data.spec!.datacenter
                                delete data.spec!.datastore
                            }
                            if (providerID !== ProviderID.CRH) {
                                delete data.spec!.ocmAPIToken
                            }
                            delete data.data

                            alertContext.clearAlerts()
                            let result: IRequestResult<ProviderConnection>
                            if (isEditing()) {
                                result = replaceProviderConnection(data)
                            } else {
                                result = createProviderConnection(data)
                            }
                            return result.promise
                                .then(() => {
                                    history.push(NavigationPath.providerConnections)
                                })
                                .catch((err) => {
                                    /* istanbul ignore else */
                                    if (err instanceof Error) {
                                        alertContext.addAlert({
                                            type: 'danger',
                                            title: t('common:request.failed'),
                                            message: err.message,
                                        })
                                    }
                                })
                        }}
                        label={isEditing() ? t('addConnection.saveButton.label') : t('addConnection.addButton.label')}
                        processingLabel={
                            isEditing() ? t('addConnection.savingButton.label') : t('addConnection.addingButton.label')
                        }
                    />
                    <Button
                        variant="link"
                        onClick={
                            /* istanbul ignore next */ () => {
                                history.push(NavigationPath.providerConnections)
                            }
                        }
                    >
                        {t('addConnection.cancelButton.label')}
                    </Button>
                </ActionGroup>
            </AcmForm>
        </AcmPageCard>
    )
}
