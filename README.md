# GitHub Action: Install Kubernetes Tools

This GitHub Action installs commonly used Kubernetes-related tools such as Helm, Kubectl, YQ, Argo CLI, and ArgoCD CLI. It also supports configuring the Kubernetes context using a base64-encoded KUBECONFIG.

## Usage

Create a workflow file (e.g., `.github/workflows/install-tools.yml`) and add the following content:

```yaml
name: Install Kubernetes Tools

on:
  push:
    branches:
      - main

jobs:
  install-tools:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Install Kubernetes Tools
        uses: ./.github/actions/install-tools
        with:
          tools-debug-enabled: 'true'
          helm-enabled: 'true'
          helm-version: '3.13.0'
          kubectl-enabled: 'true'
          kubectl-version: '1.27.0'
          yq-enabled: 'true'
          yq-version: '4.30.6'
          argocd-enabled: 'true'
          argocd-version: '2.8.0'
          argo-enabled: 'true'
          argo-version: '3.4.0'
          kubeconfig: ${{ secrets.KUBECONFIG_BASE64 }}
```

### Inputs

| Name                | Required | Default | Description |
| ------------------- | -------- | ------- | ----------- |
| `tools-debug-enabled` | No       | `false` | Enable debug logging for installation steps. |
| `helm-enabled`      | No       | `false` | Whether to install Helm. |
| `helm-version`      | Yes (if `helm-enabled` is `true`) | `latest` | Version of Helm to install (e.g., `3.13.0`). |
| `kubectl-enabled`   | No       | `false` | Whether to install Kubectl. |
| `kubectl-version`   | Yes (if `kubectl-enabled` is `true`) | `stable` | Version of Kubectl to install (e.g., `1.27.0`). |
| `yq-enabled`        | No       | `false` | Whether to install YQ. |
| `yq-version`        | Yes (if `yq-enabled` is `true`) | `latest` | Version of YQ to install (e.g., `4.30.6`). |
| `argocd-enabled`    | No       | `false` | Whether to install ArgoCD CLI. |
| `argocd-version`    | Yes (if `argocd-enabled` is `true`) | `latest` | Version of ArgoCD CLI to install (e.g., `2.8.0`). |
| `argo-enabled`      | No       | `false` | Whether to install Argo CLI. |
| `argo-version`      | Yes (if `argo-enabled` is `true`) | `latest` | Version of Argo CLI to install (e.g., `3.4.0`). |
| `kubeconfig`        | No       |         | Base64-encoded KUBECONFIG to set up cluster context. |

### Example Workflow

#### 1. Install Specific Tools with Debugging Enabled
```yaml
jobs:
  install-tools:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Install Only Helm and Kubectl
        uses: ./.github/actions/install-tools
        with:
          tools-debug-enabled: 'true'
          helm-enabled: 'true'
          helm-version: '3.13.0'
          kubectl-enabled: 'true'
          kubectl-version: '1.27.0'
```

#### 2. Install All Tools with Default Versions
```yaml
jobs:
  install-all-tools:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Install All Kubernetes Tools
        uses: ./.github/actions/install-tools
        with:
          tools-debug-enabled: 'false'
          helm-enabled: 'true'
          kubectl-enabled: 'true'
          yq-enabled: 'true'
          argocd-enabled: 'true'
          argo-enabled: 'true'
```

#### 3. Provide KUBECONFIG for Cluster Access
```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Install and Configure Kubernetes Tools
        uses: ./.github/actions/install-tools
        with:
          tools-debug-enabled: 'true'
          helm-enabled: 'true'
          helm-version: '3.13.0'
          kubectl-enabled: 'true'
          kubectl-version: '1.27.0'
          kubeconfig: ${{ secrets.KUBECONFIG_BASE64 }}
```

### Debugging
- Set `tools-debug-enabled: 'true'` to view detailed output for each tool installation.
- If there are issues with permissions (e.g., `/usr/local/bin` not writable), the Action will fall back to installing binaries in `~/bin`.

### Notes
- For security, always store sensitive inputs like `kubeconfig` as GitHub secrets.
- Ensure that the versions specified are valid and available.

### Outputs
This GitHub Action does not produce specific outputs but installs the selected tools and configures the environment for subsequent steps.

## License
This project is licensed under the [MIT License](LICENSE).

