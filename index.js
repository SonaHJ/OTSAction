import tl = require("azure-pipelines-task-lib/task");
import urlencode = require("urlencode");
import url = require("url");
import path = require("path");
import fs = require("fs");
import axios from "axios";
import { ServerStore } from "./serverstore";
import { Status } from "./status";
import { TestAsset } from "./testAsset";
var testPlanId: string;
var testCaseId: string;
var testSuiteId: string;
var testPointId: string;
var runId: string;
var azureResultId: string;
var datasetSrcId: string;
var datasetReplaceId: string;
var buildId = tl.getVariable('Build.BuildId');
var azureTaskServer = (tl.getVariable('SYSTEM.TEAMFOUNDATIONSERVERURI'));
var teamProject = (tl.getVariable('SYSTEM.TEAMPROJECT'));
async function run() {
  try {
    var teamspace: string | undefined = tl.getInput("teamspace");
    var project: string | undefined = tl.getInput("project");
    var branch: string | undefined = tl.getInput("branch");
    var repo: string | undefined = tl.getInput("repo");
    var filepath: string | undefined = tl.getInput("filePath");
    var environment: string | undefined = tl.getInput("ritEnv");
    var variables: string | undefined = tl.getInput("variables");
    var serviceEndpointId = tl.getInput("_prop_task_server_serviceName", true);
    var server = tl.getEndpointUrl(serviceEndpointId, true);
    var datasets: string | undefined = tl.getInput("datasets");
    var tags: string | undefined = tl.getInput("tags");
    var secretsCollectionName: string | undefined = tl.getInput("secretsCollectionName");
    var offlineToken = tl.getEndpointAuthorizationParameter(
      serviceEndpointId,
      "apitoken",
      true
    );

    var isFailed = false;

    var azureServer: string | undefined = tl.getInput('azureServer');
    var pat: string | undefined = tl.getInput('patToken');
    var testPlanName: string | undefined = tl.getInput('testPlanName');
    var testCaseName: string | undefined = tl.getInput('testCaseName');
    var exportReport: string = tl.getInput('exportReport', false);

    console.log(
      "========================== START Build Job Execution ==========================="
    );
    console.log("");

    console.log("Test information:");
    console.log("Server URL: " + server);
    console.log("Team Space: " + teamspace);
    console.log("Project: " + project);
    console.log("Branch: " + branch);
    console.log("Repository: " + repo);
    console.log("Test Path: " + filepath);
    if (environment != null && environment != undefined) {
      console.log("Environment: " + environment);
    }
    if (variables != null && variables != undefined) {
      console.log("Variables: " + variables);
    }
    if (datasets != null && datasets != undefined) {
      console.log("Datasets: " + datasets);
    }
    if (tags != null && tags != undefined) {
      console.log("Labels: " + tags);
    }
    if (secretsCollectionName != null && secretsCollectionName != undefined) {
      console.log("Secrets Collection: " + secretsCollectionName);
    }

    console.log("");

    console.log("Validating the inputs.");

    validateInputs(
      server,
      offlineToken,
      teamspace,
      project,
      branch,
      repo,
      filepath
    );

    var assetName = path.parse(filepath).name;

    var asset = new TestAsset(
      teamspace.trim(),
      project.trim(),
      repo.trim(),
      branch.trim(),
      filepath.trim(),
      assetName.trim()
    );

    var serverStore = new ServerStore(server, offlineToken);

    await serverSSLCheck(serverStore);

    await teamspaceIdGenByName(serverStore, asset);

    await projectIdGenByName(serverStore, asset);

    await repoIdGenByName(serverStore, asset);

    await branchValidation(serverStore, asset);

    await AssetIdGenByName(serverStore, asset);

    if (
      asset.getExternalType() == "APISUITE" ||
      asset.getExternalType() == "APITEST" ||
      asset.getExternalType() == "APISTUB"
    ) {
      await validateEnvironment(serverStore, asset, environment);
    }

    console.log("Validation completed.");

    console.log("");

    console.log("Starting the test run.");

    console.log("");

    await startJobExecution(serverStore, asset, variables, datasets, tags, secretsCollectionName);

    console.log(
      getDateTime() + " Test Execution Status: " + asset.getExecStatus()
    );

    if (
      asset.getExecStatus() != Status.COMPLETE ||
      asset.getExecStatus() != Status.COMPLETE_WITH_ERROR ||
      asset.getExecStatus() != Status.STOPPED_BY_USER ||
      asset.getExecStatus() != Status.STOPPED_AUTOMATICALLY ||
      asset.getExecStatus() != Status.INCOMPLETE ||
      asset.getExecStatus() != Status.CANCELED ||
      asset.getExecStatus() != Status.LAUNCH_FAILED
    ) {
      await pollJobStatus(serverStore, asset);
    } else if (asset.getExecStatus() != Status.COMPLETE) {
      isFailed = true;
    }
    if (asset.getExternalType() != "APISTUB") {
      if(exportReport != null){
        if(path.extname(exportReport).toLowerCase() === ".xml") {
          await getJunitReport(serverStore, asset, exportReport);
        } else {
          console.error("Invalid file type, file extension should be .xml")
        }
      }
      await getResults(serverStore, asset);
      if (azureServer != null && pat != null && testPlanName != null && testCaseName != null) {
        await TestPlanIdGenByName(azureServer, pat, testPlanName);
        await TestSuiteId(azureServer, pat, testPlanId, testPlanName);
        await TestCaseIdByName(azureServer, pat, testPlanId, testSuiteId, testCaseName);
        await TestCasePoint(azureServer, pat, testPlanId, testSuiteId, testCaseId);
        await createTestRun(azureServer, pat, testPlanId, testSuiteId, testPointId, testCaseName);
        await getResultId(azureServer, pat, testPlanId, testSuiteId, testPointId, testCaseName, runId);
        await updateTestResults(azureServer, pat, azureResultId, runId, isFailed == true || asset.getVerdictSet() == false);
        console.log("")	
        console.log("Updated test results to "+ testCaseName +" under " +testPlanName);
      }
    }
    console.log("");
    console.log(
      "========================== END Build Job Execution ==========================="
    );
    if (isFailed == true || asset.getVerdictSet() == false) {
      tl.setResult(
        tl.TaskResult.Failed,
        "Execution failed, Test Execution Status:  " + asset.getExecStatus()
      );
    }
  } catch (err) {
    console.error("");
    tl.setResult(tl.TaskResult.Failed, err.message || 'run() failed', true);
    console.error("");
    if (asset.getVerdictSet() == false) {
      console.error("Test Result = FAIL");
      if (azureServer != null && pat != null && testPlanName != null && testCaseName != null) {
        await TestPlanIdGenByName(azureServer, pat, testPlanName);
        await TestSuiteId(azureServer, pat, testPlanId, testPlanName);
        await TestCaseIdByName(azureServer, pat, testPlanId, testSuiteId, testCaseName);
        await TestCasePoint(azureServer, pat, testPlanId, testSuiteId, testCaseId);
        await createTestRun(azureServer, pat, testPlanId, testSuiteId, testPointId, testCaseName);
        await getResultId(azureServer, pat, testPlanId, testSuiteId, testPointId, testCaseName, runId);
        await updateTestResults(azureServer, pat, azureResultId, runId, true);
        console.log("")
        console.log("Updated test results to "+ testCaseName +" under " +testPlanName);
      }
    }
    console.error("");
    console.error(
      "========================== END Build Job Execution ==========================="
    );
  }
}

