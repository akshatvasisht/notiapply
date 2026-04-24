/** Notiapply — Database query layer
 *
 * Re-exports all DB functions from split modules.
 * Preserves the @/lib/db import path for all downstream files.
 */

export { initPool, getPool, closePool, hasDatabase } from './pool';
export { getUserConfig, updateUserConfig } from './config';
export { getContacts, getContactsDueForFollowUp, updateContactState, updateContactResponse, addContactInteraction, updateContactCompanyData, updateContactNotes, requestContactReenrichment } from './contacts';
export { getJobs, getJobById, updateJobState, updateJobCallback, addManualJob, recoverStuckJobs, archiveOldJobs, retryDocs } from './jobs';
export { getApplicationByJobId, updateApplicationDraftAnswers, updateApplicationNotes } from './applications';
export { getPipelineModules, toggleModule, updateModuleConfig, updateModuleOrder, addCustomModule, deleteModule } from './pipeline';
export { getScrapedCompanies, addScrapedCompany, removeScrapedCompany, uploadMasterResume, uploadCoverLetterTemplate } from './companies';
export { getATSFailures, getAutomationStats, getLastScrapeTime, getSourceCoverage, getCallbackAnalytics } from './analytics';
export { getEmailQueue, markEmailSent, markEmailBounced, scheduleEmail, scheduleBatchEmails, markUnsubscribed, getSentTodayCount, cancelScheduledEmail, acquireNextEmailSlot } from './email';
