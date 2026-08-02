// backend/controllers/whatsappController.js
const axios = require('axios');
const Clinic = require('../models/Clinic');

// ==========================================
// A. Save Meta WhatsApp Configurations
// ==========================================
const saveConfig = async (req, res) => {
  try {
    const { whatsappEnabled, phoneNumberId, wabaId, accessToken } = req.body;
    const clinicId = req.user.clinicId; 

    if (!clinicId) {
      return res.status(401).json({ message: "Unauthorized. Clinic ID missing." });
    }

    const updatedClinic = await Clinic.findOneAndUpdate(
      { clinicId: clinicId },
      {
        $set: {
          'whatsappConfig.whatsappEnabled': whatsappEnabled,
          'whatsappConfig.phoneNumberId': phoneNumberId,
          'whatsappConfig.wabaId': wabaId,
          'whatsappConfig.accessToken': accessToken,
        }
      },
      { new: true }
    );

    if (!updatedClinic) {
      return res.status(404).json({ message: "Clinic not found." });
    }

    res.status(200).json({ 
      message: "Meta WhatsApp settings updated successfully", 
      config: updatedClinic.whatsappConfig 
    });
  } catch (error) {
    console.error("Save WhatsApp Error:", error);
    res.status(500).json({ message: "Failed to save configuration", error: error.message });
  }
};

// ==========================================
// B. Test Meta Cloud API Connection
// ==========================================
const testConnection = async (req, res) => {
  const { phoneNumberId, accessToken, testPhoneNumber } = req.body;
  
  if (!phoneNumberId || !accessToken || !testPhoneNumber) {
    return res.status(400).json({ 
      message: "Missing required Meta credentials (Phone Number ID, Access Token) or Test Phone Number." 
    });
  }

  try {
    // 1. Format phone number: Meta requires digits only, country code included, NO '+' sign
    const formattedPhone = testPhoneNumber.replace(/\D/g, '');

    // 2. Build Meta Cloud API payload using their universal 'hello_world' test template
    // (Or replace 'hello_world' with your own approved template name)
    const payload = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "template",
      template: {
        name: "hello_world", // Every Meta account has this built-in for testing!
        language: {
          code: "en_US"
        }
      }
    };

    // 3. Send direct POST request to Meta Graph API
    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
    
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    res.status(200).json({ 
      message: "Test message sent successfully via Meta Cloud API!",
      messageId: response.data.messages?.[0]?.id 
    });
  } catch (error) {
    const metaError = error.response?.data?.error?.message || error.message;
    console.error("Meta WhatsApp Test Error:", metaError);
    res.status(400).json({ message: `Meta API Error: ${metaError}` });
  }
};

module.exports = {
  saveConfig,
  testConnection
};