function validateInputs(
  server,
  offlineToken,
  teamspace,
  project,
  branch,
  repo,
  filepath
) {
  if (server == "" || server == null || server == undefined) {
    throw new Error("Server URL is mandatory.");
  }
  if (offlineToken == "" || offlineToken == null || offlineToken == undefined) {
    throw new Error("Offline token is mandatory.");
  }
  // var serverRegex = /^https:\/\/[^\/]*$/;
  var serverRegex = /^https:\/\/[^\/]*[\/]$/;
  if (serverRegex.test(server) == false) {
    throw new Error("Server URL should be of the format - https://hostname/");
  }
  if (teamspace == "" || teamspace == null || teamspace == undefined) {
    throw new Error(
      "Team Space name is mandatory. Please input the value in the Team Space Name field in the task."
    );
  }
  if (project == "" || project == null || project == undefined) {
    throw new Error(
      "Project name is mandatory. Please input the value in the Project field in the task."
    );
  }
  if (repo == "" || repo == null || repo == undefined) {
    throw new Error(
      "Repository name is mandatory. Please input the value in the Repository field in the task."
    );
  }
  if (branch == "" || branch == null || branch == undefined) {
    throw new Error(
      "Branch name is mandatory. Please input the value in the Branch field in the task."
    );
  }
  if (filepath == "" || filepath == null || filepath == undefined) {
    throw new Error(
      "Filepath is mandatory. Please input the value in the File path field in the task."
    );
  }
}

function accessTokenGen(serverStore) {
  var tokenURL = serverStore.getServer() + "rest/tokens/";
  var body = "refresh_token=" + serverStore.getOfflineToken();
  var headers = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  return axios
    .post(tokenURL, body, {
      headers: headers,
    })
    .then((response) => {
      if (
        response.status == 400 ||
        response.status == 401 ||
        response.status == 402
      ) {
        throw new Error(
          "Error during retrieval of access token. Please check the offline token in the service connection. Request returned response code: " +
          response.status
        );
      }
      if (response.status == 403) {
        throw new Error(
          "Error during retrieval of access token. Please check the license as request is unauthorized. Request returned response code: " +
          response.status
        );
      }
      if (response.status != 200) {
        throw new Error(
          "Error during retrieval of access token. Request returned response code: " +
          response.status
        );
      }
      serverStore.setAccessToken(response.data.access_token);
      return response.data;
    })
    .catch((error) => {
      if (error.code == "ENOTFOUND") {
        throw new Error(
          "Cannot resolve the host. Please check the server URL and connectivity to the server."
        );
      } else if (error.code == "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
        throw new Error(
          "Could not establish secure connection to the server " +
          serverStore.getServer() +
          ". Please validate the SSL certificate of the server or import the CA certificate of the server to your trust store. Error: " +
          error.message
        );
      } else if (error.code == "CERT_HAS_EXPIRED") {
        throw new Error(
          "Could not establish secure connection to the server " +
          serverStore.getServer() +
          ". The server presented an expired SSL certificate. Error: " +
          error.message
        );
      } else {
        throw new Error(
          "Error when accessing Token management URL: " +
          tokenURL +
          " Error: " +
          error
        );
      }
    });
}

function serverSSLCheck(serverStore) {
  var sslCheckUrl = serverStore.getServer();
  return axios
    .get(sslCheckUrl)
    .then((response) => {
      return true;
    })
    .catch((error) => {
      if (error.code == "ENOTFOUND") {
        throw new Error(
          "Cannot resolve the host. Please check the server URL and connectivity to the server."
        );
      } else if (error.code == "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
        throw new Error(
          "Could not establish secure connection to the server " +
          serverStore.getServer() +
          ". Please validate the SSL certificate of the server or import the CA certificate of the server to your trust store. Error: " +
          error.message
        );
      } else if (error.code == "CERT_HAS_EXPIRED") {
        throw new Error(
          "Could not establish secure connection to the server " +
          serverStore.getServer() +
          ". The server presented an expired SSL certificate. Error: " +
          error.message
        );
      } else {
        throw new Error(
          "Could not establish secure connection to the server " +
          serverStore.getServer() +
          ". Error: " +
          error.message
        );
      }
    });
}

