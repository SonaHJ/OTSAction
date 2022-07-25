# HCL OneTest Server

This enables you to run test assets that are available in a project of a HCL OneTest™ Server from a Github action.

## Pre requisites to run this action

1. Create a github repository
2. Create a folder named ".github/workflows" in the root of the repository
3. Create a .yml file with any name inside the ".github/workflows" folder 
4. Then you need to code thta yml file as mentioned in the following example.

    ## Example usage

    ```yaml
    name: HCL OneTest Server

    on:
        workflow_dispatch:
            inputs:
                serverUrl:
                    description: 'Server URL'
                    required: true
                offlineToken:
                    description: 'Offline Token'
                    required: true
                teamspace:
                    description: 'Team Space Name'
                    required: true
                project:
                    description: 'Project'
                    required: true
                branch:
                    description: 'Branch'
                    required: true
                assetId:
                    description: 'AssetID'
                    required: true
                environment:
                    description: 'API Test Environment'
                    required: false
                datasets:
                    description: 'Datasets'
                    required: false
                exportReport:
                    description: 'Export Junit Report'
                    required: false
                multipleValues:
                    description: 'Multiple Values'
                    required: false

    jobs:

        OTS-Action:
            runs-on: self-hosted
            name: HCL OneTest Server
            steps:
             - name: Execute Test
               uses: SonaHJ/OTSAction@HCLOneTestServer_03
               with:
                serverUrl: '${{ github.event.inputs.serverUrl }}'
                offlineToken: '${{ github.event.inputs.offlineToken }}'
                teamspace: '${{ github.event.inputs.teamspace }}'
                project: '${{ github.event.inputs.project }}'
                branch: '${{ github.event.inputs.branch }}'
                assetId: '${{ github.event.inputs.assetId }}'
                environment: '${{ github.event.inputs.environment }}'
                datasets: '${{ github.event.inputs.datasets }}'
                exportReport: '${{ github.event.inputs.exportReport }}'
                multipleValues: '${{ github.event.inputs.multipleValues }}'

    ```
5. Push it into the main branch
6. To configure agent:
    1. Go to settings (Repo).
    2. Select action -> runner.
    3. Click Create self-hosted runner, follow the download and configure instructions
7. Go to the Actions section in the repository and select the workflow.
8. Click the Run workflow dropdown and the list of input text boxes are displayed.
9. After entering the input values click on run workflow button

## List of Inputs

### `serverUrl`

URL of the HCL OneTest Server where the tests are located. URL should be of the format - https://hostname

### `offlineToken`

**Required** Input the offline user token for the corresponding HCL OneTest Server

### `teamspace`

**Required** Team Space name of the project.

### `project`

**Required** Project name of the test.

### `branch`

**Required** Project name of the test.

### `assetId`

**Required** AssetId of the test file in HCL OneTest Server.

### `environment`

**Optional**. Test environment corresponding to the test. Mandatory to input the value if you want to run API test.

### `datasets`

**Optional**. Semicolon (;) delimited list of source:replacement datasets for the job to run. For example, dataset1:dataset2;dataset3:dataset4

### `exportReport`

**Optional**. Use this option to export the Junit report generated for the test in XML format. Specify the complete path to the directory including the filename. For example, C:/TestFolder/TestFile.xml

### `multipleValues`

You may only define up to 10 inputs for a workflow_dispatch event. Remaining inputs need to be Key=Value pair.

https://github.community/t/you-may-only-define-up-to-10-inputs-for-a-workflow-dispatch-event/160733

https://github.com/github/docs/issues/15710

Specify the below inputs in the Key=Value format.
    Ex: variables=sampleVariable|tags=sampleTag
    
**Note that separator between the key-value pairs is '|' character.**

## Supported multipleValues inputs

### `variables`

Optional. Variables corresponding to the test. The format is variables=sampleVariable

### `tags`
Optional. Variables corresponding to the test. The format is tags=sampleTag
