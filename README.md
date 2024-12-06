# Kubernetes Tools Action
This action uses typescript to install the tools needed to manage applications in a Kubernetes cluster. Here are the tools that will be installed:
- Helm
- Kubectl
- YQ

You can set the versions for each of the tools, or the action will just install the stable versions of the tools.

## Examples

```yaml
jobs:
  run-tools:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Run Helm Command
        uses: truemark/github-kubectl@main
        with:
          helm-enabled: 'true'
          helm-version: '3.9.0'
          command: 'helm version'

      - name: Run Kubectl Command
        uses: truemark/github-kubectl@main
        with:
          kubectl-enabled: 'true'
          kubectl-version: 'stable'
          command: 'kubectl get pods'

      - name: Run YQ Command
        uses: truemark/github-kubectl@main
        with:
          yq-enabled: 'true'
          yq-version: '4.30.5'
          command: 'yq eval .image.tag values.yaml'

```