async function teamspaceIdGenByName(serverStore, asset) {
  let encodedTeamspaceName = urlencode(asset.getTeamspace());
  let teamspacesListURL =
    serverStore.getServer() +
    "rest/spaces?search=" +
    encodedTeamspaceName +
    "&member=true";

  await accessTokenGen(serverStore);

  var headers = {
    "Accept-Language": "en",
    Authorization: "Bearer " + serverStore.getAccessToken(),
  };
  return axios
    .get(teamspacesListURL, { headers: headers })
    .then((response) => {
      if (response.status != 200) {
        throw new Error(
          "Error during retrieval of teamspaces. " +
          teamspacesListURL +
          " returned " +
          response.status +
          " response code. Response: " +
          response.data
        );
      }
      var parsedJSON = response.data;
      var retrievedTeamSpaceName;
      var gotId = false;
      var total = parsedJSON.length;
      if (total > 0) {
        for (var i = 0; i < total; i++) {
          retrievedTeamSpaceName = parsedJSON[i].displayName;
          if (asset.getTeamspace() == retrievedTeamSpaceName) {
            asset.setTeamspaceId(parsedJSON[i].id);
            gotId = true;
            return;
          }
        }
        if (!gotId) {
          throw new Error(
            "You do not have access to the team space " +
            asset.getTeamspace() +
            " or the team space was not found in the server. Please check the Team Space field in the task."
          );
        }
      } else {
        throw new Error(
          "You do not have access to the team space " +
          asset.getTeamspace() +
          " or the team space was not found in the server. Please check the Team Space field in the task."
        );
      }
    })
    .catch((error) => {
      throw new Error(
        "Error when accessing teamspaces list API - " +
        teamspacesListURL +
        ". Error: " +
        error
      );
    });
}

async function projectIdGenByName(serverStore, asset) {
  let encodedProjName = urlencode(asset.getProject());
  let projectsListURL =
    serverStore.getServer() +
    "rest/projects?archived=false&member=true&name=" +
    encodedProjName;

  await accessTokenGen(serverStore);

  var headers = {
    "Accept-Language": "en",
    Authorization: "Bearer " + serverStore.getAccessToken(),
    spaceId: asset.getTeamspaceId(),
  };
  return axios
    .get(projectsListURL, { headers: headers })
    .then((response) => {
      if (response.status != 200) {
        throw new Error(
          "Error during retrieval of projects. " +
          projectsListURL +
          " returned " +
          response.status +
          " response code. Response: " +
          response.data
        );
      }
      var parsedJSON = response.data;
      var total = parsedJSON.total;
      var retrievedProjName;
      var gotId = false;
      if (total > 0) {
        for (var i = 0; i < total; i++) {
          retrievedProjName = parsedJSON.data[i].name;
          if (asset.getProject() == retrievedProjName) {
            asset.setProjectId(parsedJSON.data[i].id);
            gotId = true;
            return true;
          }
        }
        if (!gotId) {
          throw new Error(
            "You do not have access to the project " +
            asset.getProject() +
            " or the project was not found in the teamspace " +
            asset.getTeamspace() +
            " in the server. Please check the Project field in the task."
          );
        }
      } else {
        throw new Error(
          "You do not have access to the project " +
          asset.getProject() +
          " or the project was not found in the teamspace " +
          asset.getTeamspace() +
          " in the server. Please check the Project field in the task."
        );
      }
    })
    .catch((error) => {
      throw new Error(
        "Error when accessing projects list API - " +
        projectsListURL +
        ". Error: " +
        error
      );
    });
}

async function repoIdGenByName(serverStore, asset) {
  let reposListURL =
    serverStore.getServer() +
    "rest/projects/" +
    asset.getProjectId() +
    "/repositories/";

  await accessTokenGen(serverStore);

  var headers = {
    "Accept-Language": "en",
    Authorization: "Bearer " + serverStore.getAccessToken(),
  };
  return axios
    .get(reposListURL, { headers: headers })
    .then((response) => {
      if (response.status != 200) {
        throw new Error(
          "Error during retrieval of repositories. " +
          reposListURL +
          " returned " +
          response.status +
          " response code. Response: " +
          response.data
        );
      }
      var parsedJSON = response.data;
      var total = parsedJSON.totalElements;
      let retrievedRepoName;
      let gotId = false;
      if (total > 0) {
        for (var i = 0; i < total; i++) {
          retrievedRepoName = parsedJSON.content[i].uri;
          if (asset.getRepo() == retrievedRepoName) {
            asset.setRepoId(parsedJSON.content[i].id);
            gotId = true;
            return true;
          }
        }
        if (!gotId) {
          throw new Error(
            "The repository " +
            asset.getRepo() +
            " was not found in the project " +
            asset.getProject() +
            " Please check the Repository field in the task."
          );
        }
      } else {
        throw new Error(
          "The repository " +
          asset.getRepo() +
          " was not found in the project " +
          asset.getProject() +
          " Please check the Repository field in the task."
        );
      }
    })
    .catch((error) => {
      throw new Error(
        "Error when accessing repository list API - " +
        reposListURL +
        ". Error: " +
        error
      );
    });
}

