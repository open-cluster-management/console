/* Copyright Contributors to the Open Cluster Management project */

import { V1CustomResourceDefinitionCondition } from '@kubernetes/client-node/dist/gen/model/v1CustomResourceDefinitionCondition'
import { AcmButton, AcmInlineStatus, StatusType } from '@open-cluster-management/ui-components'
import { ButtonVariant } from '@patternfly/react-core'
import { ArrowCircleUpIcon, ExternalLinkAltIcon } from '@patternfly/react-icons'
import { ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RbacButton } from '../../../../../components/Rbac'
import {
    checkCuratorLatestFailedOperation,
    checkCuratorLatestOperation,
    Cluster,
    ClusterStatus,
    CuratorCondition,
    getConditionStatusMessage,
} from '../../../../../lib/get-cluster'
import { rbacCreate, rbacPatch } from '../../../../../lib/rbac-util'
import { AnsibleJob, getLatestAnsibleJob } from '../../../../../resources/ansible-job'
import { ClusterCurator, ClusterCuratorDefinition } from '../../../../../resources/cluster-curator'
import { BatchUpgradeModal } from './BatchUpgradeModal'
import { useRecoilState } from 'recoil'
import { ansibleJobState } from '../../../../../atoms'

export const backendUrl = `${process.env.REACT_APP_BACKEND_PATH}`

