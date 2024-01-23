mkdir deploy-config
aws s3 sync s3://jooycar-apps-configs/jooycar-file-sender/ deploy-config/jooycar-file-reader || exit 1
cd cdk/infrastructure
cdk deploy jooycarFileSenderProd || exit 1
cd ../..
rm -rf deploy-config