async function branchValidation(serverStore, asset) {
  let branchListURL =
    serverStore.getServer() +
    "rest/projects/" +
    asset.getProjectId() +
    "/branches/";

  await accessTokenGen(serverStore);

  var headers = {
    "Accept-Language": "en",
    Authorization: "Bearer " + serverStore.getAccessToken(),
  };
  return axios
    .get(branchListURL, { headers: headers })
    .then((response) => {
      if (response.status != 200) {
        throw new Error(
          "Error during retrieval of branches. " +
          branchListURL +
          " returned " +
          response.status +
          " response code. Response: " +
          response.data
        );
      }
      var parsedJSON = response.data;
      var total = parsedJSON.totalElements;
      var RetrievedBranchName;
      var gotBranch = false;
      if (total > 0) {
        for (var i = 0; i < total; i++) {
          RetrievedBranchName = parsedJSON.content[i].name;
          if (asset.getBranch() == RetrievedBranchName) {
            gotBranch = true;
            return true;
          }
        }
        if (gotBranch == false) {
          throw new Error(
            "The branch " +
            asset.getBranch() +
            " was not found in the project " +
            asset.getProject() +
            ". Please check the Branch field in the task."
          );
        }
      } else {
        throw new Error(
          "The branch " +
          asset.getBranch() +
          " was not found in the project " +
          asset.getProject() +
          ". Please check the Branch field in the task."
        );
      }
    })
    .catch((error) => {
      throw new Error(
        "Error when accessing branch list API - " +
        branchListURL +
        ". Error: " +
        error
      );
    });
}

async function AssetIdGenByName(serverStore, asset) {
  var assetId = urlencode(asset.getAssetId);
  var encodedBranchName = urlencode(asset.getBranch());
  var testsListURL =
    serverStore.getServer() +
    "rest/projects/" +
    asset.getProjectId() +
    "/assets/?assetId=" +
    assetId +
    "&revision=" +
    encodedBranchName;

  await accessTokenGen(serverStore);

  var headers = {
    "Accept-Language": "en",
    Authorization: "Bearer " + serverStore.getAccessToken(),
  };
  return axios
    .get(testsListURL, { headers: headers })
    .then((response) => {
      if (response.status != 200) {
        throw new Error(
          "Error during retrieval of testassets. " +
          testsListURL +
          " returned " +
          response.status +
          " response code. Response: " +
          response.data
        );
      }
      var parsedJSON = response.data;
      var total = parsedJSON.totalElements;
      var retrievedAssetId;
      var retrievedRepoId;
      var gotId = false;
      if (total > 0) {
        for (var i = 0; i < total; i++) {
          retrievedAssetId = parsedJSON.content[i].id;
          retrievedRepoId = parsedJSON.content[i].repository_id;
          if (
            retrievedAssetId == asset.getAssetId &&
            retrievedRepoId == asset.getRepoId()
          ) {
            asset.setAssetId(parsedJSON.content[i].id);
            asset.setExternalType(parsedJSON.content[i].external_type);
            asset.setDesktopProjectId(parsedJSON.content[i].desktop_project_id);
            gotId = true;
            return true;
          }
        }
        if (!gotId) {
          throw new Error(
            "The assetId " +
            asset.getAssetId() +
            " was not found in the branch " +
            asset.getBranch() +
            " corresponding to the repository " +
            asset.getRepo() +
            " in the project " +
            asset.getProject() +
            ". Please check the File path field in the task."
          );
        }
      } else {
        throw new Error(
          "The assetId " +
          asset.getAssetId() +
          " was not found in the branch " +
          asset.getBranch() +
          " corresponding to the repository " +
          asset.getRepo() +
          " in the project " +
          asset.getProject() +
          ". Please check the File path field in the task."
        );
      }
    })
    .catch((error) => {
      throw new Error(
        "Error when accessing testassets API - " +
        testsListURL +
        ". Error: " +
        error
      );
    });
}

async function validateEnvironment(serverStore, asset, environment) {
  if (environment == "" || environment == null || environment == undefined) {
    throw new Error(
      "Test Environment is mandatory to run API test. Please input the value in the API Test Environment field in the task."
    );
  }
  asset.setEnvironment(environment);
  var encodedBranchName = urlencode(asset.getBranch());

  var envListURL =
    serverStore.getServer() +
    "rest/projects/" +
    asset.getProjectId() +
    "/assets/?assetTypes=environment&revision=" +
    encodedBranchName +
    "&desktopProjectId=" +
    asset.getDesktopProjectId();

  await accessTokenGen(serverStore);

  var headers = {
    "Accept-Language": "en",
    Authorization: "Bearer " + serverStore.getAccessToken(),
  };
  return axios
    .get(envListURL, { headers: headers })
    .then((response) => {
      if (response.status != 200) {
        throw new Error(
          "Error during retrieval of environments list. " +
          envListURL +
          " returned " +
          response.status +
          " response code. Response: " +
          response.data
        );
      }
      var parsedJSON = response.data;
      var total = parsedJSON.totalElements;
      var RetrievedEnvName;
      var gotEnv = false;
      if (total > 0) {
        for (var i = 0; i < total; i++) {
          RetrievedEnvName = parsedJSON.content[i].name;
          if (asset.getEnvironment() == RetrievedEnvName) {
            gotEnv = true;
            return true;
          }
        }
        if (gotEnv == false) {
          throw new Error(
            "The test environment " +
            asset.getEnvironment() +
            " is not valid for the test. Please check the API Test Environment field in the task."
          );
        }
      } else {
        throw new Error(
          "Test Environments unavailable for the test execution."
        );
      }
    })
    .catch((error) => {
      throw new Error(
        "Error when accessing environments list URL - " +
        envListURL +
        ". Error: " +
        error
      );
    });
}

