"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const axios_1 = __importDefault(require("axios"));
async function installHelm(version) {
    core.info(`Installing Helm version ${version}...`);
    const helmUrl = version === 'latest'
        ? 'https://get.helm.sh/helm-latest-linux-amd64.tar.gz'
        : `https://get.helm.sh/helm-v${version}-linux-amd64.tar.gz`;
    await exec.exec(`curl -sSL ${helmUrl} | tar -xz -C /tmp`);
    await exec.exec(`sudo mv /tmp/linux-amd64/helm /usr/local/bin/helm`);
    await exec.exec(`chmod +x /usr/local/bin/helm`);
}
async function installKubectl(version) {
    core.info(`Installing Kubectl version ${version}...`);
    let kubectlUrl = '';
    if (version === 'stable') {
        const stableVersionUrl = 'https://dl.k8s.io/release/stable.txt';
        const response = await axios_1.default.get(stableVersionUrl);
        const stableVersion = response.data.trim();
        kubectlUrl = `https://dl.k8s.io/release/${stableVersion}/bin/linux/amd64/kubectl`;
    }
    else {
        kubectlUrl = `https://dl.k8s.io/release/v${version}/bin/linux/amd64/kubectl`;
    }
    await exec.exec(`curl -sSL -o /usr/local/bin/kubectl ${kubectlUrl}`);
    await exec.exec(`chmod +x /usr/local/bin/kubectl`);
}
async function installYQ(version) {
    core.info(`Installing YQ version ${version}...`);
    const yqUrl = version === 'latest'
        ? 'https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64'
        : `https://github.com/mikefarah/yq/releases/download/v${version}/yq_linux_amd64`;
    await exec.exec(`curl -sSL -o /usr/local/bin/yq ${yqUrl}`);
    await exec.exec(`chmod +x /usr/local/bin/yq`);
}
async function run() {
    try {
        // Read inputs
        const helmEnabled = core.getInput('helm-enabled') === 'true';
        const kubectlEnabled = core.getInput('kubectl-enabled') === 'true';
        const yqEnabled = core.getInput('yq-enabled') === 'true';
        const helmVersion = core.getInput('helm-version');
        const kubectlVersion = core.getInput('kubectl-version');
        const yqVersion = core.getInput('yq-version');
        const command = core.getInput('command');
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
        // Execute the specified command
        core.info(`Executing command: ${command}`);
        let output = '';
        const options = {
            listeners: {
                stdout: (data) => {
                    process.stdout.write(data.toString());
                    output += data.toString();
                },
            },
        };
        await exec.exec(command, [], options);
        // Set output for the workflow
        core.setOutput('output', output);
    }
    catch (error) {
        core.setFailed(error.message);
    }
}
run();
