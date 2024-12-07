import * as core from '@actions/core';
import * as exec from '@actions/exec';
import axios from 'axios';

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
  await exec.exec(`curl -sSL ${helmUrl} | tar -xz -C /tmp`);
  await exec.exec(`sudo mv /tmp/linux-amd64/helm /usr/local/bin/helm`);
  await exec.exec(`chmod +x /usr/local/bin/helm`);

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
    const kubeconfig = core.getInput('kubeconfig');
    const command = core.getInput('command'); // This is optional

    // Set KUBECONFIG environment variable if provided
    if (kubeconfig && kubeconfig.trim()) {
      core.info('Setting KUBECONFIG environment variable.');
      process.env.KUBECONFIG = kubeconfig.trim();
    } else {
      core.info('KUBECONFIG is not provided. Using default configuration.');
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
