import React, { useState, useEffect } from 'react'
import Axios, { AxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import {
    AcmInlineStatus,
    StatusType,
    AcmButton,
    AcmModal,
    AcmForm,
    AcmSubmit,
    AcmSelect,
    AcmAlert,
} from '@open-cluster-management/ui-components'
import {
    ButtonVariant,
    ModalVariant,
    ActionGroup,
    SelectOption,
    Text,
    AlertVariant,
    Title,
    Popover,
} from '@patternfly/react-core'
import { ArrowCircleUpIcon, ExternalLinkAltIcon } from '@patternfly/react-icons'
import { ClusterStatus, DistributionInfo } from '../lib/get-cluster'
import { createSubjectAccessReviews, rbacMapping } from '../resources/self-subject-access-review'
export const backendUrl = `${process.env.REACT_APP_BACKEND_HOST}${process.env.REACT_APP_BACKEND_PATH}`

export function StatusField(props: { status: ClusterStatus }) {
    const { t } = useTranslation(['cluster'])
    let type: StatusType
    switch (props.status) {
        case ClusterStatus.ready:
            type = StatusType.healthy
            break
        case ClusterStatus.needsapproval:
            type = StatusType.warning
            break
        case ClusterStatus.failed:
        case ClusterStatus.notaccepted:
        case ClusterStatus.offline:
            type = StatusType.danger
            break
        case ClusterStatus.creating:
        case ClusterStatus.destroying:
        case ClusterStatus.detaching:
            type = StatusType.progress
            break
        case ClusterStatus.detached:
            type = StatusType.detached
            break
        case ClusterStatus.pending:
        case ClusterStatus.pendingimport:
        default:
            type = StatusType.pending
    }

    return <AcmInlineStatus type={type} status={t(`status.${props.status}`)} />
}

export function DistributionField(props: {
    clusterName: string
    data: DistributionInfo | undefined
    clusterStatus: ClusterStatus
    consoleURL?: string
}) {
    const { t } = useTranslation(['cluster'])
    const [open, toggleOpen] = useState<boolean>(false)
    const toggle = () => toggleOpen(!open)
    const [hasUpgradePermission, setHasUpgradePermission] = useState<boolean>(false)
    useEffect(() => {
        // if no available upgrades, skipping permission check
        if (
            !(props.data?.ocp?.availableUpdates?.length || -1 > 0) || // has no available upgrades
            (props.data?.ocp?.desiredVersion &&
                props.data?.ocp?.version &&
                props.data.ocp?.desiredVersion !== props.data.ocp?.version) // upgrading
        ) {
            return
        }
        // check if the user is allowed to upgrade the cluster
        const request = createSubjectAccessReviews(rbacMapping('cluster.upgrade', props.clusterName, props.clusterName))
        request.promise
            .then((results) => {
                if (results) {
                    let rbacQueryResults: boolean[] = []
                    results.forEach((result) => {
                        if (result.status === 'fulfilled') {
                            rbacQueryResults.push(result.value.status?.allowed!)
                        }
                    })
                    if (!rbacQueryResults.includes(false)) {
                        setHasUpgradePermission(true)
                    }
                }
            })
            .catch((err) => console.error(err))
    }, [
        props.clusterName,
        props.data?.ocp?.availableUpdates?.length,
        props.data?.ocp?.version,
        props.data?.ocp?.desiredVersion,
    ])

    if (!props.data) return <>-</>
    // use display version directly for non-online clusters
    if (props.clusterStatus !== ClusterStatus.ready) {
        return <>{props.data.displayVersion ?? '-'}</>
    }
    if (props.data.ocp?.upgradeFailed && props.data.ocp?.desiredVersion !== props.data.ocp?.version) {
        return (
            <>
                <div>{props.data.displayVersion}</div>
                <AcmInlineStatus
                    type={StatusType.danger}
                    status={
                        props.consoleURL ? (
                            <Popover
                                hasAutoWidth
                                headerContent={t('upgrade.upgradefailed', { version: props.data.ocp?.desiredVersion })}
                                bodyContent={t('upgrade.upgradefailed.message', {
                                    clusterName: props.clusterName,
                                    version: props.data.ocp?.desiredVersion,
                                })}
                                footerContent={
                                    <a href={`${props.consoleURL}/settings/cluster`} target="_blank" rel="noreferrer">
                                        {t('upgrade.upgrading.link')} <ExternalLinkAltIcon />
                                    </a>
                                }
                            >
                                <AcmButton variant="link" style={{ padding: 0, fontSize: '14px' }}>
                                    {t('upgrade.upgradefailed')}
                                </AcmButton>
                            </Popover>
                        ) : (
                            t('upgrade.upgradefailed', { version: props.data.ocp?.desiredVersion })
                        )
                    }
                />
            </>
        )
    } else if (
        props.data.ocp?.desiredVersion &&
        props.data.ocp?.version &&
        props.data.ocp?.desiredVersion !== props.data.ocp?.version
    ) {
        return (
            <>
                <div>{props.data.displayVersion}</div>
                <AcmInlineStatus
                    type={StatusType.progress}
                    status={
                        props.consoleURL ? (
                            <Popover
                                hasAutoWidth
                                headerContent={t('upgrade.upgrading', { version: props.data.ocp?.desiredVersion })}
                                bodyContent={t('upgrade.upgrading.message', {
                                    clusterName: props.clusterName,
                                    version: props.data.ocp?.desiredVersion,
                                })}
                                footerContent={
                                    <a href={`${props.consoleURL}/settings/cluster`} target="_blank" rel="noreferrer">
                                        {t('upgrade.upgrading.link')} <ExternalLinkAltIcon />
                                    </a>
                                }
                            >
                                <AcmButton variant="link" style={{ padding: 0, fontSize: '14px' }}>
                                    {t('upgrade.upgrading.version', { version: props.data.ocp?.desiredVersion })}
                                </AcmButton>
                            </Popover>
                        ) : (
                            t('upgrade.upgrading.version', { version: props.data.ocp?.desiredVersion })
                        )
                    }
                    // status={t('upgrade.upgrading', { version: props.data.ocp?.desiredVersion })}
                />
            </>
        )
    } else if (props.data.ocp?.availableUpdates && props.data.ocp?.availableUpdates?.length > 0) {
        return (
            <>
                <div>{props.data?.displayVersion}</div>
                <span style={{ whiteSpace: 'nowrap', display: 'block' }}>
                    <AcmButton
                        isDisabled={!hasUpgradePermission}
                        tooltip={t('common:rbac.unauthorized')}
                        onClick={toggle}
                        icon={<ArrowCircleUpIcon />}
                        variant={ButtonVariant.link}
                        style={{ padding: 0, margin: 0, fontSize: '14px' }}
                    >
                        {t('upgrade.available')}
                    </AcmButton>
                    <UpgradeModal close={toggle} open={open} clusterName={props.clusterName} data={props.data} />
                </span>
            </>
        )
    } else {
        return <>{props.data.displayVersion ?? '-'}</>
    }
}

export function UpgradeModal(props: {
    close: () => void
    open: boolean
    clusterName: string
    data: DistributionInfo | undefined
}): JSX.Element {
    const { t } = useTranslation(['cluster'])
    const [selectVersion, setSelectVersion] = useState<string>()
    const [upgradeError, setUpgradeError] = useState<string>()
    const [loading, setLoading] = useState<boolean>(false)
    return (
        <AcmModal
            variant={ModalVariant.small}
            isOpen={props.open}
            onClose={() => {
                setLoading(false)
                setSelectVersion('')
                setUpgradeError('')
                props.close()
            }}
            title={t('upgrade.title') + ' ' + props.clusterName}
        >
            <AcmForm>
                {upgradeError && (
                    <AcmAlert
                        title={t('upgrade.upgradefailed')}
                        subtitle={upgradeError}
                        variant={AlertVariant.danger}
                        isInline
                    />
                )}
                <Title headingLevel="h5" size="md">
                    {t('upgrade.current.version')}
                </Title>
                <Text>{props.data?.ocp?.version || props.data?.displayVersion}</Text>
                <AcmSelect
                    id="upgradeVersionSelect"
                    label={t('upgrade.select.label')}
                    maxHeight={'6em'}
                    placeholder={t('upgrade.select.placeholder')}
                    value={selectVersion}
                    onChange={(value) => {
                        setSelectVersion(value)
                        setUpgradeError('')
                    }}
                    isRequired
                >
                    {props.data?.ocp?.availableUpdates
                        .sort((a: string, b: string) => {
                            // basic sort semvers without preversion
                            const aVersion = a.split('.')
                            const bVersion = b.split('.')
                            for (let i = 0; i < Math.min(aVersion.length, bVersion.length); i++) {
                                if (aVersion[i] !== bVersion[i]) {
                                    return Number(bVersion[i]) - Number(aVersion[i])
                                }
                            }
                            return bVersion.length - aVersion.length
                        })
                        .map((version) => (
                            <SelectOption key={version} value={version}>
                                {version}
                            </SelectOption>
                        ))}
                </AcmSelect>

                <ActionGroup>
                    <AcmSubmit
                        label={t('upgrade.submit')}
                        processingLabel={t('upgrade.submit.processing')}
                        isLoading={loading}
                        onClick={() => {
                            if (loading) {
                                return
                            }
                            setLoading(true)
                            setUpgradeError('')
                            const url = backendUrl + '/upgrade'
                            return Axios.post(
                                url,
                                {
                                    clusterName: props.clusterName,
                                    version: selectVersion,
                                },
                                { withCredentials: true }
                            )
                                .then(() => {
                                    setLoading(false)
                                    setSelectVersion('')
                                    props.close()
                                })
                                .catch((reason: AxiosError) => {
                                    setLoading(false)
                                    setSelectVersion('')
                                    setUpgradeError(reason.message)
                                })
                        }}
                    >
                        {t('upgrade.submit')}
                    </AcmSubmit>
                    <AcmButton
                        onClick={() => {
                            setLoading(false)
                            setSelectVersion('')
                            setUpgradeError('')
                            props.close()
                        }}
                        variant={ButtonVariant.link}
                    >
                        {t('upgrade.cancel')}
                    </AcmButton>
                </ActionGroup>
            </AcmForm>
        </AcmModal>
    )
}
