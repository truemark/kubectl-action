import * as core from '@actions/core';
import * as exec from '@actions/exec';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

async function handleKubeconfig(kubeconfigBase64: string): Promise<void> {
  if (!kubeconfigBase64 || kubeconfigBase64.trim() === '') {
    core.info('No Base64-encoded KUBECONFIG provided. Skipping configuration.');
    return;
  }

  try {
    core.info('Decoding Base64-encoded KUBECONFIG...');
    const kubeconfig = Buffer.from(kubeconfigBase64, 'base64').toString('utf-8');

    // Write the decoded kubeconfig to a temporary file
    const kubeconfigPath = path.join('/tmp', 'kubeconfig');
    fs.writeFileSync(kubeconfigPath, kubeconfig, { encoding: 'utf-8' });

    // Restrict file permissions (read/write for the owner only)
    fs.chmodSync(kubeconfigPath, 0o600);

    // Set the KUBECONFIG environment variable
    process.env.KUBECONFIG = kubeconfigPath;
    core.info(`KUBECONFIG is set to ${kubeconfigPath}`);
  } catch (error) {
    core.setFailed(`Failed to decode and set KUBECONFIG: ${(error as Error).message}`);
  }
}

async function installHelm(version: string): Promise<void> {
  core.info(`Installing Helm version ${version}...`);

  let helmUrl: string;

  // Map 'stable' to the latest known stable version
  if (version === 'stable') {
    version = '3.13.0'; // Replace with the desired stable version
  }

  helmUrl =
    version === 'latest'
      ? 'https://get.helm.sh/helm-latest-linux-amd64.tar.gz'
      : `https://get.helm.sh/helm-v${version}-linux-amd64.tar.gz`;

  core.info(`Downloading Helm from ${helmUrl}...`);
  await exec.exec(`curl -sSL -o /tmp/helm.tar.gz ${helmUrl}`);
  await exec.exec(`tar -xz -f /tmp/helm.tar.gz -C /tmp`);

  // Move the Helm binary to a directory in PATH
  const helmBinaryPath = '/tmp/linux-amd64/helm';
  let destinationPath = '/usr/local/bin/helm';

  core.info(`Attempting to move Helm binary to ${destinationPath}...`);
  try {
    await exec.exec(`mv ${helmBinaryPath} ${destinationPath}`);
    await exec.exec(`chmod +x ${destinationPath}`);
  } catch (error) {
    // If /usr/local/bin is not writable, fall back to $HOME/bin
    const fallbackPath = `${process.env.HOME}/bin`;
    destinationPath = `${fallbackPath}/helm`;

    core.info(`/usr/local/bin is not writable. Falling back to ${destinationPath}...`);
    await exec.exec(`mkdir -p ${fallbackPath}`);
    await exec.exec(`mv ${helmBinaryPath} ${destinationPath}`);
    await exec.exec(`chmod +x ${destinationPath}`);
    core.addPath(fallbackPath); // Add fallbackPath to PATH
  }

  core.info(`Helm ${version} installed successfully at ${destinationPath}.`);
}

async function installKubectl(version: string): Promise<void> {
  core.info(`Installing Kubectl version ${version}...`);
  let kubectlUrl = '';

  if (version === 'stable') {
    const stableVersionUrl = 'https://dl.k8s.io/release/stable.txt';
    const response = await axios.get(stableVersionUrl);
    const stableVersion = response.data.trim();
    kubectlUrl = `https://dl.k8s.io/release/${stableVersion}/bin/linux/amd64/kubectl`;
  } else {
    kubectlUrl = `https://dl.k8s.io/release/v${version}/bin/linux/amd64/kubectl`;
  }

  const kubectlBinaryPath = '/tmp/kubectl';
  let destinationPath = '/usr/local/bin/kubectl';

  try {
    core.info(`Downloading Kubectl from ${kubectlUrl}...`);
    await exec.exec(`curl -sSL -o ${kubectlBinaryPath} ${kubectlUrl}`);

    core.info(`Attempting to move Kubectl binary to ${destinationPath}...`);
    await exec.exec(`mv ${kubectlBinaryPath} ${destinationPath}`);
    await exec.exec(`chmod +x ${destinationPath}`);
  } catch (error) {
    // Fallback logic for non-writable /usr/local/bin
    const fallbackPath = `${process.env.HOME}/bin`;
    destinationPath = `${fallbackPath}/kubectl`;

    core.info(`/usr/local/bin is not writable. Falling back to ${destinationPath}...`);
    await exec.exec(`mkdir -p ${fallbackPath}`);
    await exec.exec(`mv ${kubectlBinaryPath} ${destinationPath}`);
    await exec.exec(`chmod +x ${destinationPath}`);
    core.addPath(fallbackPath); // Add fallbackPath to PATH
  }

  core.info(`Kubectl ${version} installed successfully at ${destinationPath}.`);
}

async function installYQ(version: string): Promise<void> {
  core.info(`Installing YQ version ${version}...`);
  const yqUrl =
    version === 'latest'
      ? 'https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64'
      : `https://github.com/mikefarah/yq/releases/download/v${version}/yq_linux_amd64`;

  const yqBinaryPath = '/tmp/yq';
  let destinationPath = '/usr/local/bin/yq';

  try {
    core.info(`Downloading YQ from ${yqUrl}...`);
    await exec.exec(`curl -sSL -o ${yqBinaryPath} ${yqUrl}`);

    core.info(`Attempting to move YQ binary to ${destinationPath}...`);
    await exec.exec(`mv ${yqBinaryPath} ${destinationPath}`);
    await exec.exec(`chmod +x ${destinationPath}`);
  } catch (error) {
    // Fallback logic for non-writable /usr/local/bin
    const fallbackPath = `${process.env.HOME}/bin`;
    destinationPath = `${fallbackPath}/yq`;

    core.info(`/usr/local/bin is not writable. Falling back to ${destinationPath}...`);
    await exec.exec(`mkdir -p ${fallbackPath}`);
    await exec.exec(`mv ${yqBinaryPath} ${destinationPath}`);
    await exec.exec(`chmod +x ${destinationPath}`);
    core.addPath(fallbackPath); // Add fallbackPath to PATH
  }

  core.info(`YQ ${version} installed successfully at ${destinationPath}.`);
}