async function startJobExecution(serverStore, asset, variables, datasets, tags, secretsCollectionName) {
  let jobExecURL =
    serverStore.getServer() +
    "rest/projects/" +
    asset.getProjectId() +
    "/executions/";
  var AssetParameters = {
    testAsset: {
      assetId: asset.getAssetId(),
      revision: asset.getBranch(),
    },
    offlineToken: serverStore.getOfflineToken(),
  };
  if (
    asset.getExternalType() == "APISUITE" ||
    asset.getExternalType() == "APITEST" ||
    asset.getExternalType() == "APISTUB"
  ) {
    AssetParameters["environment"] = asset.getEnvironment();
  }

  if (variables) {
    var str_array = variables.split(';');
    var varObj = {};
    var keyval;
    var key;
    for (var i = 0; i < str_array.length; i++) {
      keyval = str_array[i].split('=');
      key = keyval[0];
      varObj[key] = keyval[1];
    }
    AssetParameters["variables"] = varObj;
  }
  if (datasets) {
    var dataSources = [];
    var sources;
    var str_array = datasets.split(';');
    for (var i = 0; i < str_array.length; i++) {
      var datasetArray = str_array[i].split(':');
      if(datasetArray.length != 2) {
        throw new Error(
          "Please enter Dataset value in format -- SourceDataset:SwapDataset"
        );
      } else if(isEmptyOrSpaces(datasetArray[0])){
        throw new Error(
          "Source Dataset is not given for Swapdataset"
        );
      } else if (isEmptyOrSpaces(datasetArray[1])){
        throw new Error(
          "SwapDataset is not given for Source Dataset"
        );
      }
      await getSrcDataSetId(serverStore, asset, datasetArray[0]);
      await getReplaceDataSetId(serverStore, asset, datasetSrcId, datasetArray);
      sources = {
        "source": {
          "assetId": datasetSrcId
        },
        "replacement": {
          "datasetId": datasetReplaceId
        }
      }
      dataSources.push(sources);
    }


    AssetParameters["dataSources"] = dataSources;
  }
  if (tags) {
    var tag = tags.split(',');
    AssetParameters["tags"] = tag;
  }
  if (secretsCollectionName) {

    await getSecretCollectionId(serverStore, asset, secretsCollectionName);
    AssetParameters["secretsCollection"] = asset.getSecretId();
  }
  await accessTokenGen(serverStore);

  var headers = {
    "Accept-Language": "en",
    "Content-Type": "application/json",
    Authorization: "Bearer " + serverStore.getAccessToken(),
  };
  var body = JSON.stringify(AssetParameters);
  return axios
    .post(jobExecURL, body, { headers: headers })
    .then((response) => {
      if (response.status != 201) {
        throw new Error(
          "Error during launch of test. " +
          jobExecURL +
          " returned " +
          response.status +
          " response code. Response: " +
          response.data
        );
      }
      var parsedJSON = response.data;
      asset.setExecutionId(parsedJSON.id);
      asset.setResultId(parsedJSON.result.id);
      asset.setExecStatus(parsedJSON.status);
      return true;
    })
    .catch((error) => {
      throw new Error(
        "Error when accessing test execution URL - " +
        jobExecURL +
        ". Error: " +
        error
      );
    });
}

function isEmptyOrSpaces(dataset){
  return dataset === null || dataset.match(/^ *$/) !== null;
}

async function getJobStatus(serverStore, asset) {
  var jobStatusURL =
    serverStore.getServer() +
    "rest/projects/" +
    asset.getProjectId() +
    "/executions/" +
    asset.getExecutionId();

  await accessTokenGen(serverStore);

  var headers = {
    "Accept-Language": "en",
    Authorization: "Bearer " + serverStore.getAccessToken(),
  };
  var status;
  return axios
    .get(jobStatusURL, { headers: headers })
    .then((response) => {
      if (response.status != 200) {
        throw new Error(
          "Error during retrieval of test execution status. " +
          jobStatusURL +
          " returned " +
          response.status +
          " response code. Response: " +
          response.data
        );
      }
      var parsedJSON = response.data;
      status = parsedJSON.status;
      if (asset.getExecStatus() != status) {
        asset.setExecStatus(status);
        console.log(
          getDateTime() + " Test Execution Status: " + asset.getExecStatus()
        );
      }
    })
    .catch((error) => {
      throw new Error(
        "Error when accessing test execution status URL - " +
        jobStatusURL +
        ". Error: " +
        error
      );
    });
}

async function pollJobStatus(serverStore, asset) {
  return new Promise((resolve, reject) => {
    var timerId = setInterval(async function () {
      try {
        await getJobStatus(serverStore, asset);
        if (asset.getExternalType() == "APISTUB" && asset.getExecStatus() == Status.RUNNING) {
          asset.setVerdictSet(true);
          asset.setExecStatus(Status.COMPLETE);
          clearInterval(timerId);
          resolve(true);
        }
        if (
          asset.getExecStatus() == Status.COMPLETE ||
          asset.getExecStatus() == Status.COMPLETE_WITH_ERROR ||
          asset.getExecStatus() == Status.STOPPED_BY_USER ||
          asset.getExecStatus() == Status.STOPPED_AUTOMATICALLY ||
          asset.getExecStatus() == Status.INCOMPLETE ||
          asset.getExecStatus() == Status.CANCELED ||
          asset.getExecStatus() == Status.LAUNCH_FAILED
        ) {
          // stop polling on end state
          clearInterval(timerId);
          resolve(true);
        }
        // continue polling...
      } catch (error) {
        // stop polling on any error
        clearInterval(timerId);
        reject(error);
      }
    }, 11000);
  });
}

