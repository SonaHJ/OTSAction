# OTS Action

This action enables you to integrate with HCL OneTest™ Server.

## How this works

After you complete the integration, you can run tests assets that are available in a project of HCL OneTest™ Server from a Jenkins server.

## Pre requesits

1. Create a github repository
2. Create a folder named ".github" in the root of the repository
3. Create a folder named "workflows" inside the ".github" folder.
5. Create a .yml file with any name , inside the "workflow" folder and you need to code as following example in that yml file
## Example usage

```yaml
name: OTS Action

on: workflow_dispatch

jobs:

    RPT-Action:
        runs-on: self-hosted
        name: Execute OTS Test
        steps:
         - name: RPT Action
           uses: SonaHJ/OTSAction@OTS_Release
          with:
            serverUrl: https://master-hcl.tp-k8s.nonprod.hclpnp.com/
            offlineToken: **********
            teamspace: Initial Team Space
            project: A_P1
            branch: master
            repository: {repourl}
            filepath: {test_filepath}
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

**Required** User owned projects from the corresponding Team Space get populated here.

### `project`

**Required** User owned projects from the corresponding Team Space get populated here.

### `branch`

**Required** TThis field displays the branches available in the corresponding project of the HCL OneTest Server.

### `repository`

**Required** 

### `filepath`

**Required** The tests of the selected asset type from the HCL OneTest Server get populated here.

### `environment`

**Required** When you select APISUITE, APITEST or APISTUB as the Asset Type, the Test Environment field lists the available test environments for the specific test asset.

### `datasets`

Semicolon (;) delimited list of source:replacement for the job to run. For example. (dataset1:dataset2;dataset3:dataset4)

### `multipleValues`

you may only define up to 10 inputs for a workflow_dispatch event. Remaining inputs need to be Key=Value pair.

https://github.community/t/you-may-only-define-up-to-10-inputs-for-a-workflow-dispatch-event/160733

https://github.com/github/docs/issues/15710

Specify the below inputs in the Key=Value format.
Ex: Key1=Value1|Key2=Value2

## Multiplevalue inputs

### `variables`

list of variables for the job to run. (ex. name=value;name1=value1)

### `tags`
Comma (,) delimited list of labels for the job to run.
