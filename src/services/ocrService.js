const { GoogleGenAI, Type } = require('@google/genai');

// Ensure you have GEMINI_API_KEY in your .env file

const extractFormData = async (imageBuffer, mimeType, clinicApiKey) => {
  try {
	if (!clinicApiKey) {
      throw new Error("API_KEY_MISSING");
    }

	const ai = new GoogleGenAI({ apiKey: clinicApiKey });

    const imagePart = {
      inlineData: {
        data: imageBuffer.toString("base64"),
        mimeType: mimeType
      },
    };

    //  SAAS ARCHITECTURE: Force the AI to output exactly the keys your frontend needs
    const patientSchema = {
      type: Type.OBJECT,
      properties: {
        fullName: { type: Type.STRING, description: "Patient's full name." },
        age: { type: Type.STRING, description: "Extract age if present, just the number." },
        gender: { type: Type.STRING, description: "Return exactly 'Male', 'Female', or 'Other'." },
        mobile: { type: Type.STRING, description: "Phone number, numbers only." },
        bloodGroup: { type: Type.STRING, description: "Blood group (e.g., A+, O-). Leave empty if not found." },
        emergencyContact: { type: Type.STRING, description: "Emergency contact person's name." },
        emergencyRelation: { type: Type.STRING, description: "Relationship to patient (e.g., Father, Wife)." },
        primaryConcern: { type: Type.STRING, description: "The main reason for their visit (e.g., Tooth Pain, Cleaning)." },
        medicalConditions: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Any mentioned medical alerts, allergies, or chronic conditions."
        },
        notes: { type: Type.STRING, description: "Any extra handwritten notes by the patient." }
      }
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash', // The fast, free tier model
      contents: [
        imagePart,
        "Analyze this physical dental intake form. Extract the handwritten or printed details into the exact JSON schema provided. Be careful with handwriting. If a field is blank, return an empty string or empty array."
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: patientSchema,
        temperature: 0.1 // Low temperature = strict data extraction, no hallucinations
      }
    });

    // The response is guaranteed to be a valid JSON string matching your schema
    return JSON.parse(response.text);

  } catch (error) {
    console.error("[OCR Service] Failed to process image:", error.message);
    throw new Error("Failed to extract data from form.");
  }
};

module.exports = { extractFormData };