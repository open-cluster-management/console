/* Copyright Contributors to the Open Cluster Management project */
/* istanbul ignore file */

export enum NavigationPath {
    console = '/multicloud',
    clusters = '/multicloud/clusters',
    clusterDetails = '/multicloud/clusters/:id',
    clusterOverview = '/multicloud/clusters/:id/overview',
    clusterNodes = '/multicloud/clusters/:id/nodes',
    clusterMachinePools = '/multicloud/clusters/:id/machinepools',
    clusterSettings = '/multicloud/clusters/:id/settings',
    clusterSets = '/multicloud/cluster-sets',
    clusterSetDetails = '/multicloud/cluster-sets/:id',
    clusterSetOverview = '/multicloud/cluster-sets/:id/overview',
    clusterSetClusters = '/multicloud/cluster-sets/:id/clusters',
    clusterSetClusterPools = '/multicloud/cluster-sets/:id/cluster-pools',
    clusterSetAccess = '/multicloud/cluster-sets/:id/access',
    clusterSetManage = '/multicloud/cluster-sets/:id/manage-resources',
    createClusterSet = '/multicloud/create-cluster-set',
    clusterPools = '/multicloud/cluster-pools',
    discoveredClusters = '/multicloud/discovered-clusters',
    createCluster = '/multicloud/create-cluster',
    createClusterPool = '/multicloud/create-cluster-pool',
    importCluster = '/multicloud/import-cluster',
    importCommand = '/multicloud/import-cluster/:clusterName',
    credentials = '/multicloud/credentials',
    addCredentials = '/multicloud/credentials/add',
    editCredentials = '/multicloud/credentials/edit/:namespace/:name',
    viewCredentials = '/multicloud/credentials/view/:namespace/:name',
    bareMetalAssets = '/multicloud/bare-metal-assets',
    editBareMetalAsset = '/multicloud/bare-metal-assets/:namespace/:name',
    createBareMetalAsset = '/multicloud/create-bare-metal-asset',
    addDiscoveryConfig = '/multicloud/add-discovery-config',
    editDiscoveryConfig = '/multicloud/discovery-configs/:namespace/:name',
}
