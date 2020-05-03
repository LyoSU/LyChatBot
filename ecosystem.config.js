module.exports = {
  apps: [{
    name: 'lychatbot',
    script: './index.js',
    instances: 1,
    exec_mode: 'cluster',
    watch: true,
    ignore_watch: ['node_modules'],
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    },
    post_update: [
      'echo App has been updated, running npm install...',
      'npm install',
      'echo App is being restarted now'
    ]
  }]
}
