import * as core from '@actions/core';
import * as exec from '@actions/exec';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Utility function to control debug logs
function log(message: string, debugEnabled: boolean): void {
  if (debugEnabled) {
    core.info(message);
  }
}

// Execute a command and handle errors properly
async function execCommand(command: string, args: string[] = [], debugEnabled: boolean): Promise<void> {
  const options = {
    silent: false,
    listeners: {
      stdout: (data: Buffer) => debugEnabled && core.info(data.toString()),
      stderr: (data: Buffer) => core.error(data.toString()),
    },
  };

  try {
    await exec.exec(command, args, options);
  } catch (error) {
    core.error(`❌ Error executing: ${command} ${args.join(' ')}`);
    core.setFailed((error as Error).message);
    throw error;
  }
}

// Install a tool and place it in ~/bin
async function installTool(toolName: string, binaryPath: string, debugEnabled: boolean): Promise<void> {
  const binPath = `${process.env.HOME}/bin`;
  const destinationPath = `${binPath}/${toolName}`;

  try {
    await execCommand('mkdir', ['-p', binPath], debugEnabled);
    await execCommand('mv', [binaryPath, destinationPath], debugEnabled);
    await execCommand('chmod', ['+x', destinationPath], debugEnabled);
    core.addPath(binPath);

    core.info(`✅ ${toolName} installed successfully at ${destinationPath}`);
  } catch (error) {
    core.setFailed(`❌ Failed to install ${toolName}: ${(error as Error).message}`);
  }
}

// Check if a tool is installed
async function isToolInstalled(command: string, versionFlag: string, expectedVersion: string, debugEnabled: boolean): Promise<boolean> {
  try {
    let output = '';
    const options = {
      silent: !debugEnabled,
      listeners: {
        stdout: (data: Buffer) => (output += data.toString()),
      },
    };
    await exec.exec(command, [versionFlag], options);

    return output.includes(expectedVersion);
  } catch {
    return false;
  }
}

// Handle Base64-encoded Kubeconfig
async function handleKubeconfig(kubeconfigBase64: string, debugEnabled: boolean): Promise<void> {
  if (!kubeconfigBase64.trim()) {
    core.info('⚠️ No KUBECONFIG provided. Skipping configuration.');
    return;
  }

  try {
    const kubeconfig = Buffer.from(kubeconfigBase64, 'base64').toString('utf-8');
    const kubeconfigPath = path.join('/tmp', 'kubeconfig');
    fs.writeFileSync(kubeconfigPath, kubeconfig, { encoding: 'utf-8' });
    fs.chmodSync(kubeconfigPath, 0o600);
    process.env.KUBECONFIG = kubeconfigPath;
    log(`✅ KUBECONFIG set to ${kubeconfigPath}`, debugEnabled);
  } catch (error) {
    core.setFailed(`❌ Failed to set KUBECONFIG: ${(error as Error).message}`);
  }
}

// Install Helm
async function installHelm(version: string, debugEnabled: boolean): Promise<void> {
  if (await isToolInstalled('helm', 'version --short', `v${version}`, debugEnabled)) {
    core.info(`✅ Helm ${version} is already installed.`);
    return;
  }

  core.info(`Installing Helm ${version}...`);
  const helmUrl = version === 'stable'
    ? 'https://get.helm.sh/helm-v3.13.0-linux-amd64.tar.gz'
    : `https://get.helm.sh/helm-v${version}-linux-amd64.tar.gz`;

  await execCommand('curl', ['-sSL', '-o', '/tmp/helm.tar.gz', helmUrl], debugEnabled);
  await execCommand('tar', ['-xz', '-f', '/tmp/helm.tar.gz', '-C', '/tmp'], debugEnabled);

  await installTool('helm', '/tmp/linux-amd64/helm', debugEnabled);
}

// Install Kubectl
async function installKubectl(version: string, debugEnabled: boolean): Promise<void> {
  if (await isToolInstalled('kubectl', 'version --client --short', `v${version}`, debugEnabled)) {
    core.info(`✅ Kubectl ${version} is already installed.`);
    return;
  }

  core.info(`Installing Kubectl ${version}...`);
  const stableVersionUrl = 'https://dl.k8s.io/release/stable.txt';
  const kubectlUrl = version === 'stable'
    ? `https://dl.k8s.io/release/${(await axios.get(stableVersionUrl)).data.trim()}/bin/linux/amd64/kubectl`
    : `https://dl.k8s.io/release/v${version}/bin/linux/amd64/kubectl`;

  await execCommand('curl', ['-sSL', '-o', '/tmp/kubectl', kubectlUrl], debugEnabled);
  await installTool('kubectl', '/tmp/kubectl', debugEnabled);
}

// Install YQ
async function installYQ(version: string, debugEnabled: boolean): Promise<void> {
  if (await isToolInstalled('yq', '--version', `version ${version}`, debugEnabled)) {
    core.info(`✅ YQ ${version} is already installed.`);
    return;
  }

  core.info(`Installing YQ ${version}...`);
  const yqUrl = `https://github.com/mikefarah/yq/releases/download/v${version}/yq_linux_amd64`;

  await execCommand('curl', ['-sSL', '-o', '/tmp/yq', yqUrl], debugEnabled);
  await installTool('yq', '/tmp/yq', debugEnabled);
}

// Install ArgoCD CLI
async function installArgoCD(version: string, debugEnabled: boolean): Promise<void> {
  if (await isToolInstalled('argocd', 'version --client', `v${version}`, debugEnabled)) {
    core.info(`✅ ArgoCD ${version} is already installed.`);
    return;
  }

  core.info(`Installing ArgoCD ${version}...`);
  const argocdUrl = `https://github.com/argoproj/argo-cd/releases/download/v${version}/argocd-linux-amd64`;

  await execCommand('curl', ['-sSL', '-o', '/tmp/argocd', argocdUrl], debugEnabled);
  await installTool('argocd', '/tmp/argocd', debugEnabled);
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
    const kubeconfigBase64 = core.getInput('kubeconfig');

    if (kubeconfigBase64) await handleKubeconfig(kubeconfigBase64, debugEnabled);
    if (helmEnabled) await installHelm(helmVersion, debugEnabled);
    if (kubectlEnabled) await installKubectl(kubectlVersion, debugEnabled);
    if (yqEnabled) await installYQ(yqVersion, debugEnabled);
    if (argocdEnabled) await installArgoCD(argocdVersion, debugEnabled);

  } catch (error) {
    core.setFailed(`❌ Workflow failed: ${(error as Error).message}`);
  }
}

run();
