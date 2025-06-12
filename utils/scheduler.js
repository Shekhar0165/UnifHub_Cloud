const cron = require('node-cron');
const { updateAllUserResumes } = require('../Controllers/application/UserResume');
const { initScheduledJobs: initOrganizationJobs } = require('../Controllers/application/OrganizationJourney');

// Initialize all scheduled jobs for the application
const initScheduler = () => {
    // Schedule the user resume update job to run at midnight (00:00)
    cron.schedule('0 0 * * *', async () => {
        console.log('Running nightly user resume update at', new Date());
        try {
            const result = await updateAllUserResumes();
            console.log('Resume update result:', result);
        } catch (error) {
            console.error('Error in resume update job:', error);
        }
    });
    
    console.log('User resume update job scheduled to run at midnight');
    
    // Initialize organization journey jobs
    initOrganizationJobs();
};

module.exports = {
    initScheduler
}; 