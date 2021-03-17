/* Copyright Contributors to the Open Cluster Management project */

import { makeStyles } from '@material-ui/styles'
import { AcmLabels, AcmTable, compareStrings } from '@open-cluster-management/ui-components'
import { ChartDonut, ChartLabel, ChartLegend } from '@patternfly/react-charts'
import { Tab, Tabs, TabTitleText } from '@patternfly/react-core'
import { TableGridBreakpoint } from '@patternfly/react-table'
import { useState } from 'react'
import { useTranslation, TFunction } from 'react-i18next'
import { PolicyReport } from '../../../../resources/policy-report'

const useStyles = makeStyles({
    sidebarBody: {
        position: 'relative',
        top: '-35px',
    },
    sidebarDescText: {
        fontSize: '14px',
        paddingBottom: '1rem',
    },
    donutContainer: {
        width: '400px',
        height: '200px',
        paddingBottom: '1rem',
        marginLeft: '-4rem',
    },
    sidebarTitleText: {
        fontSize: '20px',
        paddingBottom: '10px',
    },
    backAction: {
        border: 0,
        cursor: 'pointer',
        background: 'none',
        color: 'var(--pf-global--link--Color)',
    },
    tableTitleText: {
        fontWeight: 700,
        fontSize: '16px',
    },
    policyDetailLink: {
        border: 0,
        cursor: 'pointer',
        background: 'none',
        color: 'var(--pf-global--link--Color)',
        textAlign: 'unset',
        '&:hover': {
            textDecoration: 'underline',
        },
    },
})

function formatText(text: string) {
    return text.split('\n').map((str: string) => {
        if (str === '') {
            return <br />
        }
        return <p>{str}</p>
    })
}

function renderDonutChart(data: PolicyReport[], t: TFunction<string[]>) {
    const clusterRiskScores = data.map((issue) => issue.results[0].data.total_risk)
    const formattedData = [
        {
            key: t('policy.report.critical'),
            value: clusterRiskScores.filter((score: string) => score === '4').length,
            isPrimary: true,
        },
        {
            key: t('policy.report.major'),
            value: clusterRiskScores.filter((score: string) => score === '3').length,
        },
        {
            key: t('policy.report.minor'),
            value: clusterRiskScores.filter((score: string) => score === '2').length,
        },
        {
            key: t('policy.report.low'),
            value: clusterRiskScores.filter((score: string) => score === '1').length,
        },
        {
            key: t('policy.report.warning'),
            value: clusterRiskScores.filter((score: string) => score === '0').length,
        },
    ]
    const chartData = formattedData.map((d) => ({ x: d.key, y: d.value }))
    const legendData: Array<{ name?: string; link?: string }> = formattedData.map((d) => ({
        name: `${d.value} ${d.key}`,
    }))

    return (
        <ChartDonut
            ariaTitle={t('policy.report.flyout.donut.chart.ariaTitle')}
            ariaDesc={t('policy.report.flyout.donut.chart.ariaDesc')}
            legendOrientation="vertical"
            legendPosition="right"
            constrainToVisibleArea={true}
            data={chartData}
            legendData={legendData}
            legendComponent={
                <ChartLegend
                    data={legendData}
                    labelComponent={<ChartLabel />}
                    colorScale={['#E62325', '#EC7A08', '#F4C145', '#2B9AF3', '#72767B']}
                />
            }
            labels={({ datum }) => `${datum.x}: ${datum.y}`}
            padding={{
                bottom: 20,
                left: 20,
                right: 145,
                top: 20,
            }}
            title={`${data.length}`}
            subTitle={t('policy.report.flyout.donut.chart.text')}
            width={400}
            height={200}
            colorScale={['#E62325', '#EC7A08', '#F4C145', '#2B9AF3', '#72767B']}
        />
    )
}