async function installArgoCD(version: string): Promise<void> {
  core.info(`Installing ArgoCD CLI version ${version}...`);

  let argocdUrl: string;

  // Map 'latest' to the latest release version
  if (version === 'latest') {
    argocdUrl = 'https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64';
  } else {
    argocdUrl = `https://github.com/argoproj/argo-cd/releases/download/v${version}/argocd-linux-amd64`;
  }

  const argocdBinaryPath = '/tmp/argocd';
  let destinationPath = '/usr/local/bin/argocd';

  try {
    core.info(`Downloading ArgoCD CLI from ${argocdUrl}...`);
    await exec.exec(`curl -sSL -o ${argocdBinaryPath} ${argocdUrl}`);

    core.info(`Attempting to move ArgoCD binary to ${destinationPath}...`);
    await exec.exec(`mv ${argocdBinaryPath} ${destinationPath}`);
    await exec.exec(`chmod +x ${destinationPath}`);
  } catch (error) {
    // Fallback logic for non-writable /usr/local/bin
    const fallbackPath = `${process.env.HOME}/bin`;
    destinationPath = `${fallbackPath}/argocd`;

    core.info(`/usr/local/bin is not writable. Falling back to ${destinationPath}...`);
    await exec.exec(`mkdir -p ${fallbackPath}`);
    await exec.exec(`mv ${argocdBinaryPath} ${destinationPath}`);
    await exec.exec(`chmod +x ${destinationPath}`);
    core.addPath(fallbackPath); // Add fallbackPath to PATH
  }

  core.info(`ArgoCD CLI ${version} installed successfully at ${destinationPath}.`);
}

async function installArgoCLI(version: string): Promise<void> {
  core.info(`Installing Argo CLI version ${version}...`);

  let argoUrl: string;

  // Resolve version
  if (version === 'latest' || !version.trim()) {
    core.info('Fetching the latest version of Argo CLI...');
    try {
      const response = await axios.get(
        'https://api.github.com/repos/argoproj/argo-workflows/releases/latest',
        { headers: { Accept: 'application/vnd.github.v3+json' } }
      );
      version = response.data.tag_name.replace(/^v/, ''); // Extract version without "v" prefix
      core.info(`Latest version resolved to ${version}.`);
    } catch (error) {
      core.setFailed(`Failed to fetch the latest version of Argo CLI: ${(error as Error).message}`);
      return;
    }
  }

  // Construct the download URL
  argoUrl = `https://github.com/argoproj/argo-workflows/releases/download/v${version}/argo-linux-amd64`;

  const argoBinaryPath = '/tmp/argo';
  let destinationPath = '/usr/local/bin/argo';

  try {
    core.info(`Downloading Argo CLI from ${argoUrl}...`);
    await exec.exec(`curl -sSL -o ${argoBinaryPath} ${argoUrl}`);

    core.info(`Attempting to move Argo CLI binary to ${destinationPath}...`);
    await exec.exec(`mv ${argoBinaryPath} ${destinationPath}`);
    await exec.exec(`chmod +x ${destinationPath}`);
  } catch (error) {
    // Fallback logic for non-writable /usr/local/bin
    const fallbackPath = `${process.env.HOME}/bin`;
    destinationPath = `${fallbackPath}/argo`;

    core.info(`/usr/local/bin is not writable. Falling back to ${destinationPath}...`);
    await exec.exec(`mkdir -p ${fallbackPath}`);
    await exec.exec(`mv ${argoBinaryPath} ${destinationPath}`);
    await exec.exec(`chmod +x ${destinationPath}`);
    core.addPath(fallbackPath); // Add fallbackPath to PATH
  }

  core.info(`Argo CLI ${version} installed successfully at ${destinationPath}.`);
}

async function run(): Promise<void> {
  try {
    // Read inputs
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
    const command = core.getInput('command'); // This is optional

    // Handle Base64-encoded KUBECONFIG
    if (kubeconfigBase64 && kubeconfigBase64.trim()) {
      await handleKubeconfig(kubeconfigBase64);
    } else {
      core.info('No KUBECONFIG provided. Using default configuration.');
    }

    // Install tools based on inputs
    if (helmEnabled) {
      await installHelm(helmVersion);
    }

    if (kubectlEnabled) {
      await installKubectl(kubectlVersion);
    }

    if (yqEnabled) {
      await installYQ(yqVersion);
    }

    if (argocdEnabled) {
      await installArgoCD(argocdVersion);
    }

    if (argoEnabled) {
      await installArgoCLI(argoVersion);
    }

    // Check if a command is supplied
    if (command && command.trim()) {
      core.info(`Executing command: ${command}`);
      let output = '';
      const options: exec.ExecOptions = {
        listeners: {
          stdout: (data: Buffer) => {
            process.stdout.write(data.toString());
            output += data.toString();
          },
        },
      };

      await exec.exec(command, [], options);

      // Set output for the workflow
      core.setOutput('output', output);
    } else {
      core.info('No command supplied. Skipping command execution.');
      core.setOutput('output', 'No command executed.');
    }
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

run();
