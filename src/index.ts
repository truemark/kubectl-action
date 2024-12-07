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
  const destinationPath = '/usr/local/bin/helm';

  core.info(`Moving Helm binary to ${destinationPath}...`);
  try {
    await exec.exec(`mv ${helmBinaryPath} ${destinationPath}`);
  } catch (error) {
    // If /usr/local/bin is not writable, fall back to $HOME/bin
    const fallbackPath = `${process.env.HOME}/bin`;
    core.info(`/usr/local/bin is not writable. Falling back to ${fallbackPath}...`);
    await exec.exec(`mkdir -p ${fallbackPath}`);
    await exec.exec(`mv ${helmBinaryPath} ${fallbackPath}/helm`);
    core.addPath(fallbackPath); // Add fallbackPath to PATH
  }

  await exec.exec(`chmod +x ${destinationPath}`);

  core.info(`Helm ${version} installed successfully.`);
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

    await exec.exec(`curl -sSL -o /usr/local/bin/kubectl ${kubectlUrl}`);
    await exec.exec(`chmod +x /usr/local/bin/kubectl`);
}

async function installYQ(version: string): Promise<void> {
    core.info(`Installing YQ version ${version}...`);
    const yqUrl =
        version === 'latest'
            ? 'https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64'
            : `https://github.com/mikefarah/yq/releases/download/v${version}/yq_linux_amd64`;
    await exec.exec(`curl -sSL -o /usr/local/bin/yq ${yqUrl}`);
    await exec.exec(`chmod +x /usr/local/bin/yq`);
}

async function run(): Promise<void> {
  try {
    // Read inputs
    const helmEnabled = core.getInput('helm-enabled') === 'true';
    const kubectlEnabled = core.getInput('kubectl-enabled') === 'true';
    const yqEnabled = core.getInput('yq-enabled') === 'true';
    const helmVersion = core.getInput('helm-version');
    const kubectlVersion = core.getInput('kubectl-version');
    const yqVersion = core.getInput('yq-version');
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
