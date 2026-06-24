const Appointment = require('../models/Appointment');
const RecallLog = require('../models/RecallLog');

// Update this path to wherever your Twilio WhatsApp function lives in your backend
const { sendWhatsAppTemplate } = require('./whatsappController'); 

// Configuration defining the cascade behavior
const RECALL_STAGES = {
    PHASE_1_NUDGE: {
        daysAgo: 160, // 20 days before 6-month mark
        templateCode: 'clinic_recall_stage1_nudge'
    },
    PHASE_2_RECALL: {
        daysAgo: 185, // 5 days after 6-month mark
        templateCode: 'clinic_recall_stage2_official'
    },
    PHASE_3_REACTIVATION: {
        daysAgo: 365, // 1 year mark
        templateCode: 'clinic_recall_stage3_reactivate'
    }
};

/**
 * Helper to generate start and end dates for a specific number of days ago
 */
const getDateRangeForDaysAgo = (days) => {
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setDate(end.getDate() - days);
    end.setHours(23, 59, 59, 999);

    return { start, end };
};

/**
 * Processes a specific stage in the cascading funnel
 */
const processStage = async (stageKey, config) => {
    const { start, end } = getDateRangeForDaysAgo(config.daysAgo);
    
    console.log(`[Recall Engine] Scanning for ${stageKey} (Appointments between ${start.toDateString()} and ${end.toDateString()})`);

    // 1. Find all completed appointments within this specific day range
    const pastAppointments = await Appointment.find({
        date: { $gte: start, $lte: end },
        status: 'COMPLETED'
    }).populate('patientId clinicId');

    let processedCount = 0;

    for (const appt of pastAppointments) {
        const patient = appt.patientId;
        const clinic = appt.clinicId;

        if (!patient || !clinic) continue;

        // 2. Safeguard: Check if this specific clinic has automation enabled in its profile
        if (!clinic.whatsappConfig?.whatsappEnabled) continue;

        try {
            // 3. Exclusion Rule: Does the patient have an upcoming scheduled appointment?
            const hasFutureAppointment = await Appointment.findOne({
                patientId: patient._id,
                date: { $gte: new Date() },
                status: 'SCHEDULED'
            });

            if (hasFutureAppointment) continue;

            // 4. Exclusion Rule: Has this specific stage already been processed for this baseline visit?
            const alreadySent = await RecallLog.findOne({
                appointmentId: appt._id,
                stage: stageKey
            });

            if (alreadySent) continue;

            // 5. Build Twilio Template Components
            const templateComponents = [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: patient.fullName }
                    ]
                }
            ];

            // 6. Dispatch through your existing WhatsApp function
            await sendWhatsAppTemplate({
                to: patient.mobile,
                templateCode: config.templateCode,
                components: templateComponents
            });

            // 7. Track successful run
            await RecallLog.create({
                clinicId: clinic._id,
                patientId: patient._id,
                appointmentId: appt._id,
                stage: stageKey,
                status: 'SENT'
            });

            processedCount++;

        } catch (error) {
            console.error(`[Recall Engine] Error processing ${stageKey} for patient ${patient._id}:`, error.message);
            
            // Log the failure to ensure we don't repeat indefinitely on failures
            await RecallLog.create({
                clinicId: clinic._id,
                patientId: patient._id,
                appointmentId: appt._id,
                stage: stageKey,
                status: 'FAILED',
                errorDetails: error.message
            });
        }
    }

    console.log(`[Recall Engine] Finished ${stageKey}. Sent ${processedCount} notifications.`);
};

/**
 * Master controller function called by the background cron job
 */
const runRetentionEngine = async () => {
    console.log('[Recall Engine] Executing master retention run...');
    try {
        // Run all stages sequentially
        await processStage('PHASE_1_NUDGE', RECALL_STAGES.PHASE_1_NUDGE);
        await processStage('PHASE_2_RECALL', RECALL_STAGES.PHASE_2_RECALL);
        await processStage('PHASE_3_REACTIVATION', RECALL_STAGES.PHASE_3_REACTIVATION);
        console.log('[Recall Engine] Master retention run complete.');
    } catch (criticalError) {
        console.error('[Recall Engine] Critical failure in master loop:', criticalError);
    }
};

module.exports = { runRetentionEngine };