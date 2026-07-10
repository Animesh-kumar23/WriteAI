const { GoogleGenAI } = require("@google/genai");
const ENV = require("./env");

const ai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });

module.exports = { ai };
