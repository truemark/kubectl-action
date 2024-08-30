#!/bin/bash

set -e
set -o pipefail


echo "/usr/local/bin/kubectl" >> $GITHUB_PATH

if [ ! -d "$HOME/.kube" ]; then
    mkdir -p $HOME/.kube
fi

if [ -z "$KUBECONFIG" ]; then
  echo "Error: KUBECONFIG environment variable is not set."
  exit 1
fi

echo "${KUBECONFIG}" | base64 -d > kubeconfig
export KUBECONFIG="${PWD}/kubeconfig"
chmod 600 "${PWD}/kubeconfig"

if [ $# -eq 0 ]; then
  echo "No command provided. Usage: entrypoint.sh <kubectl-command>"
  exit 1
fi

echo "Running kubectl command: kubectl $*"
kubectl_output=$(kubectl "$@")

if [ -f output.txt ]; then
  rm -f output.txt
fi
echo "$kubectl_output" > output.txt