async function getResults(serverStore, asset) {
  var resultsURL =
    serverStore.getServer() +
    "rest/projects/" +
    asset.getProjectId() +
    "/results/" +
    asset.getResultId();

  await accessTokenGen(serverStore);

  var headers = {
    "Accept-Language": "en",
    Authorization: "Bearer " + serverStore.getAccessToken(),
  };
  return axios
    .get(resultsURL, { headers: headers })
    .then((response) => {
      if (response.status != 200) {
        throw new Error(
          "Error during retrieval of results. " +
          resultsURL +
          " returned " +
          response.status +
          " response code. Response: " +
          response.data
        );
      }
      var parsedJSON = response.data;
      var verdict = parsedJSON.verdict;
      console.log("");
      console.log("Test Result = " + verdict);
      if (verdict == "ERROR" || verdict == "FAIL") {
        asset.setVerdictSet(false);
        var message = parsedJSON.message;
        console.log("");
        console.log("Error Message = " + message);
      } else {
        asset.setVerdictSet(true);
      }
      console.log("");
      if (
        asset.getExecStatus() != Status.CANCELED &&
        asset.getExecStatus() != Status.LAUNCH_FAILED
      ) {
        var total = parsedJSON.reports.length;

        if (total > 0) {
          console.log("Reports information:");
          for (var i = 0; i < total; i++) {
            let reportName = parsedJSON.reports[i].name;
            let reporthref = parsedJSON.reports[i].href;
            console.log(
              reportName +
              " : " +
              url.resolve(serverStore.getServer(), reporthref)
            );
          }
        } else {
          console.log("Reports unavailable.");
        }
      }
      return true;
    })
    .catch((error) => {
      throw new Error(
        "Error when accessing results URL - " + resultsURL + ". Error: " + error
      );
    });
}

function getDateTime() {
  let date_ob = new Date();
  var datetime =
    "[" +
    date_ob.getFullYear() +
    "-" +
    ("0" + (date_ob.getMonth() + 1)).slice(-2) +
    "-" +
    ("0" + date_ob.getDate()).slice(-2) +
    " " +
    ("0" + date_ob.getHours()).slice(-2) +
    ":" +
    ("0" + date_ob.getMinutes()).slice(-2) +
    ":" +
    ("0" + date_ob.getSeconds()).slice(-2) +
    "]";
  return datetime;
}
function TestPlanIdGenByName(azureServer, pat, testPlanName) {

  var testPlanIdUrl = azureServer + "/_apis/test/plans?api-version=5.0";
  var headers = {
    'Accept-Language': "en",
    'Authorization': 'Basic ' + Buffer.from(':' + pat).toString('base64')
  };
  return axios
    .get(testPlanIdUrl, { headers: headers })
    .then((response) => {
      if (response.status == 203) {
        throw new Error("Error during retrieval of Test Plan." +
          testPlanIdUrl + "Invalid Azure DevOps PAT");
      } else if (response.status == 404) {
        throw new Error("Error during retrieval of Test Plan." +
          testPlanIdUrl + "Invalid Azure DevOps Project URL");
      } else if (response.status != 200) {
        throw new Error(
          "Error during retrieval of Test Plan. " +
          testPlanIdUrl +
          " returned " +
          response.status +
          " response code. Response: " +
          response.data
        );
      }
      var parsedJSON = response.data;
      var total = parsedJSON.count;
      var retrievedTestPlanName;
      var idFound = false;
      if (total > 0) {
        for (var i = 0; i < total; i++) {

          retrievedTestPlanName = parsedJSON.value[i].name;
          if (retrievedTestPlanName == testPlanName) {
            testPlanId = parsedJSON.value[i].id;
            idFound = true;
          }
        }
        if (idFound == false) {
          throw new Error("Test Plan " + testPlanName + " not found.");
        }
      }
      else {
        throw new Error("Test Plan " + testPlanName + " not found.");
      }
      return true;
    }).catch((error) => {
      throw new Error(
        "Error when accessing Azure Test Plan URL - " + testPlanIdUrl + ". Error: " + error
      );
    });
}

function TestSuiteId(azureServer, pat, testPlanId, testPlanName) {
  var testSuiteIdUrl = azureServer + "/_apis/test/plans/" + testPlanId + "/suites?api-version=5.0";
  var headers = {
    'Accept-Language': "en",
    'Authorization': 'Basic ' + Buffer.from(':' + pat).toString('base64')
  };
  return axios
    .get(testSuiteIdUrl, { headers: headers })
    .then((response) => {
      if (response.status != 200) {
        throw new Error(
          "Error during retrieval of Test Suite. " +
          testSuiteIdUrl +
          " returned " +
          response.status +
          " response code. Response: " +
          response.data
        );
      }
      var parsedJSON = response.data;
      var total = parsedJSON.count;
      var retrievedTestPlanName;
      var gotId = false;
      if (total > 0) {
        for (var i = 0; i < total; i++) {

          retrievedTestPlanName = parsedJSON.value[i].name;
          if (retrievedTestPlanName == testPlanName) {
            testSuiteId = parsedJSON.value[i].id;
            gotId = true;
          }
        }
        if (gotId == false) {
          throw new Error("Test Suites " + testPlanName + " not found.");
        }
      }
      else {
        throw new Error("Test Suites " + testPlanName + " not found.");
      }
      return true;
    })
    .catch((error) => {
      throw new Error(
        "Error when accessing Test Suites URL - " + testSuiteIdUrl + ". Error: " + error
      );
    });
}

