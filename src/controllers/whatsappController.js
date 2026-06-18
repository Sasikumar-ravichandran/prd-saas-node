const twilio = require('twilio');
const Clinic = require('../models/Clinic');

// ==========================================
// A. Save WhatsApp/Twilio Configurations
// ==========================================
const saveConfig = async (req, res) => {
  try {
    const { whatsappEnabled, twilioAccountSid, twilioAuthToken, twilioSenderNumber } = req.body;
    const clinicId = req.user.clinicId; 

    if (!clinicId) {
        return res.status(401).json({ message: "Unauthorized. Clinic ID missing." });
    }

    const updatedClinic = await Clinic.findOneAndUpdate(
      { clinicId: clinicId },
      {
        $set: {
          'whatsappConfig.whatsappEnabled': whatsappEnabled,
          'whatsappConfig.twilioAccountSid': twilioAccountSid,
          'whatsappConfig.twilioAuthToken': twilioAuthToken,
          'whatsappConfig.twilioSenderNumber': twilioSenderNumber,
        }
      },
      { new: true }
    );

    if (!updatedClinic) {
        return res.status(404).json({ message: "Clinic not found." });
    }

    res.status(200).json({ 
        message: "WhatsApp settings updated successfully", 
        config: updatedClinic.whatsappConfig 
    });
  } catch (error) {
    console.error("Save WhatsApp Error:", error);
    res.status(500).json({ message: "Failed to save configuration", error: error.message });
  }
};

// ==========================================
// B. Test Twilio Connection
// ==========================================
const testConnection = async (req, res) => {
  const { twilioAccountSid, twilioAuthToken, twilioSenderNumber, testPhoneNumber } = req.body;
  
  if (!twilioAccountSid || !twilioAuthToken || !twilioSenderNumber || !testPhoneNumber) {
      return res.status(400).json({ message: "Missing required Twilio credentials or test phone number." });
  }

  try {
    const client = twilio(twilioAccountSid, twilioAuthToken);
    
    const message = await client.messages.create({
      from: `whatsapp:${twilioSenderNumber}`,
      to: `whatsapp:${testPhoneNumber}`,
      body: `✅ Your ClinicOS WhatsApp integration is verified successfully! You are ready to automate patient reminders.`
    });

    res.status(200).json({ 
        message: "Test message sent successfully!",
        messageSid: message.sid 
    });
  } catch (error) {
    console.error("Twilio Test Error:", error);
    res.status(400).json({ message: `Twilio Error: ${error.message}` });
  }
};

module.exports = {
    saveConfig,
    testConnection
};