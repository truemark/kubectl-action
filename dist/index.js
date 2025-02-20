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
function execCommand(command, args, debugEnabled) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let output = '';
            let errorOutput = '';
            yield exec.exec(command, args, {
                silent: !debugEnabled,
                listeners: {
                    stdout: (data) => (output += data.toString()),
                    stderr: (data) => (errorOutput += data.toString())
                }
            });
            if (errorOutput) {
                core.warning(`⚠️ Command Warning: ${command} ${args.join(' ')}\n${errorOutput}`);
            }
            return output.trim();
        }
        catch (error) {
            core.error(`❌ Command Failed: ${command} ${args.join(' ')}\nError: ${error}`);
            throw new Error(`Execution failed: ${command} ${args.join(' ')}\n${error}`);
        }
    });
}
// Generic function to download and install CLI tools with validation
function installFromURL(toolName, url, debugEnabled) {
    return __awaiter(this, void 0, void 0, function* () {
        core.info(`🔍 Downloading ${toolName} from: ${url}`);
        const binPath = `${process.env.HOME}/bin`;
        const destination = `${binPath}/${toolName}`;
        yield execCommand('mkdir', ['-p', binPath], debugEnabled);
        yield execCommand('curl', ['-sSL', '-o', destination, url], debugEnabled);
        // Validate Download
        const fileCheck = yield exec.exec('file', [destination], { silent: true, ignoreReturnCode: true });
        if (fileCheck !== 0) {
            core.setFailed(`❌ Failed to download ${toolName} from ${url}`);
            return;
        }
        yield execCommand('chmod', ['+x', destination], debugEnabled);
        core.addPath(binPath);
        core.info(`✅ Installed ${toolName} at ${destination}`);
    });
}
// Install Helm with validation
function installHelm(version, debugEnabled) {
    return __awaiter(this, void 0, void 0, function* () {
        const helmUrl = `https://get.helm.sh/helm-v${version}-linux-amd64.tar.gz`;
        core.info(`🔍 Downloading Helm from: ${helmUrl}`);
        yield execCommand('curl', ['-sSL', '-o', '/tmp/helm.tar.gz', helmUrl], debugEnabled);
        // Validate download
        const fileCheck = yield execCommand('file', ['/tmp/helm.tar.gz'], debugEnabled);
        if (!fileCheck.includes("gzip compressed data")) {
            throw new Error(`❌ Invalid Helm archive downloaded from ${helmUrl}`);
        }
        // Extract Helm
        yield execCommand('tar', ['-xz', '-f', '/tmp/helm.tar.gz', '-C', '/tmp'], debugEnabled);
        const helmBinaryPath = '/tmp/linux-amd64/helm';
        // Fix: Use /usr/local/bin instead of $HOME/bin
        const installDir = '/usr/local/bin';
        yield execCommand('sudo', ['mv', helmBinaryPath, `${installDir}/helm`], debugEnabled);
        yield execCommand('sudo', ['chmod', '+x', `${installDir}/helm`], debugEnabled);
        core.info(`✅ Helm installed at ${installDir}/helm`);
    });
}
// Install Kubectl with stable version caching and validation
function installKubectl(version, debugEnabled) {
    return __awaiter(this, void 0, void 0, function* () {
        let kubectlVersion = version;
        if (version === 'stable') {
            core.info('🔍 Fetching latest stable kubectl version...');
            kubectlVersion = (yield axios_1.default.get('https://dl.k8s.io/release/stable.txt')).data.trim();
        }
        const kubectlUrl = `https://dl.k8s.io/release/${kubectlVersion}/bin/linux/amd64/kubectl`;
        yield installFromURL('kubectl', kubectlUrl, debugEnabled);
    });
}
function getLatestYQVersion() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield axios_1.default.get('https://api.github.com/repos/mikefarah/yq/releases/latest');
            return response.data.tag_name.replace(/^v/, '');
        }
        catch (error) {
            core.warning(`⚠️ Failed to fetch latest YQ version, falling back to default.`);
            return '4.30.6';
        }
    });
}
// Install YQ with validation
function installYQ(version, debugEnabled) {
    return __awaiter(this, void 0, void 0, function* () {
        const resolvedVersion = version === 'latest' ? yield getLatestYQVersion() : version;
        const yqUrl = `https://github.com/mikefarah/yq/releases/download/v${resolvedVersion}/yq_linux_amd64`;
        const binPath = `${process.env.HOME}/bin`;
        const destination = `${binPath}/yq`;
        core.info(`🔍 Downloading YQ from: ${yqUrl}`);
        yield execCommand('mkdir', ['-p', binPath], debugEnabled);
        yield execCommand('curl', ['-sSL', '-o', destination, yqUrl], debugEnabled);
        // Validate download success
        const fileCheck = yield exec.exec('file', [destination], { silent: true, ignoreReturnCode: true });
        if (fileCheck !== 0) {
            core.setFailed(`❌ Failed to download a valid YQ binary from ${yqUrl}`);
            return;
        }
        yield execCommand('chmod', ['+x', destination], debugEnabled);
        core.addPath(binPath);
        core.info(`✅ Installed yq at ${destination}`);
    });
}
function getLatestArgoCDVersion() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield axios_1.default.get('https://api.github.com/repos/argoproj/argo-cd/releases/latest');
            return response.data.tag_name.replace(/^v/, ''); // Remove "v" prefix if present
        }
        catch (error) {
            core.warning(`⚠️ Failed to fetch latest ArgoCD version, falling back to default.`);
            return '2.9.3'; // Use a stable fallback version
        }
    });
}
// Install ArgoCD CLI with validation
function installArgoCD(version, debugEnabled) {
    return __awaiter(this, void 0, void 0, function* () {
        const resolvedVersion = version === 'latest' ? yield getLatestArgoCDVersion() : version;
        const argoUrl = `https://github.com/argoproj/argo-cd/releases/download/v${resolvedVersion}/argocd-linux-amd64`;
        const binPath = `${process.env.HOME}/bin`;
        const destination = `${binPath}/argocd`;
        core.info(`🔍 Downloading ArgoCD from: ${argoUrl}`);
        yield execCommand('mkdir', ['-p', binPath], debugEnabled);
        yield execCommand('curl', ['-sSL', '-o', destination, argoUrl], debugEnabled);
        // Validate the file is a binary
        const fileCheck = yield exec.exec('file', [destination], { silent: true, ignoreReturnCode: true });
        if (fileCheck !== 0) {
            core.setFailed(`❌ Failed to download a valid ArgoCD binary from ${argoUrl}`);
            return;
        }
        yield execCommand('chmod', ['+x', destination], debugEnabled);
        core.addPath(binPath);
        core.info(`✅ Installed ArgoCD at ${destination}`);
    });
}
// Run the action
function run() {
    return __awaiter(this, void 0, void 0, function* () {
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
            if (kubectlEnabled && !kubeconfigBase64) {
                core.warning('⚠️ No KUBECONFIG provided. Kubectl may fail.');
            }
            const installTasks = [];
            if (helmEnabled)
                installTasks.push(installHelm(helmVersion, debugEnabled));
            if (kubectlEnabled)
                installTasks.push(installKubectl(kubectlVersion, debugEnabled));
            if (yqEnabled)
                installTasks.push(installYQ(yqVersion, debugEnabled));
            if (argocdEnabled)
                installTasks.push(installArgoCD(argocdVersion, debugEnabled));
            yield Promise.all(installTasks);
            core.info("✅ All enabled tools installed successfully!");
            const userCommand = core.getInput('command');
            if (userCommand) {
                core.info(`🚀 Executing user command: ${userCommand}`);
                yield execCommand('bash', ['-c', userCommand], debugEnabled);
            }
        }
        catch (error) {
            core.setFailed(`❌ Workflow failed: ${error.message}`);
        }
    });
}
run();
