import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';

async function run(): Promise<void> {
    try {
        // Read inputs
        const kubectlCommand = core.getInput('kubectl-command', { required: true });
        const kubeconfigEncoded = core.getInput('kubeconfig', { required: true });

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

        // Optionally set output for workflows
        core.setOutput('output', `kubectl ${kubectlCommand} executed successfully`);
    } catch (error) {
        core.setFailed((error as Error).message);
    }
}

run();
