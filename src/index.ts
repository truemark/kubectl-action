import * as core from '@actions/core';
import * as exec from '@actions/exec';
import axios from 'axios';

async function installCurl(debugEnabled: boolean): Promise<void> {
  try {
    const os = process.platform;

    if (os === 'linux') {
      const amazonLinux = await exec.exec('grep', ['Amazon', '/etc/os-release'], { ignoreReturnCode: true });
      if (amazonLinux === 0) {
        await execCommand('sudo', ['dnf', 'install', '-y', 'curl', 'ca-certificates', 'tar'], debugEnabled);
      } else {
        await execCommand('sudo', ['apt-get', 'update'], debugEnabled);
        await execCommand('sudo', ['apt-get', 'install', '-y', 'curl', 'ca-certificates', 'tar'], debugEnabled);
      }
    } else if (os === 'darwin') {
      await execCommand('brew', ['install', 'curl'], debugEnabled);
    } else {
      core.warning('⚠️ Unsupported OS: Manual installation of cURL may be required.');
    }

    core.info('✅ cURL installed successfully.');
  } catch (error) {
    core.setFailed(`❌ Failed to install cURL: ${(error as Error).message}`);
  }
}

async function verifyCurl(debugEnabled: boolean): Promise<void> {
  try {
    await execCommand('curl', ['--version'], debugEnabled);
    core.info('✅ cURL is properly installed and functional.');
  } catch (error) {
    core.setFailed('❌ cURL installation failed or is not functional.');
  }
}

// Execute a command and handle errors
async function execCommand(command: string, args: string[], debugEnabled: boolean): Promise<void> {
  try {
    await exec.exec(command, args, { silent: !debugEnabled });
  } catch (error) {
    core.error(`❌ Error executing: ${command} ${args.join(' ')}`);

    if (command === 'curl') {
      core.warning('⚠️ cURL failed. Reinstalling and verifying...');
      await installCurl(debugEnabled);
      await verifyCurl(debugEnabled);
      await exec.exec(command, args, { silent: !debugEnabled }); // Retry command
    } else {
      core.setFailed((error as Error).message);
      throw error;
    }
  }
}

// Generic function to download and install CLI tools
async function installFromURL(toolName: string, url: string, debugEnabled: boolean): Promise<void> {
  await execCommand('curl', ['--version'], debugEnabled); // Ensure cURL is available

  const binPath = `${process.env.HOME}/bin`;
  const destination = `${binPath}/${toolName}`;

  await execCommand('mkdir', ['-p', binPath], debugEnabled);
  await execCommand('curl', ['-sSL', '-o', `/tmp/${toolName}`, url], debugEnabled);
  await execCommand('mv', [`/tmp/${toolName}`, destination], debugEnabled);
  await execCommand('chmod', ['+x', destination], debugEnabled);
  core.addPath(binPath);

  core.info(`✅ Installed ${toolName} at ${destination}`);
}

// Install Helm
async function installHelm(version: string, debugEnabled: boolean): Promise<void> {
  const helmUrl = version === 'stable'
    ? 'https://get.helm.sh/helm-v3.13.0-linux-amd64.tar.gz'
    : `https://get.helm.sh/helm-v${version}-linux-amd64.tar.gz`;

  core.info(`🔍 Downloading Helm from: ${helmUrl}`);

  await execCommand('curl', ['-sSL', '-o', '/tmp/helm.tar.gz', helmUrl], debugEnabled);
  await execCommand('tar', ['-xz', '-f', '/tmp/helm.tar.gz', '-C', '/tmp'], debugEnabled);

  const helmBinaryPath = '/tmp/linux-amd64/helm';
  const systemBinPath = '/usr/local/bin/helm';
  const userBinPath = `${process.env.HOME}/bin/helm`;

  // Ensure Helm binary exists
  const helmExists = await exec.exec('test', ['-f', helmBinaryPath], { ignoreReturnCode: true }) === 0;
  if (!helmExists) {
    core.setFailed(`❌ Helm binary not found at expected path: ${helmBinaryPath}`);
    return;
  }

  try {
    // Try installing in /usr/local/bin (GitHub-hosted runners)
    await execCommand('mv', [helmBinaryPath, systemBinPath], debugEnabled);
    await execCommand('chmod', ['+x', systemBinPath], debugEnabled);
    core.info(`✅ Helm installed at ${systemBinPath}`);
  } catch (error) {
    core.warning(`⚠️ Insufficient permissions for /usr/local/bin. Installing in ${userBinPath} instead.`);

    // Ensure user bin directory exists
    const binDir = `${process.env.HOME}/bin`;
    await execCommand('mkdir', ['-p', binDir], debugEnabled);
    await execCommand('mv', [helmBinaryPath, userBinPath], debugEnabled);
    await execCommand('chmod', ['+x', userBinPath], debugEnabled);
    core.addPath(binDir);
    core.info(`✅ Helm installed at ${userBinPath}`);
  }
}

// Install Kubectl with stable version caching
let cachedKubectlVersion: string | null = null;
async function installKubectl(version: string, debugEnabled: boolean): Promise<void> {
  if (version === 'stable' && !cachedKubectlVersion) {
    cachedKubectlVersion = (await axios.get('https://dl.k8s.io/release/stable.txt')).data.trim();
  }

  const kubectlVersion = version === 'stable' ? cachedKubectlVersion : `v${version}`;
  const kubectlUrl = `https://dl.k8s.io/release/${kubectlVersion}/bin/linux/amd64/kubectl`;

  await installFromURL('kubectl', kubectlUrl, debugEnabled);
}

// Install YQ
async function installYQ(version: string, debugEnabled: boolean): Promise<void> {
  const yqUrl = `https://github.com/mikefarah/yq/releases/download/v${version}/yq_linux_amd64`;
  await installFromURL('yq', yqUrl, debugEnabled);
}

// Install ArgoCD CLI
async function installArgoCD(version: string, debugEnabled: boolean): Promise<void> {
  const argocdUrl = `https://github.com/argoproj/argo-cd/releases/download/v${version}/argocd-linux-amd64`;
  await installFromURL('argocd', argocdUrl, debugEnabled);
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
    if (kubeconfigBase64) {
      const kubeconfigPath = `${process.env.HOME}/.kube/config`;
      await execCommand('mkdir', ['-p', `${process.env.HOME}/.kube`], debugEnabled);
      await execCommand('echo', [`"${Buffer.from(kubeconfigBase64, 'base64').toString('utf-8')}"`, '>', kubeconfigPath], debugEnabled);
      process.env.KUBECONFIG = kubeconfigPath;
      core.info(`✅ KUBECONFIG set at ${kubeconfigPath}`);
    } else {
      core.info(`⚠️ No KUBECONFIG provided. Kubectl may fail if authentication is required.`);
    }

    // Parallel installation
    await Promise.all([
      helmEnabled ? installHelm(helmVersion, debugEnabled) : Promise.resolve(),
      kubectlEnabled ? installKubectl(kubectlVersion, debugEnabled) : Promise.resolve(),
      yqEnabled ? installYQ(yqVersion, debugEnabled) : Promise.resolve(),
      argocdEnabled ? installArgoCD(argocdVersion, debugEnabled) : Promise.resolve()
    ]);

    // ✅ Execute user-defined command if provided
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
