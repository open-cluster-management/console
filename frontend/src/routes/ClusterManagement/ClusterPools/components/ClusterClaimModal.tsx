/* Copyright Contributors to the Open Cluster Management project */

import { useState, useEffect } from 'react'
import {
    AcmForm,
    AcmSubmit,
    AcmButton,
    AcmModal,
    AcmAlertGroup,
    AcmAlertContext,
    AcmTextInput,
} from '@open-cluster-management/ui-components'
import { useTranslation } from 'react-i18next'
import { useHistory } from 'react-router-dom'
import {
    ModalVariant,
    ActionGroup,
    DescriptionList,
    DescriptionListTerm,
    DescriptionListGroup,
    DescriptionListDescription,
} from '@patternfly/react-core'
import { ClusterPool } from '../../../../resources/cluster-pool'
import { ClusterClaim, ClusterClaimApiVersion, ClusterClaimKind } from '../../../../resources/cluster-claim'
import { createResource, getResource } from '../../../../lib/resource-request'
import { NavigationPath } from '../../../../NavigationPath'

export type ClusterClaimModalProps = {
    clusterPool?: ClusterPool
    onClose?: () => void
}

export function ClusterClaimModal(props: ClusterClaimModalProps) {
    const { t } = useTranslation(['cluster', 'common'])
    const history = useHistory()
    const [clusterClaim, setClusterClaim] = useState<ClusterClaim | undefined>()
    const [claimed, setClaimed] = useState<boolean>(false)

    useEffect(() => {
        if (props.clusterPool) {
            setClusterClaim({
                apiVersion: ClusterClaimApiVersion,
                kind: ClusterClaimKind,
                metadata: {
                    name: '',
                    namespace: props.clusterPool?.metadata.namespace,
                },
                spec: {
                    clusterPoolName: props.clusterPool?.metadata.name!,
                    lifetime: undefined,
                },
            })
        } else if (!props.clusterPool) {
            setClusterClaim(undefined)
        }
    }, [props.clusterPool])

    function updateClusterClaim(update: (clusterClaim: ClusterClaim) => void) {
        const copy = { ...clusterClaim } as ClusterClaim
        update(copy)
        setClusterClaim(copy)
    }

    function reset() {
        props.onClose?.()
        setClusterClaim(undefined)
    }

    function pollClaim(createdClaim: ClusterClaim) {
        let retries = 10
        const poll = async (resolve: any) => {
            if (retries === 0) {
                return resolve(undefined)
            }
            const request = await getResource(createdClaim).promise
            if (request?.spec?.namespace) {
                return resolve(request)
            } else {
                retries--
                setTimeout(() => poll(resolve), 500)
            }
        }
        return new Promise(poll)
    }

    if (!claimed) {
        return (
            <AcmModal
                variant={ModalVariant.medium}
                title={t('clusterClaim.create.title')}
                isOpen={!!props.clusterPool}
                onClose={props.onClose}
            >
                <AcmForm style={{ gap: 0 }}>
                    <AcmAlertContext.Consumer>
                        {(alertContext) => (
                            <>
                                <div>{t('clusterClaim.create.message')}</div>
                                &nbsp;
                                <DescriptionList isHorizontal isAutoColumnWidths>
                                    <DescriptionListGroup>
                                        <DescriptionListTerm>{t('clusterClaim.clusterPool.name')}</DescriptionListTerm>
                                        <DescriptionListDescription>
                                            {props.clusterPool?.metadata.name}
                                        </DescriptionListDescription>
                                    </DescriptionListGroup>
                                    <DescriptionListGroup>
                                        <DescriptionListTerm>
                                            {t('clusterClaim.clusterPool.namespace')}
                                        </DescriptionListTerm>
                                        <DescriptionListDescription>
                                            {clusterClaim?.metadata.namespace}
                                        </DescriptionListDescription>
                                    </DescriptionListGroup>
                                </DescriptionList>
                                &nbsp;
                                <AcmTextInput
                                    id="clusterClaimName"
                                    label={t('clusterClaim.name.label')}
                                    placeholder={t('clusterClaim.name.placeholder')}
                                    value={clusterClaim?.metadata.name}
                                    onChange={(name) => {
                                        updateClusterClaim((clusterClaim) => {
                                            clusterClaim.metadata.name = name
                                        })
                                    }}
                                    isRequired
                                />
                                &nbsp;
                                <AcmTextInput
                                    id="clusterClaimLifetime"
                                    label={t('clusterClaim.lifetime.label')}
                                    placeholder={t('clusterClaim.lifetime.placeholder')}
                                    labelHelp={t('clusterClaim.lifetime.tooltip')}
                                    value={clusterClaim?.spec?.lifetime}
                                    onChange={(lifetime) => {
                                        updateClusterClaim((clusterClaim) => {
                                            clusterClaim.spec!.lifetime = lifetime
                                        })
                                    }}
                                />
                                <AcmAlertGroup isInline canClose padTop />
                                <ActionGroup>
                                    <AcmSubmit
                                        id="claim"
                                        variant="primary"
                                        onClick={async () => {
                                            alertContext.clearAlerts()
                                            return new Promise(async (resolve, reject) => {
                                                const request = createResource(clusterClaim!)
                                                request.promise
                                                    .then(async (result) => {
                                                        const updatedClaim = (await pollClaim(result)) as ClusterClaim
                                                        if (updatedClaim) {
                                                            setClusterClaim(updatedClaim)
                                                            setClaimed(true)
                                                        } else {
                                                            alertContext.addAlert({
                                                                type: 'danger',
                                                                title: t('common:error'),
                                                                message: t('clusterClaim.create.timeOut'),
                                                            })
                                                        }
                                                        return resolve()
                                                    })
                                                    .catch((e) => {
                                                        if (e instanceof Error) {
                                                            alertContext.addAlert({
                                                                type: 'danger',
                                                                title: t('common:request.failed'),
                                                                message: e.message,
                                                            })
                                                            reject(e)
                                                        }
                                                    })
                                            })
                                        }}
                                        label={t('clusterClaim.create.button')}
                                        processingLabel={t('clusterClaim.modal.button.claiming')}
                                    />
                                    <AcmButton key="cancel" variant="link" onClick={props.onClose}>
                                        {t('common:cancel')}
                                    </AcmButton>
                                </ActionGroup>
                            </>
                        )}
                    </AcmAlertContext.Consumer>
                </AcmForm>
            </AcmModal>
        )
    } else {
        return (
            <AcmModal
                variant={ModalVariant.medium}
                title={t('clusterClaim.create.title.success')}
                isOpen={claimed}
                onClose={reset}
            >
                {t('clusterClaim.create.message.success')}
                &nbsp;
                <DescriptionList isHorizontal isAutoColumnWidths>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{t('clusterClaim.cluster.name')}</DescriptionListTerm>
                        <DescriptionListDescription>{clusterClaim?.spec!.namespace!}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{t('clusterClaim.clusterPool.name')}</DescriptionListTerm>
                        <DescriptionListDescription>{clusterClaim?.spec?.clusterPoolName!}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{t('clusterClaim.clusterPool.namespace')}</DescriptionListTerm>
                        <DescriptionListDescription>{clusterClaim?.metadata.namespace}</DescriptionListDescription>
                    </DescriptionListGroup>
                </DescriptionList>
                &nbsp;
                <ActionGroup>
                    <AcmButton
                        key="view-cluster"
                        variant="primary"
                        role="link"
                        onClick={() =>
                            history.push(NavigationPath.clusterOverview.replace(':id', clusterClaim!.spec!.namespace!))
                        }
                    >
                        {t('clusterClaim.modal.viewCluster')}
                    </AcmButton>
                    <AcmButton key="cancel" variant="link" onClick={reset}>
                        {t('common:close')}
                    </AcmButton>
                </ActionGroup>
            </AcmModal>
        )
    }
}