function TestCaseIdByName(azureServer, pat, testPlanId, testSuiteId, testCaseName) {
  var testCaseIdUrl = azureServer + "/_apis/test/plans/" + testPlanId + "/suites/" + testSuiteId + "/points?api-version=5.0";
  var headers = {
    'Accept-Language': "en",
    'Authorization': 'Basic ' + Buffer.from(':' + pat).toString('base64')
  };

  return axios
    .get(testCaseIdUrl, { headers: headers })
    .then((response) => {
      if (response.status != 200) {
        throw new Error(
          "Error during retrieval of Test Case. " +
          testCaseIdUrl +
          " returned " +
          response.status +
          " response code. Response: " +
          response.data
        );
      }
      var parsedJSON = response.data;
      var total = parsedJSON.count;
      var retrievedTestCaseName;
      var gotId = false;
      if (total > 0) {
        for (var i = 0; i < total; i++) {

          retrievedTestCaseName = parsedJSON.value[i].testCase.name;
          if (retrievedTestCaseName == testCaseName) {
            testCaseId = parsedJSON.value[i].testCase.id;
            gotId = true;
          }
        }
        if (gotId == false) {
          throw new Error("Test Case " + testCaseName + " not found.");
        }
      }
      else {
        throw new Error("Test Case " + testCaseName + " not found.");
      }
      return true;
    })
    .catch((error) => {
      throw new Error(
        "Error when accessing Test Case URL - " + testCaseIdUrl + ". Error: " + error
      );
    });
}

function TestCasePoint(azureServer, pat, testPlanId, testSuiteId, testCaseId) {
  var testPointIdUrl = azureServer + "/_apis/test/plans/" + testPlanId + "/suites/" + testSuiteId + "/points?testCaseId=" + testCaseId + "&api-version=5.0";
  var headers = {
    'Accept-Language': "en",
    'Authorization': 'Basic ' + Buffer.from(':' + pat).toString('base64')
  };

  return axios
    .get(testPointIdUrl, { headers: headers })
    .then((response) => {
      if (response.status != 200) {
        throw new Error(
          "Error during retrieval of Test Point. " +
          testPointIdUrl +
          " returned " +
          response.status +
          " response code. Response: " +
          response.data
        );
      }
      var parsedJSON = response.data;
      var total = parsedJSON.count;

      var gotId = false;
      if (total > 0) {
        for (var i = 0; i < total; i++) {

          testPointId = parsedJSON.value[i].id;

          gotId = true;
        }
        if (gotId == false) {
          throw new Error("No Test Point found");
        }
      }
      else {
        throw new Error("No Test Point found");
      }
      return true;
    })
    .catch((error) => {
      throw new Error(
        "Error when accessing Test Point URL - " + testPointIdUrl + ". Error: " + error
      );
    });
}
function createTestRun(azureServer, pat, testPlanId, testSuiteId, testPointId, testCaseName) {

  let runURL = azureServer + "/_apis/test/runs?api-version=5.0";
  var headers = {
    'Accept-Language': "en",
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + Buffer.from(':' + pat).toString('base64')
  };
  let runParameters;
  if (azureServer === azureTaskServer.concat(teamProject)) {
    runParameters =
    {

      "name": testCaseName + "Run",
      "plan": {
        "id": testPlanId
      },
      "pointIds": [
        testPointId
      ],
      build: {
        "id": buildId
      }
    };
  } else {
    runParameters =
    {

      "name": testCaseName + "Run",
      "plan": {
        "id": testPlanId
      },
      "pointIds": [
        testPointId
      ]
    };
  }
  var body = JSON.stringify(runParameters);
  return axios
    .post(runURL, body, { headers: headers })
    .then((response) => {
      if (response.status != 200) {
        throw new Error(
          "Error during Creating Test Run. " +
          runURL +
          " returned " +
          response.status +
          " response code. Response: " +
          response.data
        );
      }
      var parsedJSON = response.data;
      runId = parsedJSON.id;
      return true;
    })
    .catch((error) => {
      throw new Error(
        "Error when accessing Test Run URL - " +
        runURL +
        ". Error: " +
        error
      );
    });
}
function getResultId(azureServer, pat, testPlanId, testSuiteId, testPointId, testCaseName, runId) {
  let resultURL = azureServer + "/_apis/test/runs/" + runId + "/results?api-version=5.0";
  var headers = {
    'Accept-Language': "en",
    'Authorization': 'Basic ' + Buffer.from(':' + pat).toString('base64')
  };
  return axios
    .get(resultURL, { headers: headers })
    .then((response) => {
      if (response.status != 200) {
        throw new Error(
          "Error While accessing Test Results. " +
          resultURL +
          " returned " +
          response.status +
          " response code. Response: " +
          response.data
        );
      }
      var parsedJSON = response.data;
      azureResultId = parsedJSON.value[0].id;
      return true;
    })
    .catch((error) => {
      throw new Error(
        "Error when accessing Test Results URL - " +
        resultURL +
        ". Error: " +
        error
      );
    });

}
function updateTestResults(azureServer, pat, azureResultId, runId, isFailed) {
  let updateResultURL = azureServer + "/_apis/test/runs/" + runId + "/results?api-version=5.0";
  var outcome = "PASSED";
  var comment = "Test Execution Successful.";
  if (isFailed) {
    outcome = "FAILED";
    comment = "Test Execution Failed.";
  }
  var updateResultsParameters =
    [{
      "id": azureResultId,
      "outcome": outcome,
      "state": "Completed",
      "comment": comment
    }];
  var headers = {
    'Accept-Language': "en",
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + Buffer.from(':' + pat).toString('base64')
  };

  var body = JSON.stringify(updateResultsParameters);
  return axios
    .patch(updateResultURL, body, { headers: headers })
    .then((response) => {
      if (response.status != 200) {
        throw new Error(
          "Error during updating Test Results. " +
          updateResultURL +
          " returned " +
          response.status +
          " response code. Response: " +
          response.data
        );
      }
      var parsedJSON = response.data;
      return true;
    })
    .catch((error) => {
      throw new Error(
        "Error while updating Test Results  - " +
        updateResultURL +
        ". Error: " +
        error
      );
    });

}

