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
