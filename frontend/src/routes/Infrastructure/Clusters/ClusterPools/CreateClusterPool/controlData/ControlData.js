/* Copyright Contributors to the Open Cluster Management project */

import Handlebars from 'handlebars'
import installConfigHbs from '../../../ManagedClusters/CreateCluster/templates/install-config.hbs'
import { keyBy, cloneDeep } from 'lodash'

import controlDataAWS from '../../../ManagedClusters/CreateCluster/controlData/ControlDataAWS'
import controlDataGCP from '../../../ManagedClusters/CreateCluster/controlData/ControlDataGCP'
import controlDataAZR from '../../../ManagedClusters/CreateCluster/controlData/ControlDataAZR'
import { RedHatLogo, AwsLogo, GoogleLogo, AzureLogo } from '../../../ManagedClusters/CreateCluster/controlData/Logos'

const installConfig = Handlebars.compile(installConfigHbs)

export const getActiveCardID = (control, fetchData = {}) => {
    const { requestedUIDs } = fetchData
    if (requestedUIDs && requestedUIDs.length) {
        return 'BMC'
    }
    return null
}

export const getDistributionTitle = (ctrlData, groupData, i18n) => {
    const activeObject = groupData.find((object) => object.id === 'distribution')
    const active = activeObject['active']
    if (active && activeObject['availableMap']) {
        const title = activeObject['availableMap'][active].title
        return i18n('creation.ocp.choose.infrastructure', [title])
    }
    return ''
}

const fixupControlsForClusterPool = (controlData) => {
    const map = keyBy(controlData, 'id')
    map['detailStep'].title = 'Cluster pool details'
    map['name'].name = 'clusterPool.creation.ocp.name'
    map['name'].tooltip = 'clusterPool.tooltip.creation.ocp.name'
    map['name'].reverse = 'ClusterPool[0].metadata.name'
    map['region'].reverse = 'ClusterPool[0].metadata.labels.region'

    let inx = controlData.findIndex(({ id }) => id === 'additional')
    controlData.splice(inx, 1)

    inx = controlData.findIndex(({ id }) => id === 'name')
    controlData.splice(
        inx + 1,
        0,
        {
            name: 'clusterPool.creation.ocp.namespace',
            tooltip: 'clusterPool.tooltip.creation.ocp.namespace',
            id: 'namespace',
            type: 'combobox',
            placeholder: 'clusterPool.placeholder.creation.ocp.namespace',
            validation: {
                required: true,
            },
            available: [],
        },
        {
            name: 'clusterPool.creation.ocp.size',
            tooltip: 'clusterPool.tooltip.creation.ocp.size',
            id: 'size',
            type: 'number',
            initial: '1',
            validation: {
                required: true,
            },
            // cacheUserValueKey: 'create.cluster.compute.node.count',
        }
    )

    return controlData
}
const fixedUpAWS = fixupControlsForClusterPool(cloneDeep(controlDataAWS))
const fixedUpGCP = fixupControlsForClusterPool(cloneDeep(controlDataGCP))
const fixedUpAZR = fixupControlsForClusterPool(cloneDeep(controlDataAZR))

export const controlData = [
    ///////////////////////  container platform  /////////////////////////////////////
    {
        id: 'distStep',
        type: 'step',
        title: 'Infrastructure provider',
    },
    {
        id: 'showSecrets',
        type: 'hidden',
        active: false,
    },
    {
        id: 'chooseDist',
        type: 'title',
        info: 'creation.ocp.choose.distribution',
        tooltip: 'tooltip.creation.ocp.choose.distribution',
    },
    {
        id: 'distribution',
        type: 'cards',
        sort: false,
        pauseControlCreationHereUntilSelected: false,
        active: 'OpenShift',
        available: [
            {
                id: 'OpenShift',
                logo: <RedHatLogo />,
                title: 'cluster.create.ocp.subtitle',
            },
        ],
        validation: {
            notification: 'creation.ocp.cluster.must.select.orchestration',
            required: true,
        },
    },
    ///////////////////////  cloud  /////////////////////////////////////
    {
        id: 'chooseInfra',
        type: 'title',
        info: getDistributionTitle,
        tooltip: 'tooltip.creation.ocp.choose.aws.infrastructure',
        learnMore: 'https://docs.openshift.com/container-platform/4.3/installing/',
    },
    {
        id: 'infrastructure',
        type: 'cards',
        sort: false,
        pauseControlCreationHereUntilSelected: true,
        scrollViewAfterSelection: 300,
        available: [
            {
                id: 'AWS',
                logo: <AwsLogo />,
                title: 'cluster.create.aws.subtitle',
                change: {
                    insertControlData: fixedUpAWS,
                    replacements: {
                        'install-config': { template: installConfig, encode: true, newTab: true },
                    },
                },
            },
            {
                id: 'GCP',
                logo: <GoogleLogo />,
                title: 'cluster.create.google.subtitle',
                change: {
                    insertControlData: fixedUpGCP,
                    replacements: {
                        'install-config': { template: installConfig, encode: true, newTab: true },
                    },
                },
            },
            {
                id: 'Azure',
                logo: <AzureLogo />,
                title: 'cluster.create.azure.subtitle',
                change: {
                    insertControlData: fixedUpAZR,
                    replacements: {
                        'install-config': { template: installConfig, encode: true, newTab: true },
                    },
                },
            },
            // {
            //     id: 'vSphere',
            //     logo: <VMwareLogo />,
            //     title: 'cluster.create.vmware.subtitle',
            //     change: {
            //         insertControlData: controlDataVMW,
            //         replacements: {
            //             'install-config': { template: installConfig, encode: true, newTab: true },
            //         },
            //     },
            // },
            // {
            //     id: 'OpenStack',
            //     logo: <RedHatLogo />,
            //     title: 'cluster.create.redhat.subtitle',
            //     change: {
            //         insertControlData: controlDataOST,
            //         replacements: {
            //             'install-config': { template: installConfig, encode: true, newTab: true },
            //         },
            //     },
            // },
            // {
            //     id: 'BMC',
            //     logo: <BaremetalLogo />,
            //     title: 'cluster.create.baremetal.subtitle',
            //     change: {
            //         insertControlData: controlDataBMC,
            //         replacements: {
            //             'install-config': { template: installConfig, encode: true, newTab: true },
            //         },
            //     },
            // },
        ],
        active: getActiveCardID,
        validation: {
            notification: 'creation.ocp.cluster.must.select.infrastructure',
            required: true,
        },
    },
]