async function getSrcDataSetId(serverStore, asset, srcDataSet) {
  let datasetURL = serverStore.getServer() + "rest/projects/" + asset.getProjectId() + "/assets/" + asset.getAssetId() + "/" + asset.getBranch() + "/dependencies/?assetTypes=dataset";
  await accessTokenGen(serverStore);

  var headers = {
    "Accept-Language": "en",
    Authorization: "Bearer " + serverStore.getAccessToken(),
  };
  return axios
    .get(datasetURL, { headers: headers })
    .then((response) => {
      if (response.status != 200) {
        throw new Error(
          "Error during retrieval of Source data set ID. " +
          datasetURL +
          " returned " +
          response.status +
          " response code. Response: " +
          response.data
        );
      }
      var parsedJSON = response.data;
      var total = parsedJSON.totalElements;
      var retrievedDatasetName;
      var gotId = false;
      if (total > 0) {
        for (var i = 0; i < total; i++) {

          retrievedDatasetName = parsedJSON.content[i].path;
          if (srcDataSet == retrievedDatasetName) {
            datasetSrcId = parsedJSON.content[i].id;
            gotId = true;
            return true;
          }
        }
        if (!gotId) {
          throw new Error(
            "No Dataset configured for the Asset"
          );
        }
      } else {
        throw new Error(
          "No Dataset configured for the Asset"
        );
      }
    })
    .catch((error) => {
      throw new Error(
        "Error when accessing DataSet API - " +
        datasetURL +
        ". Error: " +
        error
      );
    });
}

async function getReplaceDataSetId(serverStore, asset, srcDataSetId, datasetArray) {
  let repDataUrl = serverStore.getServer() + "rest/projects/" + asset.getProjectId() + "/datasets/?branch=" + asset.getBranch() + "&assetId=" + srcDataSetId + "&findSwaps=true";
  await accessTokenGen(serverStore);

  var headers = {
    "Accept-Language": "en",
    Authorization: "Bearer " + serverStore.getAccessToken(),
  };
  return axios
    .get(repDataUrl, { headers: headers })
    .then((response) => {
      if (response.status != 200) {
        throw new Error(
          "Error during retrieval of Source data set ID. " +
          repDataUrl +
          " returned " +
          response.status +
          " response code. Response: " +
          response.data
        );
      }
      var parsedJSON = response.data;
      var total = parsedJSON.data.length;
      var retrievedDatasetName;
      var gotId = false;
      if (total > 0) {
        for (var i = 0; i < total; i++) {
          retrievedDatasetName = parsedJSON.data[i].displayPath;
          if (datasetArray[1] == retrievedDatasetName) {
            datasetReplaceId = parsedJSON.data[i].datasetId;
            gotId = true;
            return true;
          }
        }
        if (!gotId) {
          throw new Error(
            "SwapDataset ("+datasetArray[1]+") is not configured for Source DataSet ("+datasetArray[1]+")"
          );
        }
      } else {
        throw new Error(
          "No Swap configured for the DataSets"
        );
      }
    })
    .catch((error) => {
      throw new Error(
        "Error when accessing DataSet Swap API - " +
        repDataUrl +
        ". Error: " +
        error
      );
    });
}
async function getSecretCollectionId(serverStore, asset, secretCollectionName) {

  let secretUrl = serverStore.getServer() + "rest/projects/" + asset.getProjectId() + "/secrets/?type=ENVIRONMENT";
  await accessTokenGen(serverStore);

  var headers = {
    "Accept-Language": "en",
    Authorization: "Bearer " + serverStore.getAccessToken(),
  };
  return axios
    .get(secretUrl, { headers: headers })
    .then((response) => {
      if (response.status != 200) {
        throw new Error(
          "Error during retrieval of Secret Collection ID. " +
          secretUrl +
          " returned " +
          response.status +
          " response code. Response: " +
          response.data
        );
      }
      var parsedJSON = response.data;
      var total = parsedJSON.data.length;
      var retsecretCollectionName;
      var gotId = false;
      if (total > 0) {
        for (var i = 0; i < total; i++) {
          var respData = parsedJSON.data[i];
          retsecretCollectionName = respData.name;
          if (secretCollectionName == retsecretCollectionName) {
            asset.setSecretId(respData.id);
            gotId = true;
            return true;
          }
        }
        if (!gotId) {
          throw new Error(
            "Secret collection does not available on server."
          );
        }
      } else {
        throw new Error(
          "No Secret configured."
        );
      }
    })
    .catch((error) => {
      throw new Error(
        "Error when accessing Secret Collection API - " +
        secretUrl +
        ". Error: " +
        error
      );
    });
}

async function getJunitReport(serverStore, asset, exportReport) {
  var resultsURL =
    serverStore.getServer() +
    "rest/projects/" +
    asset.getProjectId() +
    "/results/" +
    asset.getResultId() +
    "/data/views/surefire/";

  await accessTokenGen(serverStore);
  return axios({
    url: resultsURL,
    method: 'GET',
    responseType: 'blob',
    headers: {
      'Content-Disposition': 'attachment',
      "Accept-Language": "en",
      Authorization: "Bearer " + serverStore.getAccessToken(),
    }
  }).then((response) => {
      fs.writeFile(exportReport, response.data, (err) => {
        if (err) throw err;
        console.log('The file has been saved!');
      })
    })
    .catch((error) => {
      throw new Error(
        "Error when accessing results URL - " + resultsURL + ". Error: " + error
      );
    });
}

run();
