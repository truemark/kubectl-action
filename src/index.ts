import * as core from '@actions/core';
import * as exec from '@actions/exec';
import axios from 'axios';

async function execCommand(command: string, args: string[], debugEnabled: boolean): Promise<string> {
  try {
    let output = '';
    let errorOutput = '';

    await exec.exec(command, args, {
      silent: !debugEnabled,
      listeners: {
        stdout: (data: Buffer) => (output += data.toString()),
        stderr: (data: Buffer) => (errorOutput += data.toString())
      }
    });

    if (errorOutput) {
      core.warning(`⚠️ Command Warning: ${command} ${args.join(' ')}\n${errorOutput}`);
    }

    return output.trim();
  } catch (error) {
    core.error(`❌ Command Failed: ${command} ${args.join(' ')}\nError: ${error}`);
    throw new Error(`Execution failed: ${command} ${args.join(' ')}\n${error}`);
  }
}

// Generic function to download and install CLI tools with validation
async function installFromURL(toolName: string, url: string, debugEnabled: boolean): Promise<void> {
  core.info(`🔍 Downloading ${toolName} from: ${url}`);

  const binPath = `${process.env.HOME}/bin`;
  const destination = `${binPath}/${toolName}`;

  await execCommand('mkdir', ['-p', binPath], debugEnabled);
  await execCommand('curl', ['-sSL', '-o', destination, url], debugEnabled);

  // Validate Download
  const fileCheck = await exec.exec('file', [destination], { silent: true, ignoreReturnCode: true });
  if (fileCheck !== 0) {
    core.setFailed(`❌ Failed to download ${toolName} from ${url}`);
    return;
  }

  await execCommand('chmod', ['+x', destination], debugEnabled);
  core.addPath(binPath);
  core.info(`✅ Installed ${toolName} at ${destination}`);
}

// Install Helm with validation
async function installHelm(version: string, debugEnabled: boolean): Promise<void> {
  const helmUrl = `https://get.helm.sh/helm-v${version}-linux-amd64.tar.gz`;
  core.info(`🔍 Downloading Helm from: ${helmUrl}`);

  await execCommand('curl', ['-sSL', '-o', '/tmp/helm.tar.gz', helmUrl], debugEnabled);

  // Validate download
  const fileCheck = await execCommand('file', ['/tmp/helm.tar.gz'], debugEnabled);
  if (!fileCheck.includes("gzip compressed data")) {
    throw new Error(`❌ Invalid Helm archive downloaded from ${helmUrl}`);
  }

  // Extract Helm
  await execCommand('tar', ['-xz', '-f', '/tmp/helm.tar.gz', '-C', '/tmp'], debugEnabled);
  const helmBinaryPath = '/tmp/linux-amd64/helm';

  // Fix: Use /usr/local/bin instead of $HOME/bin
  const installDir = '/usr/local/bin';
  await execCommand('sudo', ['mv', helmBinaryPath, `${installDir}/helm`], debugEnabled);
  await execCommand('sudo', ['chmod', '+x', `${installDir}/helm`], debugEnabled);

  core.info(`✅ Helm installed at ${installDir}/helm`);
}

// Install Kubectl
async function installKubectl(version: string, debugEnabled: boolean): Promise<void> {
  let kubectlVersion = version;

  if (version === 'stable') {
    core.info('🔍 Fetching latest stable kubectl version...');
    kubectlVersion = (await axios.get('https://dl.k8s.io/release/stable.txt')).data.trim();
  }

  const kubectlUrl = `https://dl.k8s.io/release/${kubectlVersion}/bin/linux/amd64/kubectl`;
  await installFromURL('kubectl', kubectlUrl, debugEnabled);
}

async function getLatestYQVersion(): Promise<string> {
  try {
    const response = await axios.get('https://api.github.com/repos/mikefarah/yq/releases/latest');
    return response.data.tag_name.replace(/^v/, '');
  } catch (error) {
    core.warning(`⚠️ Failed to fetch latest YQ version, falling back to default.`);
    return '4.30.6';
  }
}

// Install YQ with validation

