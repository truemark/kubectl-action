import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

async function installHelm(version: string): Promise<void> {
    core.info(`Installing Helm version ${version}...`);
    const helmUrl =
        version === 'latest'
            ? 'https://get.helm.sh/helm-latest-linux-amd64.tar.gz'
            : `https://get.helm.sh/helm-v${version}-linux-amd64.tar.gz`;
    await exec.exec(`curl -sSL ${helmUrl} | tar -xz -C /tmp`);
    await exec.exec(`sudo mv /tmp/linux-amd64/helm /usr/local/bin/helm`);
    await exec.exec(`chmod +x /usr/local/bin/helm`);
}

async function installKubectl(version: string): Promise<void> {
    core.info(`Installing Kubectl version: ${version}...`);
    let kubectlUrl = '';

    if (version === 'stable') {
        // Fetch the latest stable version dynamically
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
        // Read inputs and use defaults if inputs are missing
        const kubectlCommand = core.getInput('kubectl-command', { required: true });
        const kubeconfigEncoded = core.getInput('kubeconfig', { required: true });

        const helmVersion = core.getInput('helm-version') || '3.9.0';
        const kubectlVersion = core.getInput('kubectl-version') || 'stable';
        const yqVersion = core.getInput('yq-version') || '4.30.5';

        core.info(`Using Helm version: ${helmVersion}`);
        core.info(`Using Kubectl version: ${kubectlVersion}`);
        core.info(`Using YQ version: ${yqVersion}`);

        // Install tools
        await installHelm(helmVersion);
        await installKubectl(kubectlVersion);
        await installYQ(yqVersion);

        // Set up KUBECONFIG
        const kubeconfigPath = path.join(process.cwd(), 'kubeconfig');
        const kubeconfig = Buffer.from(kubeconfigEncoded, 'base64').toString('utf8');
        fs.writeFileSync(kubeconfigPath, kubeconfig, { mode: 0o600 });
        core.exportVariable('KUBECONFIG', kubeconfigPath);

        // Execute kubectl command
        const options: exec.ExecOptions = {
            listeners: {
                stdout: (data: Buffer) => {
                    process.stdout.write(data.toString());
                },
            },
        };

        await exec.exec(`kubectl ${kubectlCommand}`, [], options);

        core.setOutput('output', `kubectl ${kubectlCommand} executed successfully`);
    } catch (error) {
        core.setFailed((error as Error).message);
    }
}

run();
