pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install --production'
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    cp -r . /home/ec2-user/app/
                    sudo -u ec2-user /usr/bin/pm2 restart meritori || sudo -u ec2-user /usr/bin/pm2 start /home/ec2-user/app/server.js --name meritori
                    sudo -u ec2-user /usr/bin/pm2 save
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh 'sleep 3 && curl -sf http://localhost:3000/health'
            }
        }
    }

    post {
        failure {
            echo 'Deployment failed — rolling back'
            sh 'pm2 restart meritori || true'
        }
    }
}