async function installYQ(version: string, debugEnabled: boolean): Promise<void> {
  const resolvedVersion = version === 'latest' ? await getLatestYQVersion() : version;
  const yqUrl = `https://github.com/mikefarah/yq/releases/download/v${resolvedVersion}/yq_linux_amd64`;
  const binPath = `${process.env.HOME}/bin`;
  const destination = `${binPath}/yq`;

  core.info(`🔍 Downloading YQ from: ${yqUrl}`);

  await execCommand('mkdir', ['-p', binPath], debugEnabled);
  await execCommand('curl', ['-sSL', '-o', destination, yqUrl], debugEnabled);

  // Validate download success
  const fileCheck = await exec.exec('file', [destination], { silent: true, ignoreReturnCode: true });

  if (fileCheck !== 0) {
    core.setFailed(`❌ Failed to download a valid YQ binary from ${yqUrl}`);
    return;
  }

  await execCommand('chmod', ['+x', destination], debugEnabled);
  core.addPath(binPath);

  core.info(`✅ Installed yq at ${destination}`);
}

async function getLatestArgoCDVersion(): Promise<string> {
  try {
    const response = await axios.get('https://api.github.com/repos/argoproj/argo-cd/releases/latest');
    return response.data.tag_name.replace(/^v/, ''); // Remove "v" prefix if present
  } catch (error) {
    core.warning(`⚠️ Failed to fetch latest ArgoCD version, falling back to default.`);
    return '2.9.3'; // Use a stable fallback version
  }
}

// Install ArgoCD CLI with validation
async function installArgoCD(version: string, debugEnabled: boolean): Promise<void> {
  const resolvedVersion = version === 'latest' ? await getLatestArgoCDVersion() : version;
  const argoUrl = `https://github.com/argoproj/argo-cd/releases/download/v${resolvedVersion}/argocd-linux-amd64`;
  const binPath = `${process.env.HOME}/bin`;
  const destination = `${binPath}/argocd`;

  core.info(`🔍 Downloading ArgoCD from: ${argoUrl}`);

  await execCommand('mkdir', ['-p', binPath], debugEnabled);
  await execCommand('curl', ['-sSL', '-o', destination, argoUrl], debugEnabled);

  // Validate the file is a binary
  const fileCheck = await exec.exec('file', [destination], { silent: true, ignoreReturnCode: true });

  if (fileCheck !== 0) {
    core.setFailed(`❌ Failed to download a valid ArgoCD binary from ${argoUrl}`);
    return;
  }

  await execCommand('chmod', ['+x', destination], debugEnabled);
  core.addPath(binPath);

  core.info(`✅ Installed ArgoCD at ${destination}`);
}

// Run the action
async function run(): Promise<void> {
  try {
    core.addPath(`${process.env.HOME}/bin`);
    const debugEnabled = core.getInput('tools-debug-enabled') === 'true';

    const helmEnabled = core.getInput('helm-enabled') === 'true';
    const kubectlEnabled = core.getInput('kubectl-enabled') === 'true';
    const yqEnabled = core.getInput('yq-enabled') === 'true';
    const argocdEnabled = core.getInput('argocd-enabled') === 'true';

    const helmVersion = core.getInput('helm-version');
    const kubectlVersion = core.getInput('kubectl-version');
    const yqVersion = core.getInput('yq-version');
    const argocdVersion = core.getInput('argocd-version');

    const installTasks = [];

    if (helmEnabled) installTasks.push(installHelm(helmVersion, debugEnabled));
    if (kubectlEnabled) installTasks.push(installKubectl(kubectlVersion, debugEnabled));
    if (yqEnabled) installTasks.push(installYQ(yqVersion, debugEnabled));
    if (argocdEnabled) installTasks.push(installArgoCD(argocdVersion, debugEnabled));

    await Promise.all(installTasks);
    core.info("✅ All enabled tools installed successfully!");

    const userCommand = core.getInput('command');
    if (userCommand) {
      core.info(`🚀 Executing user command: ${userCommand}`);
      await execCommand('bash', ['-c', userCommand], debugEnabled);
    }

  } catch (error) {
    core.setFailed(`❌ Workflow failed: ${(error as Error).message}`);
  }
}

run();
