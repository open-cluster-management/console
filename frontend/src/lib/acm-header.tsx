/* istanbul ignore file */

// CONSOLE-HEADER
import Axios, { AxiosResponse } from 'axios'

declare global {
    interface Window {
        __PRELOADED_STATE__: object
    }
}

type FilePath = {
    path: string
}

type HeaderAssets = {
    headerHtml: string
    files: {
        dll: FilePath
        js: FilePath
        css: FilePath
        nls: FilePath
    }
    props: object
    state: object
}

export const fetchHeader = async () => {
    const isLocal: boolean = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    let headerResponse: AxiosResponse
    try {
        headerResponse = await Axios.request({
            url: isLocal ? '/header' : '/multicloud/header/api/v1/header?serviceId=console&dev=false',
            method: 'GET',
            responseType: 'json',
            withCredentials: true,
        })

        if (headerResponse.status === 200) {
            const { headerHtml, files, props, state } = headerResponse.data as HeaderAssets

            const head = document.querySelector('head')
            const body = document.querySelector('body')

            const propScript = document.createElement('script')
            propScript.id = 'props'
            propScript.type = 'application/json'
            propScript.innerHTML = JSON.stringify(props)
            body?.appendChild(propScript)

            window.__PRELOADED_STATE__ = state

            const link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = files.css.path
            link.onload = function () {
                const headerContainer = document.querySelector('#header')
                if (headerContainer) {
                    headerContainer.innerHTML = headerHtml
                }

                const vendorScript = document.createElement('script')
                vendorScript.src = files.dll.path
                vendorScript.onload = function () {
                    const nlsScript = document.createElement('script')
                    nlsScript.src = files.nls.path
                    nlsScript.onload = function () {
                        const jsScript = document.createElement('script')
                        jsScript.src = files.js.path
                        body?.appendChild(jsScript)
                    }
                    body?.appendChild(nlsScript)
                }
                body?.appendChild(vendorScript)
            }
            head?.appendChild(link)

            // Dependency on console-header to provide the OpenShift console url because
            // we do not have a service account to query for the url ourselves if the user does not have privileges
            const appLinks = headerResponse?.data?.state?.uiconfig?.config?.appLinks ?? []
            const openShiftConsoleApp =
                appLinks.find((link: { name: string }) => link.name === 'Red Hat OpenShift Container Platform') ?? {}
            const openShiftConsoleUrl = openShiftConsoleApp.url
            if (openShiftConsoleUrl) {
                const input = document.createElement('input')
                input.id = 'openshift-console-url'
                input.value = openShiftConsoleUrl
                input.hidden = true
                body?.appendChild(input)
            } else {
                console.error('OpenShift Console URL not found in console-header response')
            }
        }
    } catch (err) {
        headerResponse = err
        console.error(err)
    }
    return headerResponse
}

fetchHeader()