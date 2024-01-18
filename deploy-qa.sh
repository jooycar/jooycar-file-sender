mkdir deploy-config
aws s3 sync s3://jooycar-apps-configs/download-binnacle-reports/qa deploy-config/download-binnacle-reports || exit 1
cd cdk/infrastructure
cdk deploy DownloadBinnacleReportQA || exit 1
cd ../..
rm -rf deploy-config
