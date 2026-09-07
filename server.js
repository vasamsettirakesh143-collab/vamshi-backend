import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" }));

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

let chatHistory = [
    {
        role: "system",
        content: "You are Vamshi, a helpful AI assistant created by Rakesh."
    }
];

/*
 * NEW:
 * System prompt for ACTION detection. The AI must
 * decide if the user wants a device action performed.
 * If yes, it replies ONLY with JSON. If no, it replies
 * with "NO_ACTION" followed by a normal answer.
 */
const ACTION_SYSTEM_PROMPT = `You are the action-detection brain of an Android voice assistant called Vamshi.

The user's spoken command will be given to you. Decide whether the user wants the phone to PERFORM an action, or whether they are just asking a question / chatting.

You may return ONE of these actions:
- whatsapp: send or open a WhatsApp message. Fields: contact (name as spoken), message (the text to send, may be empty if they only want the chat opened).
- call: phone call. Fields: contact (name as spoken).
- open_app: open an installed app. Fields: app (app name as spoken).
- navigate: start Google Maps navigation. Fields: destination.

Rules:
1. If the user wants an action, reply ONLY with valid JSON, nothing else, in this exact format:
{"action":"whatsapp","contact":"amma","message":"hi"}
{"action":"call","contact":"rakesh"}
{"action":"open_app","app":"youtube"}
{"action":"navigate","destination":"Tirupati"}

2. For whatsapp, extract the message text from phrases like "saying ...", "that ...", or whatever follows the contact name. If no message text is given, use "".
3. If the user is NOT requesting an action (questions, greetings, general chat), reply with exactly:
NO_ACTION
4. Never invent actions. If unsure, reply NO_ACTION.
5. Ignore requests for actions you do not support (alarms, texts via SMS, emails) and reply NO_ACTION.

Examples:
"text mom I'll be late" -> {"action":"whatsapp","contact":"mom","message":"I'll be late"}
"ping rakesh on whatsapp" -> {"action":"whatsapp","contact":"rakesh","message":""}
"open whatsapp chat with amma" -> {"action":"whatsapp","contact":"amma","message":""}
"call amma" -> {"action":"call","contact":"amma"}
"open youtube" -> {"action":"open_app","app":"youtube"}
"navigate to hyderabad" -> {"action":"navigate","destination":"hyderabad"}
"what is the capital of France" -> NO_ACTION
"tell me a joke" -> NO_ACTION`;

app.get("/", (req, res) => {
    res.send("Vamshi backend is running");
});

// Existing text chat route
app.post("/chat", async (req, res) => {
    try {
        const message = String(req.body.message || "").trim();

        if (!message) {
            return res.status(400).json({
                reply: "Please send a message."
            });
        }

        chatHistory.push({
            role: "user",
            content: message
        });

        if (chatHistory.length > 21) {
            chatHistory = [
                chatHistory[0],
                ...chatHistory.slice(-20)
            ];
        }

        const response = await groq.chat.completions.create({
            model: "openai/gpt-oss-20b",
            messages: chatHistory
        });

        const reply = response.choices?.[0]?.message?.content ||
            "I could not create a reply.";

        chatHistory.push({
            role: "assistant",
            content: reply
        });

        res.json({
            reply: reply
        });
    } catch (error) {
        console.error("Chat error:", error);

        res.status(500).json({
            reply: "Sorry, my brain is temporarily unavailable."
        });
    }
});

/*
 * NEW:
 * Action-detection route. The app sends the spoken
 * command here first. If the AI detects an action,
 * we return {"action": {...}}. Otherwise we return
 * {"action": null} and the app falls back to /chat.
 */
app.post("/action", async (req, res) => {
    try {
        const message = String(req.body.message || "").trim();

        if (!message) {
            return res.status(400).json({
                action: null
            });
        }

        const response = await groq.chat.completions.create({
            model: "openai/gpt-oss-20b",
            messages: [
                {
                    role: "system",
                    content: ACTION_SYSTEM_PROMPT
                },
                {
                    role: "user",
                    content: message
                }
            ],
            temperature: 0
        });

        const raw =
            response.choices?.[0]?.message?.content?.trim() || "";

        console.log("Action brain said:", raw);

        if (!raw.startsWith("{")) {

            // Not an action — normal chat.
            return res.json({
                action: null
            });
        }

        // Strip markdown fences if the model adds them.
        const cleaned = raw
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/, "")
            .trim();

        const parsed = JSON.parse(cleaned);

        const allowedActions = [
            "whatsapp",
            "call",
            "open_app",
            "navigate"
        ];

        if (!allowedActions.includes(parsed.action)) {
            return res.json({
                action: null
            });
        }

        res.json({
            action: {
                type: parsed.action,
                contact: typeof parsed.contact === "string"
                        ? parsed.contact
                        : "",
                message: typeof parsed.message === "string"
                        ? parsed.message
                        : "",
                app: typeof parsed.app === "string"
                        ? parsed.app
                        : "",
                destination: typeof parsed.destination === "string"
                        ? parsed.destination
                        : ""
            }
        });

    } catch (error) {

        console.error("Action error:", error);

        // On any failure, fall back to normal chat.
        res.json({
            action: null
        });
    }
});

// New Gemini image-understanding route
app.post("/vision", async (req, res) => {
    try {
        const message = String(
            req.body.message || "Describe this image."
        ).trim();

        const image = req.body.image;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(503).json({
                reply: "Image understanding is not configured yet."
            });
        }

        if (!image || typeof image.data !== "string" || !image.data) {
            return res.status(400).json({
                reply: "Please attach an image first."
            });
        }

        const allowedMimeTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];

        const mimeType = allowedMimeTypes.includes(image.mimeType)
            ? image.mimeType
            : "image/jpeg";

        const cleanBase64 = image.data.replace(
            /^data:[^;]+;base64,/,
            ""
        );

        if (cleanBase64.length > 12 * 1024 * 1024) {
            return res.status(413).json({
                reply: "This image is too large. Please choose a smaller photo."
            });
        }

        const geminiResponse = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" +
            encodeURIComponent(apiKey ),
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [
                        {
                            role: "user",
                            parts: [
                                {
                                    text: message
                                },
                                {
                                    inline_data: {
                                        mime_type: mimeType,
                                        data: cleanBase64
                                    }
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.4,
                        maxOutputTokens: 1000
                    }
                })
            }
        );

        const data = await geminiResponse.json();

        if (!geminiResponse.ok) {
            console.error("Gemini error:", data);

            return res.status(502).json({
                reply: "Gemini could not process this image right now."
            });
        }

        const reply = data.candidates?.[0]?.content?.parts
            ?.filter((part) => typeof part.text === "string")
            ?.map((part) => part.text)
            ?.join("\n")
            ?.trim();

        if (!reply) {
            return res.status(502).json({
                reply: "I could not understand this image. Try a clearer photo."
            });
        }

        res.json({
            reply: reply
        });
    } catch (error) {
        console.error("Vision error:", error);

        res.status(500).json({
            reply: "Image understanding is temporarily unavailable."
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