function DetailsView(props: {
    setDetailsView: React.Dispatch<React.SetStateAction<boolean>>
    selectedPolicy: PolicyReport | undefined
}) {
    const { setDetailsView, selectedPolicy } = props
    const { t } = useTranslation(['cluster'])
    const [tabState, setTabState] = useState<React.ReactText>(0)
    const classes = useStyles()

    return (
        <div className={classes.sidebarBody}>
            <div className={classes.sidebarTitleText}>
                <button onClick={() => setDetailsView(false)} className={classes.backAction}>
                    {t('policy.report.flyout.back')}
                </button>
            </div>
            <div className={classes.sidebarDescText}>{selectedPolicy?.results?.[0]?.message ?? ''}</div>
            <Tabs activeKey={tabState} onSelect={(e, tabIndex) => setTabState(tabIndex)} isFilled={true}>
                <Tab
                    eventKey={0}
                    title={<TabTitleText>{t('policy.report.flyout.details.tab.remediation')}</TabTitleText>}
                >
                    {formatText(selectedPolicy?.results?.[0]?.data?.resolution ?? '')}
                </Tab>
                <Tab eventKey={1} title={<TabTitleText>{t('policy.report.flyout.details.tab.reason')}</TabTitleText>}>
                    {formatText(selectedPolicy?.results?.[0]?.data?.reason ?? '')}
                </Tab>
            </Tabs>
        </div>
    )
}

export function ClusterPolicySidebar(props: { data: PolicyReport[] }) {
    const classes = useStyles()
    const { t } = useTranslation(['cluster'])
    const [detailsView, setDetailsView] = useState<boolean>(false)
    const [selectedPolicy, setSelectedPolicy] = useState<PolicyReport>()

    return detailsView ? (
        <DetailsView setDetailsView={setDetailsView} selectedPolicy={selectedPolicy} />
    ) : (
        <div className={classes.sidebarBody}>
            <div className={classes.sidebarTitleText}>
                {t('policy.report.flyout.title', { count: props.data.length })}
            </div>
            <div className={classes.sidebarDescText}>{t('policy.report.flyout.description')}</div>
            <div className={classes.donutContainer}>{renderDonutChart(props.data, t)}</div>
            <div className={classes.tableTitleText}>{t('policy.report.flyout.table.header')}</div>
            <AcmTable<PolicyReport>
                plural="Recommendations"
                items={props.data}
                columns={[
                    {
                        header: t('policy.report.table.description'),
                        search: (policyReport) => policyReport.results[0].message,
                        sort: (a: PolicyReport, b: PolicyReport) =>
                            compareStrings(a.results[0].message, b.results[0].message),
                        cell: (item: PolicyReport) => (
                            <button
                                className={classes.policyDetailLink}
                                onClick={() => {
                                    setDetailsView(true)
                                    setSelectedPolicy(item)
                                }}
                            >
                                {item.results[0].message}
                            </button>
                        ),
                    },
                    {
                        header: t('policy.report.table.category'),
                        search: (policyReport) => {
                            if (policyReport.results[0].category && policyReport.results[0].category !== '') {
                                return policyReport.results[0].category.split(',')
                            }
                            return ''
                        },
                        cell: (item: PolicyReport) => {
                            if (item.results[0].category && item.results[0].category !== '') {
                                const categories = item.results[0].category.split(',')
                                const categoriesToHide = categories.slice(1)
                                return <AcmLabels labels={categories} collapse={categoriesToHide} />
                            }
                            return '-'
                        },
                    },
                    {
                        header: t('policy.report.table.totalRisk'),
                        search: (policyReport) => policyReport.results[0].data.total_risk,
                        sort: (a: PolicyReport, b: PolicyReport) =>
                            compareStrings(a.results[0].data.total_risk, b.results[0].data.total_risk),
                        cell: (item: PolicyReport) => item.results[0].data.total_risk,
                    },
                ]}
                keyFn={(item: any) => item.metadata.uid}
                tableActions={[]}
                bulkActions={[]}
                rowActions={[]}
                gridBreakPoint={TableGridBreakpoint.none}
            />
        </div>
    )
}
