/* Copyright Contributors to the Open Cluster Management project */


import './style.css'
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AcmSelect } from '@open-cluster-management/ui-components'
import { SelectOption } from '@patternfly/react-core'
import { Cluster, ClusterStatus } from '../../../../lib/get-cluster'
import { postRequest, IRequestResult } from '../../../../lib/resource-request'
import { BulkActionModel } from '../../../../components/BulkActionModel'
export const backendUrl = `${process.env.REACT_APP_BACKEND_HOST}${process.env.REACT_APP_BACKEND_PATH}`

// compare version
const compareVersion = (a: string, b: string) => {
    // basic sort semvers without preversion
    const aVersion = a.split('.')
    const bVersion = b.split('.')
    for (let i = 0; i < Math.min(aVersion.length, bVersion.length); i++) {
        if (aVersion[i] !== bVersion[i]) {
            return Number(bVersion[i]) - Number(aVersion[i])
        }
    }
    return bVersion.length - aVersion.length
}

const isUpgradeable = (c: Cluster) => {
    const hasAvailableUpgrades =
        !c.distribution?.isManagedOpenShift &&
        c.distribution?.ocp?.availableUpdates &&
        c.distribution?.ocp?.availableUpdates.length > 0
    const isUpgrading = c.distribution?.ocp?.version !== c.distribution?.ocp?.desiredVersion
    const isReady = c.status === ClusterStatus.ready
    return (!!c.name && isReady && hasAvailableUpgrades && !isUpgrading) || false
}

const setLatestVersions = (clusters: Array<Cluster> | undefined): Record<string, string> => {
    const res = {} as Record<string, string>
    clusters?.forEach((c: Cluster) => {
        if (c.name) {
            const availableUpdates = c.distribution?.ocp?.availableUpdates?.sort(compareVersion)
            const latestVersion = availableUpdates && availableUpdates.length > 0 ? availableUpdates[0] : ''
            res[c.name] = res[c.name] ? res[c.name] : latestVersion
        }
    })
    return res
}

export function BatchUpgradeModal(props: {
    close: () => void
    open: boolean
    clusters: Array<Cluster> | undefined
}): JSX.Element {
    const { t } = useTranslation(['cluster'])
    const [selectVersions, setSelectVersions] = useState<Record<string, string>>({})
    const [upgradeableClusters, setUpgradeableClusters] = useState<Array<Cluster>>([])
    useEffect(() => {
        // set up latest if not selected
        const newUpgradeableClusters = props.clusters && props.clusters.filter(isUpgradeable)
        setSelectVersions(setLatestVersions(newUpgradeableClusters))
        setUpgradeableClusters(newUpgradeableClusters || [])
    }, [props.clusters, props.open])

    return (
        <BulkActionModel<Cluster>
            open={props.open}
            plural={t('upgrade.multiple.plural')}
            singular={t('upgrade.multiple.singular')}
            action={t('upgrade.submit')}
            processing={t('upgrade.submit.processing')}
            resources={upgradeableClusters}
            close={() => {
                props.close()
            }}
            description={t('upgrade.multiple.note')}
            columns={[
                {
                    header: t('upgrade.table.name'),
                    sort: 'name',
                    cell: 'name',
                },
                {
                    header: t('upgrade.table.currentversion'),
                    cell: (item: Cluster) => {
                        const currentVersion = item?.distribution?.ocp?.version || ''
                        return <span>{currentVersion}</span>
                    },
                },
                {
                    header: t('upgrade.table.newversion'),
                    cell: (item: Cluster) => {
                        const availableUpdates =
                            item.distribution?.ocp?.availableUpdates &&
                            item.distribution?.ocp?.availableUpdates.sort(compareVersion)
                        const hasAvailableUpgrades = availableUpdates && availableUpdates.length > 0
                        return (
                            <div>
                                {hasAvailableUpgrades && (
                                    <AcmSelect
                                        value={selectVersions[item.name || ''] || ''}
                                        id={`${item.name}-upgrade-selector`}
                                        maxHeight={'6em'}
                                        label=""
                                        isRequired
                                        onChange={(version) => {
                                            if (item.name && version) {
                                                selectVersions[item.name] = version
                                                setSelectVersions({ ...selectVersions })
                                            }
                                        }}
                                    >
                                        {availableUpdates?.map((version) => (
                                            <SelectOption key={`${item.name}-${version}`} value={version}>
                                                {version}
                                            </SelectOption>
                                        ))}
                                    </AcmSelect>
                                )}
                            </div>
                        )
                    },
                },
            ]}
            keyFn={(cluster) => cluster.name as string}
            actionFn={(cluster) => {
                if (!cluster.name || !selectVersions[cluster.name]) {
                    const emptyRes: IRequestResult<string> = {
                        promise: new Promise((resolve) => resolve('')),
                        abort: () => {},
                    }
                    return emptyRes
                }
                return postRequest(backendUrl + '/upgrade', {
                    clusterName: cluster.name,
                    version: selectVersions[cluster.name],
                })
            }}
        />
    )
}
