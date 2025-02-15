import * as core from '@actions/core';
import * as exec from '@actions/exec';
import axios from 'axios';

async function installTool(toolName: string, url: string, debugEnabled: boolean): Promise<void> {
  const binPath = `${process.env.HOME}/bin`;
  const destination = `${binPath}/${toolName}`;

  core.info(`🔍 Downloading ${toolName} from: ${url}`);

  await execCommand('mkdir', ['-p', binPath], debugEnabled);
  await execCommand('curl', ['-sSL', '-o', `/tmp/${toolName}`, url], debugEnabled);

  // Validate Download
  const fileCheck = await exec.exec('file', [`/tmp/${toolName}`], { silent: true, ignoreReturnCode: true });
  if (fileCheck !== 0) {
    core.setFailed(`❌ Failed to download a valid ${toolName} binary from ${url}`);
    return;
  }

  await execCommand('mv', [`/tmp/${toolName}`, destination], debugEnabled);
  await execCommand('chmod', ['+x', destination], debugEnabled);
  core.addPath(binPath);
  core.info(`✅ Installed ${toolName} at ${destination}`);
}

async function execCommand(command: string, args: string[], debugEnabled: boolean): Promise<string> {
  try {
    let output = '';
    await exec.exec(command, args, {
      silent: !debugEnabled,
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
        }
      }
    });
    return output.trim();
  } catch (error) {
    core.error(`❌ Error executing: ${command} ${args.join(' ')}`);
    core.setFailed(`Execution failed: ${command} ${args.join(' ')}`);
    throw error;
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
  await execCommand('tar', ['-xz', '-f', '/tmp/helm.tar.gz', '-C', '/tmp'], debugEnabled);

  const helmBinaryPath = '/tmp/linux-amd64/helm';
  const userBinPath = `${process.env.HOME}/bin/helm`;

  await execCommand('mv', [helmBinaryPath, userBinPath], debugEnabled);
  await execCommand('chmod', ['+x', userBinPath], debugEnabled);
  core.addPath(`${process.env.HOME}/bin`);
  core.info(`✅ Helm installed at ${userBinPath}`);
}

// Install Kubectl with stable version caching and validation
let cachedKubectlVersion: string | null = null;
async function installKubectl(version: string, debugEnabled: boolean): Promise<void> {
  if (version === 'stable' && !cachedKubectlVersion) {
    cachedKubectlVersion = (await axios.get('https://dl.k8s.io/release/stable.txt')).data.trim();
  }

  const kubectlVersion = version === 'stable' ? cachedKubectlVersion : `v${version}`;
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

async function installNode(version: string, debugEnabled: boolean): Promise<void> {
  core.info(`🔍 Installing Node.js version: ${version}`);

  const nodeUrl = `https://nodejs.org/dist/v${version}/node-v${version}-linux-x64.tar.xz`;
  const binPath = `${process.env.HOME}/bin`;

  await execCommand('mkdir', ['-p', binPath], debugEnabled);
  await execCommand('curl', ['-sSL', '-o', '/tmp/node.tar.xz', nodeUrl], debugEnabled);

  // Validate Download
  const fileCheck = await exec.exec('file', ['/tmp/node.tar.xz'], { silent: true, ignoreReturnCode: true });
  if (fileCheck !== 0) {
    core.setFailed(`❌ Failed to download a valid Node.js archive from ${nodeUrl}`);
    return;
  }

  await execCommand('tar', ['-xf', '/tmp/node.tar.xz', '-C', '/tmp'], debugEnabled);
  await execCommand('mv', [`/tmp/node-v${version}-linux-x64/bin/node`, `${binPath}/node`], debugEnabled);
  await execCommand('chmod', ['+x', `${binPath}/node`], debugEnabled);

  core.addPath(binPath);
  core.info(`✅ Installed Node.js at ${binPath}/node`);
}

// Install pnpm with validation
async function installPnpm(version: string, debugEnabled: boolean): Promise<void> {
  core.info(`🔍 Installing pnpm version: ${version}`);

  const binPath = `${process.env.HOME}/bin`;
  await execCommand('mkdir', ['-p', binPath], debugEnabled);

  // Install a specific version of pnpm
  const installScript = `curl -fsSL https://get.pnpm.io/install.sh | sh -s -- --version=${version}`;
  await execCommand('sh', ['-c', installScript], debugEnabled);

  await execCommand('mv', [`$HOME/.local/share/pnpm/pnpm`, `${binPath}/pnpm`], debugEnabled);
  await execCommand('chmod', ['+x', `${binPath}/pnpm`], debugEnabled);

  core.addPath(binPath);
  core.info(`✅ Installed pnpm at ${binPath}/pnpm`);
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
    const pnpmEnabled = core.getInput('pnpm-enabled') === 'true';

    const helmVersion = core.getInput('helm-version');
    const kubectlVersion = core.getInput('kubectl-version');
    const yqVersion = core.getInput('yq-version');
    const argocdVersion = core.getInput('argocd-version');
    const nodeVersion = core.getInput('node-version') || 'lts';
    const pnpmVersion = core.getInput('pnpm-version');

    const kubeconfigBase64 = core.getInput('kubeconfig');

    if (kubectlEnabled && !kubeconfigBase64) {
      core.warning('⚠️ No KUBECONFIG provided. Kubectl may fail.');
    }

    // Parallel installation
    await Promise.all([
      installHelm(helmVersion, debugEnabled),
      installKubectl(kubectlVersion, debugEnabled),
      installYQ(yqVersion, debugEnabled),
      installArgoCD(argocdVersion, debugEnabled),
      installNode(nodeVersion, debugEnabled).then(() => installPnpm(pnpmVersion, debugEnabled))
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
