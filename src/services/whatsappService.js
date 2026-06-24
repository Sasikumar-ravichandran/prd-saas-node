// backend/services/whatsappNotificationService.js
const twilio = require('twilio');
const Clinic = require('../models/Clinic');

const formatMessage = (template, data) => {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => data[key] || match);
};

// UNIVERSAL FUNCTION
const dispatchWhatsAppEvent = async (clinicId, eventType, targetPhone, swapData) => {
    try {
        const clinic = await Clinic.findOne({ clinicId });
        const config = clinic?.whatsappConfig;

        if (!config || !config.whatsappEnabled) return;

        // Check if the clinic has enabled THIS specific event (e.g., "appointment_reminder")
        const trigger = config.triggers.get(eventType);
        if (!trigger || !trigger.enabled || !targetPhone) return;

        const client = twilio(config.twilioAccountSid, config.twilioAuthToken);
        const finalMessage = formatMessage(trigger.template, swapData);

        await client.messages.create({
            from: `whatsapp:${config.twilioSenderNumber}`,
            to: `whatsapp:${targetPhone}`,
            body: finalMessage,
        });

        console.log(`Sent ${eventType} to ${targetPhone}`);
    } catch (error) {
        console.error(`WhatsApp Event (${eventType}) Failed:`, error.message);
    }
};

module.exports = { dispatchWhatsAppEvent };