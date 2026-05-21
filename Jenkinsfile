pipeline {
    agent any

    options {
        // Kill a build if it runs longer than 5 minutes
        timeout(time: 5, unit: 'MINUTES')
        // Keep only the last 5 build logs
        buildDiscarder(logRotator(numToKeepStr: '5'))
        // Don't run concurrent builds
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                // Only reinstall if package.json changed
                sh '''
                    if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
                        npm install --production --prefer-offline
                    else
                        echo "node_modules up to date, skipping install"
                    fi
                '''
            }
        }

        stage('Deploy') {
            steps {
                // Deploy directly from workspace — no copy needed
                sh '''
                    export APP_DIR=$(pwd)
                    sudo -u ec2-user /usr/bin/pm2 restart meritori \
                        || sudo -u ec2-user /usr/bin/pm2 start "$APP_DIR/server.js" \
                            --name meritori \
                            --cwd "$APP_DIR"
                    sudo -u ec2-user /usr/bin/pm2 save
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh 'sleep 2 && curl -sf http://localhost:3000/health'
            }
        }
    }

    post {
        success {
            echo "Deployed successfully in ${currentBuild.durationString}"
        }
        failure {
            echo 'Deployment failed'
            sh 'sudo -u ec2-user /usr/bin/pm2 restart meritori || true'
        }
    }
}
