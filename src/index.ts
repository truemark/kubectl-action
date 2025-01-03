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

async function execCommand(command: string, args: string[] = [], debugEnabled: boolean): Promise<void> {
  const options = debugEnabled ? {} : { silent: true };  // Silent unless debugging is enabled
  await exec.exec(command, args, options);
}

async function handleKubeconfig(kubeconfigBase64: string, debugEnabled: boolean): Promise<void> {
  if (!kubeconfigBase64 || kubeconfigBase64.trim() === '') {
    core.info('No Base64-encoded KUBECONFIG provided. Skipping configuration.');
    return;
  }

  try {
    core.info('Decoding Base64-encoded KUBECONFIG...');
    const kubeconfig = Buffer.from(kubeconfigBase64, 'base64').toString('utf-8');
    const kubeconfigPath = path.join('/tmp', 'kubeconfig');
    fs.writeFileSync(kubeconfigPath, kubeconfig, { encoding: 'utf-8' });
    fs.chmodSync(kubeconfigPath, 0o600);
    process.env.KUBECONFIG = kubeconfigPath;
    log(`KUBECONFIG set to ${kubeconfigPath}`, debugEnabled);
  } catch (error) {
    core.setFailed(`Failed to decode and set KUBECONFIG: ${(error as Error).message}`);
  }
}

async function installHelm(version: string, debugEnabled: boolean): Promise<void> {
  core.info(`Installing Helm version ${version}...`);

  const helmUrl = version === 'stable'
    ? 'https://get.helm.sh/helm-v3.13.0-linux-amd64.tar.gz'
    : `https://get.helm.sh/helm-v${version}-linux-amd64.tar.gz`;

  log(`Downloading Helm from ${helmUrl}`, debugEnabled);
  await execCommand('curl', ['-sSL', '-o', '/tmp/helm.tar.gz', helmUrl], debugEnabled);
  await execCommand('tar', ['-xz', '-f', '/tmp/helm.tar.gz', '-C', '/tmp'], debugEnabled);

  const helmBinaryPath = '/tmp/linux-amd64/helm';
  let destinationPath = '/usr/local/bin/helm';

  try {
    await execCommand('mv', [helmBinaryPath, destinationPath], debugEnabled);
    await execCommand('chmod', ['+x', destinationPath], debugEnabled);
  } catch (error) {
    const fallbackPath = `${process.env.HOME}/bin`;
    destinationPath = `${fallbackPath}/helm`;
    log(`/usr/local/bin not writable. Falling back to ${destinationPath}`, debugEnabled);
    await execCommand('mkdir', ['-p', fallbackPath], debugEnabled);
    await execCommand('mv', [helmBinaryPath, destinationPath], debugEnabled);
    await execCommand('chmod', ['+x', destinationPath], debugEnabled);
    core.addPath(fallbackPath);
  }

  core.info(`Helm ${version} installed successfully.`);
}

async function installKubectl(version: string, debugEnabled: boolean): Promise<void> {
  core.info(`Installing Kubectl version ${version}...`);

  const stableVersionUrl = 'https://dl.k8s.io/release/stable.txt';
  const kubectlUrl = version === 'stable'
    ? `https://dl.k8s.io/release/${(await axios.get(stableVersionUrl)).data.trim()}/bin/linux/amd64/kubectl`
    : `https://dl.k8s.io/release/v${version}/bin/linux/amd64/kubectl`;

  log(`Downloading Kubectl from ${kubectlUrl}`, debugEnabled);
  const kubectlBinaryPath = '/tmp/kubectl';
  let destinationPath = '/usr/local/bin/kubectl';

  try {
    await execCommand('curl', ['-sSL', '-o', kubectlBinaryPath, kubectlUrl], debugEnabled);
    await execCommand('mv', [kubectlBinaryPath, destinationPath], debugEnabled);
    await execCommand('chmod', ['+x', destinationPath], debugEnabled);
  } catch (error) {
    const fallbackPath = `${process.env.HOME}/bin`;
    destinationPath = `${fallbackPath}/kubectl`;
    log(`/usr/local/bin not writable. Falling back to ${destinationPath}`, debugEnabled);
    await execCommand('mkdir', ['-p', fallbackPath], debugEnabled);
    await execCommand('mv', [kubectlBinaryPath, destinationPath], debugEnabled);
    await execCommand('chmod', ['+x', destinationPath], debugEnabled);
    core.addPath(fallbackPath);
  }

  core.info(`Kubectl ${version} installed successfully.`);
}

async function installYQ(version: string, debugEnabled: boolean): Promise<void> {
  core.info(`Installing YQ version ${version}...`);

  const yqUrl = version === 'latest'
    ? 'https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64'
    : `https://github.com/mikefarah/yq/releases/download/v${version}/yq_linux_amd64`;

  log(`Downloading YQ from ${yqUrl}`, debugEnabled);
  const yqBinaryPath = '/tmp/yq';
  let destinationPath = '/usr/local/bin/yq';

  try {
    await execCommand('curl', ['-sSL', '-o', yqBinaryPath, yqUrl], debugEnabled);
    await execCommand('mv', [yqBinaryPath, destinationPath], debugEnabled);
    await execCommand('chmod', ['+x', destinationPath], debugEnabled);
  } catch (error) {
    const fallbackPath = `${process.env.HOME}/bin`;
    destinationPath = `${fallbackPath}/yq`;
    log(`/usr/local/bin not writable. Falling back to ${destinationPath}`, debugEnabled);
    await execCommand('mkdir', ['-p', fallbackPath], debugEnabled);
    await execCommand('mv', [yqBinaryPath, destinationPath], debugEnabled);
    await execCommand('chmod', ['+x', destinationPath], debugEnabled);
    core.addPath(fallbackPath);
  }

  core.info(`YQ ${version} installed successfully.`);
}

