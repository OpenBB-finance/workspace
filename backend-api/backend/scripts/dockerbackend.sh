#!/bin/bash

# This bash function should be added to `~/.zschr` or `~/.bashrc`
# so that it can be called from anywhere in the terminal.

# Description:
    # Build, tag and push docker images to AWS ECR
# Usage:
    # dockerbackend -v|--version version -d|--dev|-p|--prod
# Options:
    # -v|--version: version of the docker image
    # -d|--dev: build and push to dev ECR
    # -p|--prod: build and push to prod ECR

# Example: dockerbackend -v 0.1.0 -d

function dockerbackend () {
    local version aws tag repo dev_tag prod_tag dev_repo prod_repo

    dev_tag="awsdev1_ecr1"
    prod_tag="awsbot1_ecr1"
    dev_repo="467649407693.dkr.ecr.us-east-1.amazonaws.com/awsdev1_ecr1"
    prod_repo="149911392452.dkr.ecr.us-east-1.amazonaws.com/awsbot1_ecr1"

    while [[ $# -gt 0 ]]; do
        key="$1"
        case $key in
            -v|--version)
                version="$2"
                shift
                shift
                ;;
            -d|--dev)
                aws="dev"
                shift
                ;;
            -p|--prod)
                aws="prod"
                shift
                ;;
            *)
                shift
                ;;
        esac
    done

    if [[ -z "$version" ]] || [[ -z "$aws" ]]; then
        echo "Missing arguments. Options are -v|--version, -d|--dev, and -p|--prod"
        return 1
    fi

    if [[ $aws == "dev" ]]; then
        tag=$dev_tag
        repo=$dev_repo
    elif [[ $aws == "prod" ]]; then
        tag=$prod_tag
        repo=$prod_repo
    fi
    echo "Building payments_backend:${version} and payments_worker-${version}"

    docker build -t $tag:payments_backend-$version -f fastapi.Dockerfile .
    docker build -t $tag:payments_worker-$version -f rqworker.Dockerfile .

    docker tag $tag:payments_backend-$version $repo:payments_backend-$version
    docker tag $tag:payments_worker-$version $repo:payments_worker-$version

    docker push $repo:payments_backend-$version
    docker push $repo:payments_worker-$version
}