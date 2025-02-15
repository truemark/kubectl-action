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
  await execCommand('curl', ['--version'], debugEnabled); // Ensure cURL is available

  const binPath = `${process.env.HOME}/bin`;
  const destination = `${binPath}/${toolName}`;

  await execCommand('mkdir', ['-p', binPath], debugEnabled);
  await execCommand('curl', ['-sSL', '-o', `/tmp/${toolName}`, url], debugEnabled);

  // Validate download success
  await execCommand('ls', ['-lah', `/tmp/${toolName}`], debugEnabled);
  await execCommand('file', [`/tmp/${toolName}`], debugEnabled);

  await execCommand('mv', [`/tmp/${toolName}`, destination], debugEnabled);
  await execCommand('chmod', ['+x', destination], debugEnabled);
  core.addPath(binPath);

  core.info(`✅ Installed ${toolName} at ${destination}`);
}

// Install Helm with validation
async function installHelm(version: string, debugEnabled: boolean): Promise<void> {
  const helmUrl = version === 'stable'
    ? 'https://get.helm.sh/helm-v3.13.0-linux-amd64.tar.gz'
    : `https://get.helm.sh/helm-v${version}-linux-amd64.tar.gz`;

  core.info(`🔍 Downloading Helm from: ${helmUrl}`);
  const binDir = `${process.env.HOME}/bin`;

  await execCommand('curl', ['-sSL', '-o', '/tmp/helm.tar.gz', helmUrl], debugEnabled);
  await execCommand('tar', ['-xz', '-f', '/tmp/helm.tar.gz', '-C', '/tmp'], debugEnabled);

  const helmBinaryPath = '/tmp/linux-amd64/helm';
  const userBinPath = `${binDir}/helm`;

  // Validate extracted file
  await execCommand('test', ['-f', helmBinaryPath], debugEnabled);
  await execCommand('ls', ['-lah', helmBinaryPath], debugEnabled);

  await execCommand('mkdir', ['-p', binDir], debugEnabled);
  await execCommand('mv', [helmBinaryPath, userBinPath], debugEnabled);
  await execCommand('chmod', ['+x', userBinPath], debugEnabled);
  core.addPath(binDir);
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

  const binPath = `${process.env.HOME}/bin`;
  const nodeBinary = `${binPath}/node`;

  try {
    // Ensure bin directory exists
    await execCommand('mkdir', ['-p', binPath], debugEnabled);

    // Fetch latest LTS version if needed
    let nodeVersion = version;
    if (nodeVersion === 'latest') {
      nodeVersion = (await axios.get('https://nodejs.org/dist/index.json')).data
        .find((v: { lts: boolean }) => v.lts).version.replace(/^v/, '');
    }

    const nodeUrl = `https://nodejs.org/dist/v${nodeVersion}/node-v${nodeVersion}-linux-x64.tar.xz`;

    core.info(`📦 Downloading Node.js from: ${nodeUrl}`);

    // Download Node.js archive
    await execCommand('curl', ['-sSL', '-o', '/tmp/node.tar.xz', nodeUrl], debugEnabled);

    // Extract node binaries
    await execCommand('tar', ['-xf', '/tmp/node.tar.xz', '-C', '/tmp'], debugEnabled);

    // Move node binary to $HOME/bin
    await execCommand('mv', [`/tmp/node-v${nodeVersion}-linux-x64/bin/node`, nodeBinary], debugEnabled);
    await execCommand('chmod', ['+x', nodeBinary], debugEnabled);

    // Add node to PATH
    core.addPath(binPath);
    process.env.PATH = `${binPath}:${process.env.PATH}`;

    core.info(`✅ Installed Node.js at ${nodeBinary}`);

  } catch (error) {
    core.setFailed(`❌ Failed to install Node.js: ${(error as Error).message}`);
  }
}

// Install pnpm with validation
async function installPnpm(version: string, debugEnabled: boolean): Promise<void> {
  core.info(`🔍 Installing pnpm version: ${version}`);

  // Define installation paths
  const binPath = `${process.env.HOME}/bin`;
  const pnpmBinary = `${binPath}/pnpm`;

  try {
    // Ensure the bin directory exists
    await execCommand('mkdir', ['-p', binPath], debugEnabled);

    // Download and install pnpm
    await execCommand('sh', ['-c', 'curl -fsSL https://get.pnpm.io/install.sh | sh'], debugEnabled);

    // Move pnpm to binPath
    await execCommand('mv', ['/home/ec2-user/.local/share/pnpm/pnpm', pnpmBinary], debugEnabled);
    await execCommand('chmod', ['+x', pnpmBinary], debugEnabled);

    // Add to PATH dynamically
    core.addPath(binPath);
    process.env.PATH = `${binPath}:${process.env.PATH}`;

    core.info(`✅ Installed pnpm at ${pnpmBinary}`);

  } catch (error) {
    core.setFailed(`❌ Failed to install pnpm: ${(error as Error).message}`);
  }
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
      helmEnabled ? installHelm(helmVersion, debugEnabled) : Promise.resolve(),
      kubectlEnabled ? installKubectl(kubectlVersion, debugEnabled) : Promise.resolve(),
      yqEnabled ? installYQ(yqVersion, debugEnabled) : Promise.resolve(),
      argocdEnabled ? installArgoCD(argocdVersion, debugEnabled) : Promise.resolve(),
      pnpmEnabled ? installNode(nodeVersion, debugEnabled).then(() => installPnpm(pnpmVersion, debugEnabled)) : Promise.resolve()
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