export function DistributionField(props: {
    cluster?: Cluster
    clusterCurator?: ClusterCurator | undefined
}) {
    const { t } = useTranslation(['cluster'])
    const [open, toggleOpen] = useState<boolean>(false)
    const toggle = () => toggleOpen(!open)
    const clusterCurator = props.clusterCurator
    const [ansibleJobs] = useRecoilState(ansibleJobState)
    const ccConditions: V1CustomResourceDefinitionCondition[] = clusterCurator?.status?.conditions ?? []

    let latestAnsibleJob: { prehook: AnsibleJob | undefined; posthook: AnsibleJob | undefined }
    if (props.cluster?.namespace && ansibleJobs)
        latestAnsibleJob = getLatestAnsibleJob(ansibleJobs, props.cluster?.namespace)
    else latestAnsibleJob = { prehook: undefined, posthook: undefined }

    if (!props.cluster?.distribution) return <>-</>
    // use display version directly for non-online clusters

    // Pre/Post hook
    if (props.cluster?.distribution?.upgradeInfo?.isUpgradeCuration) {
        // hook state
        let statusType = StatusType.progress
        let statusTitle = checkCuratorLatestOperation(CuratorCondition.posthook, ccConditions)
            ? 'upgrade.ansible.posthookjob.title'
            : 'upgrade.ansible.prehookjob.title'
        let statusMessage = checkCuratorLatestOperation(CuratorCondition.posthook, ccConditions)
            ? 'upgrade.ansible.posthook'
            : 'upgrade.ansible.prehook'
        let footerContent: ReactNode | string = (
            <AcmButton
                onClick={() => window.open(latestAnsibleJob.prehook?.status?.ansibleJobResult?.url)}
                variant="link"
                role="link"
                icon={<ExternalLinkAltIcon />}
                iconPosition="right"
                isDisabled={!latestAnsibleJob.prehook?.status?.ansibleJobResult?.url}
            >
                {t('view.logs')}
            </AcmButton>
        )

        // if pre/post failed
        if (checkCuratorLatestFailedOperation(CuratorCondition.upgrade, ccConditions)) {
            statusType = StatusType.warning
            if (props.cluster?.distribution?.upgradeInfo?.prehooks.failed) {
                statusTitle = 'upgrade.ansible.prehookjob.title'
                statusMessage = 'upgrade.ansible.prehook.failure'
            } else {
                statusTitle = 'upgrade.ansible.posthookjob.title'
                statusMessage = 'upgrade.ansible.posthook.failure'
            }

            footerContent = getConditionStatusMessage(CuratorCondition.curatorjob, ccConditions) || ''
        }
        return (
            <>
                <div>{props.cluster?.distribution.displayVersion}</div>
                <AcmInlineStatus
                    type={statusType}
                    status={t(statusTitle)}
                    popover={{
                        headerContent: t(statusTitle),
                        bodyContent: t(statusMessage || ''),
                        footerContent: footerContent,
                    }}
                />
            </>
        )
    }
    if (props.cluster?.status !== ClusterStatus.ready) {
        return <>{props.cluster?.distribution.displayVersion ?? '-'}</>
    }
    if (props.cluster?.distribution.upgradeInfo.upgradeFailed) {
        // OCP UPGRADE FAILED
        return (
            <>
                <div>{props.cluster?.distribution.displayVersion}</div>
                <AcmInlineStatus
                    type={StatusType.danger}
                    status={t('upgrade.upgradefailed', {
                        version: props.cluster?.consoleURL
                            ? ''
                            : props.cluster?.distribution.upgradeInfo.desiredVersion,
                    })}
                    popover={
                        props.cluster?.consoleURL
                            ? {
                                  headerContent: t('upgrade.upgradefailed', {
                                      version: props.cluster?.distribution.upgradeInfo.desiredVersion,
                                  }),
                                  bodyContent: t('upgrade.upgradefailed.message', {
                                      clusterName: props.cluster?.name,
                                      version: props.cluster?.distribution.upgradeInfo.desiredVersion,
                                  }),
                                  footerContent: (
                                      <a
                                          href={`${props.cluster?.consoleURL}/settings/cluster`}
                                          target="_blank"
                                          rel="noreferrer"
                                      >
                                          {t('upgrade.upgrading.link')} <ExternalLinkAltIcon />
                                      </a>
                                  ),
                              }
                            : undefined
                    }
                />
            </>
        )
    } else if (props.cluster?.distribution.upgradeInfo.isUpgrading) {
        // OCP UPGRADE IN PROGRESS
        return (
            <>
                <div>{props.cluster?.distribution.displayVersion}</div>
                <AcmInlineStatus
                    type={StatusType.progress}
                    status={
                        t('upgrade.upgrading.version', {
                            version: props.cluster?.distribution.upgradeInfo.desiredVersion,
                        }) +
                        (props.cluster?.distribution.upgradeInfo.upgradePercentage
                            ? ' (' + props.cluster?.distribution.upgradeInfo.upgradePercentage + ')'
                            : '')
                    }
                    popover={
                        props.cluster?.consoleURL
                            ? {
                                  headerContent: t('upgrade.upgrading', {
                                      version: props.cluster?.distribution.upgradeInfo.desiredVersion,
                                  }),
                                  bodyContent: props.cluster?.distribution.upgradeInfo.upgradePercentage
                                      ? t('upgrade.upgrading.message.percentage', {
                                            clusterName: props.cluster?.name,
                                            version: props.cluster?.distribution.upgradeInfo.desiredVersion,
                                            percentage: props.cluster?.distribution.upgradeInfo.upgradePercentage,
                                        })
                                      : t('upgrade.upgrading.message', {
                                            clusterName: props.cluster?.name,
                                            version: props.cluster?.distribution.upgradeInfo.desiredVersion,
                                        }),
                                  footerContent: (
                                      <a
                                          href={`${props.cluster?.consoleURL}/settings/cluster`}
                                          target="_blank"
                                          rel="noreferrer"
                                      >
                                          {t('upgrade.upgrading.link')} <ExternalLinkAltIcon />
                                      </a>
                                  ),
                              }
                            : undefined
                    }
                />
            </>
        )
    } else if (props.cluster?.distribution.upgradeInfo.isReadyUpdates) {
        // UPGRADE AVAILABLE
        return (
            <>
                <div>{props.cluster?.distribution?.displayVersion}</div>
                <span style={{ whiteSpace: 'nowrap', display: 'block' }}>
                    <RbacButton
                        onClick={toggle}
                        icon={<ArrowCircleUpIcon />}
                        variant={ButtonVariant.link}
                        style={{ padding: 0, margin: 0, fontSize: 'inherit' }}
                        rbac={[
                            rbacCreate(ClusterCuratorDefinition, props.cluster?.namespace),
                            rbacPatch(ClusterCuratorDefinition, props.cluster?.namespace),
                        ]}
                    >
                        {t('upgrade.available')}
                    </RbacButton>
                    <BatchUpgradeModal clusters={[props.cluster]} open={open} close={toggle} />
                </span>
            </>
        )
    } else {
        // NO UPGRADE, JUST VERSION
        return <>{props.cluster?.distribution.displayVersion ?? '-'}</>
    }
}
