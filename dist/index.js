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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Utility function to control debug logs
function log(message, debugEnabled) {
    if (debugEnabled) {
        core.info(message);
    }
}
function isToolInstalled(command, versionFlag, expectedVersion, debugEnabled) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let output = '';
            const options = {
                silent: !debugEnabled,
                listeners: {
                    stdout: (data) => {
                        output += data.toString();
                    }
                }
            };
            yield exec.exec(command, [versionFlag], options);
            // Extract the first line containing the version
            const versionLine = output.split('\n').find(line => line.trim().startsWith('argo: v'));
            if (versionLine) {
                const installedVersion = versionLine.split('v')[1].trim(); // Get version number after "argo: v"
                return installedVersion === expectedVersion;
            }
            return false;
        }
        catch (_a) {
            return false; // Tool not installed or error in version check
        }
    });
}
function execCommand(command_1) {
    return __awaiter(this, arguments, void 0, function* (command, args = [], debugEnabled) {
        const options = debugEnabled ? { listeners: { stdout: (data) => core.info(data.toString()) } } : { silent: true };
        try {
            yield exec.exec(command, args, options);
        }
        catch (error) {
            core.error(`Error executing: ${command} ${args.join(' ')}`);
            core.error(error.message);
            throw error;
        }
    });
}
function handleKubeconfig(kubeconfigBase64, debugEnabled) {
    return __awaiter(this, void 0, void 0, function* () {
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
        }
        catch (error) {
            core.setFailed(`Failed to decode and set KUBECONFIG: ${error.message}`);
        }
    });
}
function installHelm(version, debugEnabled) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield isToolInstalled('helm', 'version --short', `v${version}`, debugEnabled)) {
            core.info(`Helm version ${version} is already installed.`);
            return;
        }
        core.info(`Installing Helm version ${version}...`);
        const helmUrl = version === 'stable'
            ? 'https://get.helm.sh/helm-v3.13.0-linux-amd64.tar.gz'
            : `https://get.helm.sh/helm-v${version}-linux-amd64.tar.gz`;
        log(`Downloading Helm from ${helmUrl}`, debugEnabled);
        yield execCommand('curl', ['-sSL', '-o', '/tmp/helm.tar.gz', helmUrl], debugEnabled);
        yield execCommand('tar', ['-xz', '-f', '/tmp/helm.tar.gz', '-C', '/tmp'], debugEnabled);
        const helmBinaryPath = '/tmp/linux-amd64/helm';
        let destinationPath = '/usr/local/bin/helm';
        try {
            yield execCommand('mv', [helmBinaryPath, destinationPath], debugEnabled);
            yield execCommand('chmod', ['+x', destinationPath], debugEnabled);
        }
        catch (error) {
            const fallbackPath = `${process.env.HOME}/bin`;
            destinationPath = `${fallbackPath}/helm`;
            log(`/usr/local/bin not writable. Falling back to ${destinationPath}`, debugEnabled);
            yield execCommand('mkdir', ['-p', fallbackPath], debugEnabled);
            yield execCommand('mv', [helmBinaryPath, destinationPath], debugEnabled);
            yield execCommand('chmod', ['+x', destinationPath], debugEnabled);
            core.addPath(fallbackPath);
        }
        core.info(`Helm ${version} installed successfully.`);
    });
}
function installKubectl(version, debugEnabled) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield isToolInstalled('kubectl', 'version --client --short', `v${version}`, debugEnabled)) {
            core.info(`Kubectl version ${version} is already installed.`);
            return;
        }
        core.info(`Installing Kubectl version ${version}...`);
        const stableVersionUrl = 'https://dl.k8s.io/release/stable.txt';
        const kubectlUrl = version === 'stable'
            ? `https://dl.k8s.io/release/${(yield axios_1.default.get(stableVersionUrl)).data.trim()}/bin/linux/amd64/kubectl`
            : `https://dl.k8s.io/release/v${version}/bin/linux/amd64/kubectl`;
        const kubectlBinaryPath = '/tmp/kubectl';
        let destinationPath = '/usr/local/bin/kubectl';
        log(`Downloading Kubectl from ${kubectlUrl}`, debugEnabled);
        try {
            yield execCommand('curl', ['-sSL', '-o', kubectlBinaryPath, kubectlUrl], debugEnabled);
            yield execCommand('mv', [kubectlBinaryPath, destinationPath], debugEnabled);
            yield execCommand('chmod', ['+x', destinationPath], debugEnabled);
        }
        catch (error) {
            const fallbackPath = `${process.env.HOME}/bin`;
            destinationPath = `${fallbackPath}/kubectl`;
            log(`/usr/local/bin not writable. Falling back to ${destinationPath}`, debugEnabled);
            yield execCommand('mkdir', ['-p', fallbackPath], debugEnabled);
            yield execCommand('mv', [kubectlBinaryPath, destinationPath], debugEnabled);
            yield execCommand('chmod', ['+x', destinationPath], debugEnabled);
            core.addPath(fallbackPath);
        }
        core.info(`Kubectl ${version} installed successfully.`);
    });
}
function installYQ(version, debugEnabled) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield isToolInstalled('yq', '--version', `version ${version}`, debugEnabled)) {
            core.info(`YQ version ${version} is already installed.`);
            return;
        }
        core.info(`Installing YQ version ${version}...`);
        const yqUrl = version === 'latest'
            ? 'https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64'
            : `https://github.com/mikefarah/yq/releases/download/v${version}/yq_linux_amd64`;
        const yqBinaryPath = '/tmp/yq';
        let destinationPath = '/usr/local/bin/yq';
        log(`Downloading YQ from ${yqUrl}`, debugEnabled);
        try {
            yield execCommand('curl', ['-sSL', '-o', yqBinaryPath, yqUrl], debugEnabled);
            yield execCommand('mv', [yqBinaryPath, destinationPath], debugEnabled);
            yield execCommand('chmod', ['+x', destinationPath], debugEnabled);
        }
        catch (error) {
            const fallbackPath = `${process.env.HOME}/bin`;
            destinationPath = `${fallbackPath}/yq`;
            log(`/usr/local/bin not writable. Falling back to ${destinationPath}`, debugEnabled);
            yield execCommand('mkdir', ['-p', fallbackPath], debugEnabled);
            yield execCommand('mv', [yqBinaryPath, destinationPath], debugEnabled);
            yield execCommand('chmod', ['+x', destinationPath], debugEnabled);
            core.addPath(fallbackPath);
        }
        core.info(`YQ ${version} installed successfully.`);
    });
}
function installArgoCLI(version, debugEnabled) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield isToolInstalled('argo', '--version', `v${version}`, debugEnabled)) {
            core.info(`Argo CLI version ${version} is already installed.`);
            return;
        }
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
            yield execCommand('curl', ['-sSL', '-o', `${argoBinaryPath}.gz`, downloadUrl], debugEnabled);
            yield execCommand('gunzip', ['-f', `${argoBinaryPath}.gz`], debugEnabled);
            yield execCommand('chmod', ['+x', argoBinaryPath], debugEnabled);
            let destinationPath = '/usr/local/bin/argo';
            try {
                yield execCommand('mv', [argoBinaryPath, destinationPath], debugEnabled);
            }
            catch (error) {
                const fallbackPath = `${process.env.HOME}/bin`;
                destinationPath = `${fallbackPath}/argo`;
                log(`/usr/local/bin not writable. Falling back to ${destinationPath}`, debugEnabled);
                yield execCommand('mkdir', ['-p', path.dirname(fallbackPath)], debugEnabled);
                yield execCommand('mv', [argoBinaryPath, destinationPath], debugEnabled);
                core.addPath(path.dirname(fallbackPath));
            }
            core.info(`Argo CLI ${version} installed successfully.`);
        }
        catch (error) {
            core.setFailed(`Failed to install Argo CLI: ${error.message}`);
        }
    });
}
function installArgoCD(version, debugEnabled) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield isToolInstalled('argocd', 'version --client', `v${version}`, debugEnabled)) {
            core.info(`ArgoCD CLI version ${version} is already installed.`);
            return;
        }
        core.info(`Installing ArgoCD CLI version ${version}...`);
        const argocdUrl = version === 'latest'
            ? 'https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64'
            : `https://github.com/argoproj/argo-cd/releases/download/v${version}/argocd-linux-amd64`;
        const argocdBinaryPath = '/tmp/argocd';
        let destinationPath = '/usr/local/bin/argocd';
        log(`Downloading ArgoCD CLI from ${argocdUrl}`, debugEnabled);
        try {
            yield execCommand('curl', ['-sSL', '-o', argocdBinaryPath, argocdUrl], debugEnabled);
            yield execCommand('chmod', ['+x', argocdBinaryPath], debugEnabled);
            yield execCommand('mv', [argocdBinaryPath, destinationPath], debugEnabled);
        }
        catch (error) {
            const fallbackPath = `${process.env.HOME}/bin`;
            destinationPath = `${fallbackPath}/argocd`;
            log(`/usr/local/bin not writable. Falling back to ${destinationPath}`, debugEnabled);
            yield execCommand('mkdir', ['-p', fallbackPath], debugEnabled);
            yield execCommand('mv', [argocdBinaryPath, destinationPath], debugEnabled);
            core.addPath(fallbackPath);
        }
        core.info(`ArgoCD CLI ${version} installed successfully.`);
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const command = core.getInput('command');
            const debugEnabled = core.getInput('tools-debug-enabled') === 'true';
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
                yield handleKubeconfig(kubeconfigBase64, debugEnabled);
            }
            if (helmEnabled) {
                yield installHelm(helmVersion, debugEnabled);
            }
            if (kubectlEnabled) {
                yield installKubectl(kubectlVersion, debugEnabled);
            }
            if (yqEnabled) {
                yield installYQ(yqVersion, debugEnabled);
            }
            if (argocdEnabled) {
                yield installArgoCD(argocdVersion, debugEnabled);
            }
            if (argoEnabled) {
                yield installArgoCLI(argoVersion, debugEnabled);
            }
            if (command) {
                core.info(`Executing command: ${command}`);
                yield execCommand('sh', ['-c', command], debugEnabled);
                core.addPath(`${process.env.HOME}/bin`);
            }
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
