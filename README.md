# HCL OneTest Server

This action enables you to integrate with HCL OneTest™ Server.

## How this works

After you complete the integration, you can run tests assets that are available in a project of HCL OneTest™ Server from a Github action.

## Pre requisites

1. Create a github repository
2. Create a folder named ".github" in the root of the repository
3. Create a folder named "workflows" inside the ".github" folder.
5. Create a .yml file with any name , inside the "workflow" folder and you need to code as following example in that yml file
## Example usage

```yaml
name: HCL OneTest Server

on: workflow_dispatch

jobs:

    RPT-Action:
        runs-on: self-hosted
        name: HCL OneTest Server
        steps:
         - name: RPT Action
           uses: SonaHJ/OTSAction@OTS_Release
          with:
            serverUrl: https://master-hcl.tp-k8s.nonprod.hclpnp.com/
            offlineToken: **********
            teamspace: Initial Team Space
            project: A_P1
            branch: master
            assetId: {assetIdOfTestFile}
            environment:
```
7. Replace the example input values with your details.
8. Push it into the main branch
9. Go to the Actions section in the repository and select the workflow.
10. Click the Run workflow dropdown and the list of input boxes get displayed.

To configure agent:
1. Go to settings (Repo).
2. Select action -> runner.
3. Click Create self-hosted runner, follow the download and configure instruction

## Inputs

### `serverUrl`

URL of the HCL OneTest Server where the tests are located. URL should be of the format - https://hostname

### `offlineToken `

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

Optional. Test environment corresponding to the test. Mandatory to input the value if you want to run API test.

### `datasets`

Optional. Semicolon (;) delimited list of source:replacement datasets for the job to run. For example, dataset1:dataset2;dataset3:dataset4

### `multipleValues`

you may only define up to 10 inputs for a workflow_dispatch event. Remaining inputs need to be Key=Value pair.

https://github.community/t/you-may-only-define-up-to-10-inputs-for-a-workflow-dispatch-event/160733

https://github.com/github/docs/issues/15710

Specify the below inputs in the Key=Value format.
Ex: Key1=Value1|Key2=Value2

## Multiplevalue inputs

### `variables`

Optional. Variables corresponding to the test. The format is key1=value1;key2=value2

### `tags`
Optional. Variables corresponding to the test. The format is key1=value1;key2=value2
