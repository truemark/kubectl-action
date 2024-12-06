## github-kubectl

# Examples

```yaml
jobs:
  run-tools:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v3

      - name: Run Helm Command
        uses: your-repo/your-action@main
        with:
          helm-enabled: 'true'
          helm-version: '3.9.0'
          command: 'helm version'

      - name: Run Kubectl Command
        uses: your-repo/your-action@main
        with:
          kubectl-enabled: 'true'
          kubectl-version: 'stable'
          command: 'kubectl get pods'

      - name: Run YQ Command
        uses: your-repo/your-action@main
        with:
          yq-enabled: 'true'
          yq-version: '4.30.5'
          command: 'yq eval .some.property file.yaml'

```
