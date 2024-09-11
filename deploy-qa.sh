
PRODUCT_CONFIG_DIR=".deploy-config/jooycar-file-reader"
PROJECT_NAME="jooycar-file-sender"

select_environment() {
  echo "Select the environment:"
  ENV=$(printf "QA\nPROD" | fzf --prompt "Select the Environment> ")

  if [ -z "$ENV" ]; then
    echo "Selection canceled."
    exit 1
  fi

  export ENV="$ENV"
  echo "Environment selected: $ENV"

  if [ "$ENV" == "PROD" ]; then
    export VPC_ID="vpc-1837817d"
    export SG_ID="sg-0779b43e4e07ca2c8"
    export HANDLER_CONFIG_BUCKET="jooycar-apps-configs"
    export DATA_CONFIG_SECRETS="prod__redis_url,prod__mongodb_url__rw,prod__mongodb_url__ro"
    export SFTP_CONFIG_SECRETS="zurich__sftp__prod,sura_sftp_prod"
  elif [ "$ENV" == "QA" ]; then
    export VPC_ID="vpc-1837817d"
    export SG_ID="sg-0779b43e4e07ca2c8"
    export HANDLER_CONFIG_BUCKET="jooycar-apps-configs"
    export DATA_CONFIG_SECRETS="qa__redis_url,qa__mongodb_url__rw,qa__mongodb_url__ro"
    export SFTP_CONFIG_SECRETS="zurich__sftp__qa,sura_sftp_qa"
  fi

  echo "AWS credentials for $ENV:"
  echo "VPC_ID: $VPC_ID"
}

download_configurations() {
  echo "Downloading configurations for $PROJECT_NAME..."

  S3_PATH="s3://${HANDLER_CONFIG_BUCKET}/${PROJECT_NAME}"

  aws s3 sync $S3_PATH $PRODUCT_CONFIG_DIR

  if [ $? -ne 0 ]; then
    echo "Error downloading configurations."
    exit 1
  fi
  echo "Configurations downloaded."
}

select_stack() {
  cd cdk
  echo "Listing available stacks..."
  STACKS=$(cdk list)

  if [ -z "$STACKS" ]; then
    echo "No available stacks found."
    exit 1
  fi

  STACK_NAME=$(echo "$STACKS" | fzf --prompt "Select the Stack> ")

  if [ -z "$STACK_NAME" ]; then
    echo "Selection canceled."
    exit 1
  fi

  echo "Stack selected: $STACK_NAME"
  cd ..
}

deploy_stack() {
  cd cdk
  echo "Deploying the stack $STACK_NAME in the $ENV environment..."
  cdk deploy $STACK_NAME --context env=$ENV
  if [ $? -ne 0 ]; then
    echo "Deployment error."
    exit 1
  fi
  echo "Deployment completed."
  cd ..
  rm -rf $PRODUCT_CONFIG_DIR
}

select_environment
download_configurations
select_stack
deploy_stack