async function installArgoCD(version: string, debugEnabled: boolean): Promise<void> {
  core.info(`Installing ArgoCD CLI version ${version}...`);

  const argocdUrl = version === 'latest'
    ? 'https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64'
    : `https://github.com/argoproj/argo-cd/releases/download/v${version}/argocd-linux-amd64`;

  log(`Downloading ArgoCD CLI from ${argocdUrl}`, debugEnabled);
  const argocdBinaryPath = '/tmp/argocd';
  let destinationPath = '/usr/local/bin/argocd';

  try {
    await execCommand('curl', ['-sSL', '-o', argocdBinaryPath, argocdUrl], debugEnabled);
    await execCommand('chmod', ['+x', argocdBinaryPath], debugEnabled);
    await execCommand('mv', [argocdBinaryPath, destinationPath], debugEnabled);
  } catch (error) {
    const fallbackPath = `${process.env.HOME}/bin`;
    destinationPath = `${fallbackPath}/argocd`;
    log(`/usr/local/bin not writable. Falling back to ${destinationPath}`, debugEnabled);
    await execCommand('mkdir', ['-p', fallbackPath], debugEnabled);
    await execCommand('mv', [argocdBinaryPath, destinationPath], debugEnabled);
    await execCommand('chmod', ['+x', destinationPath], debugEnabled);
    core.addPath(fallbackPath);
  }

  core.info(`ArgoCD CLI ${version} installed successfully.`);
}

async function installArgoCLI(version: string, debugEnabled: boolean): Promise<void> {
  core.info(`Installing Argo CLI version ${version}...`);

  const osType = process.platform === 'darwin' ? 'darwin' : 'linux';
  const argoFile = `argo-${osType}-amd64.gz`;
  const argoBinaryPath = `/tmp/argo-${osType}-amd64`;

  if (!version.startsWith('v')) {
    version = `v${version}`;
  }

  const downloadUrl = `https://github.com/argoproj/argo-workflows/releases/download/${version}/${argoFile}`;

  log(`Downloading Argo CLI from ${downloadUrl}`, debugEnabled);
  try {
    await execCommand('curl', ['-sSL', '-o', `${argoBinaryPath}.gz`, downloadUrl], debugEnabled);
    await execCommand('gunzip', ['-f', `${argoBinaryPath}.gz`], debugEnabled);
    await execCommand('chmod', ['+x', argoBinaryPath], debugEnabled);

    let destinationPath = '/usr/local/bin/argo';

    try {
      await execCommand('mv', [argoBinaryPath, destinationPath], debugEnabled);
    } catch (error) {
      const fallbackPath = `${process.env.HOME}/bin`;
      destinationPath = `${fallbackPath}/argo`;
      log(`/usr/local/bin not writable. Falling back to ${destinationPath}`, debugEnabled);
      await execCommand('mkdir', ['-p', path.dirname(fallbackPath)], debugEnabled);
      await execCommand('mv', [argoBinaryPath, destinationPath], debugEnabled);
      core.addPath(path.dirname(fallbackPath));
    }

    core.info(`Argo CLI ${version} installed successfully.`);
  } catch (error) {
    core.setFailed(`Failed to install Argo CLI: ${(error as Error).message}`);
  }
}

async function run(): Promise<void> {
  try {
    const debugEnabled = core.getInput('debug-enabled') === 'true';

    const helmEnabled = core.getInput('helm-enabled') === 'true';
    const kubectlEnabled = core.getInput('kubectl-enabled') === 'true';
    const yqEnabled = core.getInput('yq-enabled') === 'true';
    const argocdEnabled = core.getInput('argocd-enabled') === 'true';
    const argoEnabled = core.getInput('argo-enabled') === 'true';

    const helmVersion = core.getInput('helm-version');
    const kubectlVersion = core.getInput('kubectl-version');
    const yqVersion = core.getInput('yq-version');
    const argocdVersion = core.getInput('argocd-version');
    const argoVersion = core.getInput('argo-version');
    const kubeconfigBase64 = core.getInput('kubeconfig');

    if (kubeconfigBase64) {
      await handleKubeconfig(kubeconfigBase64, debugEnabled);
    }

    if (helmEnabled) {
      await installHelm(helmVersion, debugEnabled);
    }

    if (kubectlEnabled) {
      await installKubectl(kubectlVersion, debugEnabled);
    }

    if (yqEnabled) {
      await installYQ(yqVersion, debugEnabled);
    }

    if (argocdEnabled) {
      await installArgoCD(argocdVersion, debugEnabled);
    }

    if (argoEnabled) {
      await installArgoCLI(argoVersion, debugEnabled);
    }

  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

run();
